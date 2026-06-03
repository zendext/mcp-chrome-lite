package lite

import (
	"context"
	"encoding/json"

	"github.com/modelcontextprotocol/go-sdk/mcp"
)

func NewMCPServer(bridge *ExtensionBridge) *mcp.Server {
	server := mcp.NewServer(&mcp.Implementation{
		Name:    "chrome-mcp-bridge",
		Version: "0.1.0",
	}, &mcp.ServerOptions{
		Instructions: "Use these tools to inspect and control Chrome through the Chrome MCP Bridge extension. If a Chrome tool returns a disconnected error with a ws:// endpoint, immediately tell the user to paste that exact endpoint into the Chrome MCP Bridge popup and click Connect, then retry the tool. Do not search project docs for connection steps after receiving that error.",
	})

	for _, def := range ToolDefinitions() {
		tool := &mcp.Tool{
			Name:        def.Name,
			Description: def.Description,
			InputSchema: def.InputSchema,
		}
		name := def.Name
		server.AddTool(tool, func(ctx context.Context, req *mcp.CallToolRequest) (*mcp.CallToolResult, error) {
			args := json.RawMessage(`{}`)
			if req != nil && req.Params != nil && len(req.Params.Arguments) > 0 {
				args = req.Params.Arguments
			}
			raw, err := bridge.CallTool(ctx, name, args)
			if err != nil {
				return ToolError(err.Error()), nil
			}
			return decodeToolResult(raw), nil
		})
	}

	return server
}

func ToolError(message string) *mcp.CallToolResult {
	return &mcp.CallToolResult{
		IsError: true,
		Content: []mcp.Content{
			&mcp.TextContent{Text: message},
		},
	}
}

func decodeToolResult(raw json.RawMessage) *mcp.CallToolResult {
	var result mcp.CallToolResult
	if err := json.Unmarshal(raw, &result); err == nil && (len(result.Content) > 0 || result.StructuredContent != nil || result.IsError) {
		return &result
	}
	return &mcp.CallToolResult{
		Content: []mcp.Content{
			&mcp.TextContent{Text: string(raw)},
		},
	}
}
