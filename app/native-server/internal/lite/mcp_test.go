package lite

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func TestMCPServerListsRetainedTools(t *testing.T) {
	ctx := context.Background()
	server := NewMCPServer(NewExtensionBridge(10 * time.Millisecond))
	session := connectInMemory(t, ctx, server)
	defer session.Close()

	seen := map[string]bool{}
	for tool, err := range session.Tools(ctx, nil) {
		if err != nil {
			t.Fatal(err)
		}
		seen[tool.Name] = true
	}

	if !seen["chrome_screenshot"] {
		t.Fatal("expected chrome_screenshot in MCP tool list")
	}
	if seen["search_tabs_content"] {
		t.Fatal("search_tabs_content should not be listed")
	}
}

func TestMCPToolCallReturnsToolErrorWhenExtensionDisconnected(t *testing.T) {
	ctx := context.Background()
	server := NewMCPServer(NewExtensionBridge(10 * time.Millisecond))
	session := connectInMemory(t, ctx, server)
	defer session.Close()

	result, err := session.CallTool(ctx, &mcp.CallToolParams{Name: "chrome_screenshot"})
	if err != nil {
		t.Fatal(err)
	}
	if !result.IsError {
		t.Fatal("expected tool-level error")
	}
	if len(result.Content) == 0 {
		t.Fatal("expected error content")
	}
	text, ok := result.Content[0].(*mcp.TextContent)
	if !ok {
		t.Fatalf("expected text content, got %T", result.Content[0])
	}
	if !strings.Contains(text.Text, "Chrome extension is not connected") {
		t.Fatalf("unexpected error text: %s", text.Text)
	}
}

func connectInMemory(t *testing.T, ctx context.Context, server *mcp.Server) *mcp.ClientSession {
	t.Helper()
	serverTransport, clientTransport := mcp.NewInMemoryTransports()
	if _, err := server.Connect(ctx, serverTransport, nil); err != nil {
		t.Fatal(err)
	}
	client := mcp.NewClient(&mcp.Implementation{Name: "test-client", Version: "0.0.0"}, nil)
	session, err := client.Connect(ctx, clientTransport, nil)
	if err != nil {
		t.Fatal(err)
	}
	return session
}
