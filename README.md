# mcp-chrome-lite

`mcp-chrome-lite` provides a small Chrome MCP bridge for local code agents. The
Chrome extension is displayed as **Chrome MCP Bridge**.

This repository is forked from the original Chrome MCP project, but it keeps only
the core local bridge functionality and uses a different architecture: a Go MCP
server talks to a lightweight Chrome extension over a local WebSocket.

## Install From Release

Download these assets from the latest GitHub release:

- `mcp-chrome-lite-extension-*-chrome.zip`
- `mcp-chrome-lite-linux-amd64`
- `mcp-chrome-lite-darwin-arm64`
- `mcp-chrome-lite-windows-amd64.exe`

Install the Go MCP server binary:

```bash
chmod +x mcp-chrome-lite-linux-amd64
mv mcp-chrome-lite-linux-amd64 ~/.local/bin/mcp-chrome-lite
```

For macOS Apple Silicon, use the Darwin binary instead:

```bash
chmod +x mcp-chrome-lite-darwin-arm64
mv mcp-chrome-lite-darwin-arm64 ~/.local/bin/mcp-chrome-lite
```

Windows should also work in theory. Put the executable somewhere stable, such as
`%USERPROFILE%\go\bin\mcp-chrome-lite.exe`, and make sure that directory is on
`PATH`. You can also point Codex directly at the absolute `.exe` path.

Install the Chrome extension by opening `chrome://extensions`, enabling
Developer mode, and dragging the extension zip onto the extensions page:

```text
mcp-chrome-lite-extension-*-chrome.zip
```

If Chrome does not accept the zip on your machine, unzip it, choose **Load
unpacked**, and select the extracted directory.

## Codex Configuration

Add this to `~/.codex/config.toml`:

```toml
[mcp_servers.chrome-mcp-bridge]
command = "/home/you/.local/bin/mcp-chrome-lite"
```

Use the real absolute path for your machine.

On Windows, use either a `PATH` entry:

```toml
[mcp_servers.chrome-mcp-bridge]
command = "mcp-chrome-lite.exe"
```

or the absolute executable path:

```toml
[mcp_servers.chrome-mcp-bridge]
command = 'C:\Users\you\go\bin\mcp-chrome-lite.exe'
```

## Connect Chrome

1. Start a new Codex session.
2. Call a Chrome MCP tool such as `get_windows_and_tabs`.
3. The first call will return a message like:

```text
Chrome extension is not connected. Open the Chrome MCP Bridge popup, paste this endpoint, click Connect, then retry: ws://127.0.0.1:58761/extension
```

4. Open the **Chrome MCP Bridge** popup.
5. Paste the endpoint from the tool result:

```text
ws://127.0.0.1:58761/extension
```

6. Click **Connect**.
7. Call the Chrome MCP tool again.

The server chooses a random free port on first tool use, so multiple agents can
start without fighting over the same port. To pin a port, set `MCP_CHROME_PORT`
or pass `--port`.

## Development

```bash
pnpm install
pnpm run build
pnpm run typecheck
pnpm --filter mcp-chrome-lite-extension test
```

Build the local server binary:

```bash
pnpm run build:server
```

Build the extension:

```bash
pnpm --filter mcp-chrome-lite-extension zip
```
