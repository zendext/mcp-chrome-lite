package lite

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

type RuntimeConfig struct {
	Host    string
	Port    string
	Timeout time.Duration
}

func (c RuntimeConfig) address() string {
	host := c.Host
	if host == "" {
		host = defaultExtensionHost
	}
	port := c.Port
	if port == "" {
		port = "0"
	}
	return fmt.Sprintf("%s:%s", host, port)
}

func Run(ctx context.Context, config RuntimeConfig) error {
	bridge := NewExtensionBridgeWithEndpoint(config.Timeout, config.Host, config.Port)
	defer bridge.Close()

	go func() {
		<-ctx.Done()
		bridge.Close()
	}()

	server := NewMCPServer(bridge)
	if err := server.Run(ctx, &mcp.StdioTransport{}); err != nil {
		return err
	}

	return nil
}

func extensionMux(bridge *ExtensionBridge) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("/extension", bridge)
	mux.HandleFunc("/ping", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("content-type", "application/json")
		_, _ = fmt.Fprint(w, `{"status":"ok"}`)
	})
	return mux
}
