package lite

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

const (
	defaultExtensionHost      = "127.0.0.1"
	extensionPath             = "/extension"
	ExtensionNotConnectedBase = "Chrome extension is not connected."
)

type ExtensionBridge struct {
	timeout time.Duration

	mu         sync.Mutex
	conn       *websocket.Conn
	ready      bool
	pending    map[string]chan extensionResponse
	nextID     uint64
	host       string
	port       string
	actualPort string
	httpServer *http.Server
	listener   net.Listener
}

type extensionRequest struct {
	ID   string          `json:"id"`
	Type string          `json:"type"`
	Name string          `json:"name"`
	Args json.RawMessage `json:"args"`
}

type extensionResponse struct {
	ID     string          `json:"id"`
	Type   string          `json:"type"`
	Status string          `json:"status"`
	Result json.RawMessage `json:"result,omitempty"`
	Error  string          `json:"error,omitempty"`
}

type extensionControlMessage struct {
	Type string `json:"type"`
}

func NewExtensionBridge(timeout time.Duration) *ExtensionBridge {
	return NewExtensionBridgeWithEndpoint(timeout, defaultExtensionHost, "")
}

func NewExtensionBridgeWithEndpoint(timeout time.Duration, host string, port string) *ExtensionBridge {
	if timeout <= 0 {
		timeout = 2 * time.Minute
	}
	if host == "" {
		host = defaultExtensionHost
	}
	return &ExtensionBridge{
		timeout: timeout,
		pending: make(map[string]chan extensionResponse),
		host:    host,
		port:    port,
	}
}

func (b *ExtensionBridge) CallTool(ctx context.Context, name string, args json.RawMessage) (json.RawMessage, error) {
	b.mu.Lock()
	if b.conn == nil || !b.ready {
		if err := b.ensureListenerLocked(); err != nil {
			b.mu.Unlock()
			return nil, fmt.Errorf("start extension WebSocket listener: %w", err)
		}
		message := b.disconnectedMessageLocked()
		b.mu.Unlock()
		return nil, errors.New(message)
	}

	b.nextID++
	id := fmt.Sprintf("req-%d", b.nextID)
	ch := make(chan extensionResponse, 1)
	b.pending[id] = ch
	req := extensionRequest{
		ID:   id,
		Type: "call_tool",
		Name: name,
		Args: args,
	}
	conn := b.conn
	if err := conn.WriteJSON(req); err != nil {
		delete(b.pending, id)
		b.mu.Unlock()
		return nil, err
	}
	b.mu.Unlock()

	timer := time.NewTimer(b.timeout)
	defer timer.Stop()

	select {
	case <-ctx.Done():
		b.removePending(id)
		return nil, ctx.Err()
	case <-timer.C:
		b.removePending(id)
		return nil, fmt.Errorf("timed out waiting for Chrome extension response")
	case resp := <-ch:
		if resp.Status != "success" {
			if resp.Error == "" {
				resp.Error = "Chrome extension returned an error"
			}
			return nil, errors.New(resp.Error)
		}
		if len(resp.Result) == 0 {
			return json.RawMessage(`{"content":[{"type":"text","text":""}]}`), nil
		}
		return resp.Result, nil
	}
}

func (b *ExtensionBridge) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	upgrader := websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			host := r.Host
			return host == "127.0.0.1:12306" || host == "localhost:12306" || host != ""
		},
	}
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		return
	}

	b.replaceConnection(conn)
	go b.readLoop(conn)
}

func (b *ExtensionBridge) Endpoint() string {
	b.mu.Lock()
	defer b.mu.Unlock()
	if b.actualPort == "" {
		return ""
	}
	return b.endpointLocked()
}

func (b *ExtensionBridge) Close() {
	b.mu.Lock()
	server := b.httpServer
	listener := b.listener
	conn := b.conn
	b.httpServer = nil
	b.listener = nil
	b.conn = nil
	b.mu.Unlock()

	if conn != nil {
		_ = conn.Close()
	}
	if server != nil {
		_ = server.Shutdown(context.Background())
	}
	if listener != nil {
		_ = listener.Close()
	}
}

func (b *ExtensionBridge) ensureListenerLocked() error {
	if b.listener != nil {
		return nil
	}

	port := b.port
	if port == "" {
		port = "0"
	}
	listener, err := net.Listen("tcp", net.JoinHostPort(b.host, port))
	if err != nil {
		return err
	}
	_, actualPort, err := net.SplitHostPort(listener.Addr().String())
	if err != nil {
		_ = listener.Close()
		return err
	}

	server := &http.Server{
		Handler:           extensionMux(b),
		ReadHeaderTimeout: 5 * time.Second,
	}
	b.listener = listener
	b.httpServer = server
	b.actualPort = actualPort

	go func() {
		err := server.Serve(listener)
		if err != nil && !errors.Is(err, http.ErrServerClosed) {
			// The next tool call will still report disconnected. Avoid writing to
			// stdout/stderr because this process speaks MCP over stdio.
		}
	}()

	return nil
}

func (b *ExtensionBridge) disconnectedMessageLocked() string {
	if b.actualPort == "" {
		return ExtensionNotConnectedBase
	}
	return fmt.Sprintf(
		"%s Open the Chrome MCP Bridge popup, paste this endpoint, click Connect, then retry: %s",
		ExtensionNotConnectedBase,
		b.endpointLocked(),
	)
}

func (b *ExtensionBridge) endpointLocked() string {
	return fmt.Sprintf("ws://%s:%s%s", b.host, b.actualPort, extensionPath)
}

func (b *ExtensionBridge) replaceConnection(conn *websocket.Conn) {
	b.mu.Lock()
	defer b.mu.Unlock()

	if b.conn != nil {
		_ = b.conn.Close()
	}
	b.conn = conn
	b.ready = false
}

func (b *ExtensionBridge) readLoop(conn *websocket.Conn) {
	defer func() {
		b.mu.Lock()
		if b.conn == conn {
			b.conn = nil
			b.ready = false
		}
		b.mu.Unlock()
		_ = conn.Close()
	}()

	for {
		_, payload, err := conn.ReadMessage()
		if err != nil {
			return
		}

		var control extensionControlMessage
		if err := json.Unmarshal(payload, &control); err == nil && control.Type == "extension_ready" {
			b.mu.Lock()
			if b.conn == conn {
				b.ready = true
			}
			b.mu.Unlock()
			continue
		}

		var resp extensionResponse
		if err := json.Unmarshal(payload, &resp); err != nil {
			continue
		}
		b.mu.Lock()
		ch := b.pending[resp.ID]
		delete(b.pending, resp.ID)
		b.mu.Unlock()
		if ch != nil {
			ch <- resp
		}
	}
}

func (b *ExtensionBridge) removePending(id string) {
	b.mu.Lock()
	delete(b.pending, id)
	b.mu.Unlock()
}
