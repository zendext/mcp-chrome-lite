# mcp-chrome-lite Implementation Plan

## Phase 1: Documentation

- Add the lite architecture document.
- Add this implementation plan.
- Update the README with lite usage and development commands.

## Phase 2: Go MCP Server

- Create a Go module under `server`.
- Implement retained tool metadata in Go.
- Implement an extension bridge that accepts one active WebSocket connection.
- Implement stdio MCP server startup.
- Register every retained MCP tool and forward calls to the extension bridge.
- Return a clear tool-level error when no extension is connected.

## Phase 3: WXT Solid Extension

- Replace legacy entrypoints with a Solid popup and a minimal background service
  worker.
- Remove options, sidepanel, welcome, workflow, agent, local model, and Web
  Editor entrypoints from the build.
- Connect background to the user-configured WebSocket endpoint.
- Dispatch retained tool requests to browser tool executors.
- Show connection state and endpoint in the popup.

## Phase 4: Cleanup

- Remove the old Node server scripts and dependencies.
- Remove legacy UI and model/workflow dependencies from the extension package.
- Simplify root scripts to build the shared package, Go server, and extension.
- Keep only unit tests and manual smoke instructions.

## Verification

Run:

```bash
go test ./...
pnpm --filter mcp-chrome-lite-shared build
pnpm --filter mcp-chrome-lite-extension test
pnpm --filter mcp-chrome-lite-extension build
```

Manual smoke:

1. Start Codex or another MCP client with `mcp-chrome-lite`.
2. Load the extension in Chrome.
3. Invoke `get_windows_and_tabs` once and copy the reported port into the popup.
4. Click `Connect` and confirm the popup reports that the extension is connected.
5. Invoke `get_windows_and_tabs`, `chrome_screenshot`, `chrome_read_page`,
   `chrome_javascript`, and `chrome_network_capture`.
6. Stop Chrome or unload the extension and confirm tool calls return the
   extension-not-connected error.
