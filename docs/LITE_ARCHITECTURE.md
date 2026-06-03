# mcp-chrome-lite Architecture

This document defines the target architecture for `mcp-chrome-lite`.

## Goal

`mcp-chrome-lite` is a stripped-down Chrome MCP bridge. It keeps browser control
and debugging tools, while removing recording, replay, workflows, agent chat,
local models, semantic search, visual editing, and extra UI surfaces.

## Runtime Architecture

```text
Codex / Code Agent
  <-> stdio MCP
mcp-chrome-lite Go server
  <-> ws://127.0.0.1:<tool-assigned-port>/extension
WXT Solid Chrome extension
  <-> Chrome APIs / injected helper scripts
Chrome browser
```

The MCP server is started by the MCP client through stdio. It does not bind an
extension WebSocket port during MCP initialization. The first Chrome tool call
starts the local WebSocket listener and returns the selected port when the
extension is not connected.

## Server

The Go server has two responsibilities:

- Serve MCP over stdio.
- Accept exactly one active Chrome extension connection over WebSocket.

MCP initialization and tool listing must work even when the extension is not
connected. Tool calls that require Chrome return a tool-level error until the
extension connects. That error includes the port the user should enter in the
extension popup.

Default WebSocket endpoint shape:

```text
ws://127.0.0.1:<tool-assigned-port>/extension
```

The port is random by default on first tool use. It may be pinned with `--port`
or `MCP_CHROME_PORT` for a fixed one-agent-to-one-profile setup.

## Extension

The extension is built with WXT and Solid.js. It keeps only:

- background service worker
- popup
- content/injected helper scripts needed by retained tools

The popup is informational. It shows whether the extension is connected to the
server and the configured WebSocket endpoint. When an agent reports an assigned
port, enter that port in the popup and click `Connect`.

## Extension WebSocket Protocol

Server-to-extension tool request:

```json
{
  "id": "request-id",
  "type": "call_tool",
  "name": "chrome_screenshot",
  "args": {}
}
```

Extension-to-server response:

```json
{
  "id": "request-id",
  "type": "tool_result",
  "status": "success",
  "result": {
    "content": [{ "type": "text", "text": "..." }]
  }
}
```

Error response:

```json
{
  "id": "request-id",
  "type": "tool_result",
  "status": "error",
  "error": "message"
}
```

## Retained Tools

- `get_windows_and_tabs`
- `chrome_navigate`
- `chrome_switch_tab`
- `chrome_close_tabs`
- `chrome_read_page`
- `chrome_computer`
- `chrome_screenshot`
- `chrome_click_element`
- `chrome_fill_or_select`
- `chrome_keyboard`
- `chrome_get_web_content`
- `chrome_get_interactive_elements`
- `chrome_request_element_selection`
- `chrome_javascript`
- `chrome_console`
- `chrome_network_request`
- `chrome_network_capture`
- `performance_start_trace`
- `performance_stop_trace`
- `performance_analyze_insight`
- `chrome_upload_file`
- `chrome_handle_download`
- `chrome_handle_dialog`

## Removed Features

- `search_tabs_content`
- record/replay and dynamic `flow.*` tools
- workflows
- agent chat and `/agent/*` routes
- local/semantic model support
- vector database and offscreen embedding workers
- Web Editor
- Quick Panel
- sidepanel/options/welcome pages
- Native Messaging
- HTTP MCP endpoint
- stdio proxy
- E2E test suite
