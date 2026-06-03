package lite

import (
	"context"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/gorilla/websocket"
)

func TestExtensionBridgeReturnsClearErrorWhenDisconnected(t *testing.T) {
	bridge := NewExtensionBridge(10 * time.Millisecond)

	_, err := bridge.CallTool(context.Background(), "chrome_screenshot", []byte(`{}`))
	if err == nil {
		t.Fatal("expected disconnected error")
	}
	if !strings.Contains(err.Error(), "Chrome extension is not connected") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestLazyExtensionListenerDoesNotBindUntilFirstToolCall(t *testing.T) {
	host := "127.0.0.1"
	port := freeTCPPort(t, host)
	bridge := NewExtensionBridgeWithEndpoint(10*time.Millisecond, host, port)
	defer bridge.Close()

	probe, err := net.Listen("tcp", net.JoinHostPort(host, port))
	if err != nil {
		t.Fatalf("expected port to remain free before first tool call: %v", err)
	}
	_ = probe.Close()
}

func TestLazyExtensionListenerStartsOnFirstToolCallAndReportsEndpoint(t *testing.T) {
	bridge := NewExtensionBridgeWithEndpoint(10*time.Millisecond, "127.0.0.1", "0")
	defer bridge.Close()

	_, err := bridge.CallTool(context.Background(), "chrome_screenshot", json.RawMessage(`{}`))
	if err == nil {
		t.Fatal("expected disconnected error")
	}
	if !strings.Contains(err.Error(), "Open the Chrome MCP Bridge popup") {
		t.Fatalf("expected extension setup instructions, got: %v", err)
	}
	if !strings.Contains(err.Error(), "ws://127.0.0.1:") {
		t.Fatalf("expected full websocket endpoint, got: %v", err)
	}

	endpoint := bridge.Endpoint()
	if !strings.HasPrefix(endpoint, "ws://127.0.0.1:") || !strings.HasSuffix(endpoint, "/extension") {
		t.Fatalf("unexpected endpoint: %q", endpoint)
	}

	pingURL := strings.Replace(endpoint, "ws://", "http://", 1)
	pingURL = strings.TrimSuffix(pingURL, "/extension") + "/ping"
	resp, err := http.Get(pingURL)
	if err != nil {
		t.Fatalf("expected lazy listener to serve ping: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("unexpected ping status: %s", resp.Status)
	}
}

func TestConnectedExtensionMustAcknowledgeQuicklyBeforeToolWait(t *testing.T) {
	bridge := NewExtensionBridgeWithEndpoint(2*time.Second, "127.0.0.1", "0")
	defer bridge.Close()

	_, err := bridge.CallTool(context.Background(), "chrome_screenshot", json.RawMessage(`{}`))
	if err == nil {
		t.Fatal("expected disconnected error to start lazy listener")
	}

	conn, _, err := websocket.DefaultDialer.Dial(bridge.Endpoint(), nil)
	if err != nil {
		t.Fatalf("connect fake extension: %v", err)
	}
	defer conn.Close()

	start := time.Now()
	_, err = bridge.CallTool(context.Background(), "chrome_screenshot", json.RawMessage(`{}`))
	elapsed := time.Since(start)
	if err == nil {
		t.Fatal("expected extension unresponsive error")
	}
	if elapsed > 750*time.Millisecond {
		t.Fatalf("expected quick unresponsive extension error, took %s: %v", elapsed, err)
	}
	if !strings.Contains(err.Error(), "Open the Chrome MCP Bridge popup") {
		t.Fatalf("expected setup guidance, got: %v", err)
	}
}

func freeTCPPort(t *testing.T, host string) string {
	t.Helper()
	listener, err := net.Listen("tcp", net.JoinHostPort(host, "0"))
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	_, port, err := net.SplitHostPort(listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	if port == "" {
		t.Fatal("empty port")
	}
	return fmt.Sprint(port)
}
