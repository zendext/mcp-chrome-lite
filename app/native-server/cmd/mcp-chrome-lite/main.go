package main

import (
	"context"
	"flag"
	"log"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/zendext/mcp-chrome-lite/app/native-server/internal/lite"
)

func main() {
	host := flag.String("host", envOrDefault("MCP_CHROME_HOST", "127.0.0.1"), "extension WebSocket host")
	port := flag.String("port", envOrDefault("MCP_CHROME_PORT", ""), "extension WebSocket port; defaults to a random free port on first tool call")
	flag.Parse()

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	config := lite.RuntimeConfig{
		Host:    *host,
		Port:    *port,
		Timeout: 2 * time.Minute,
	}
	if err := lite.Run(ctx, config); err != nil {
		log.Fatal(err)
	}
}

func envOrDefault(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}
