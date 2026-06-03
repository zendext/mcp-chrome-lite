# mcp-chrome-lite

`mcp-chrome-lite` provides a small Chrome MCP bridge for local code agents. The
Chrome extension is displayed as **Chrome MCP Bridge**.

## Install From Release

Download these assets from the latest GitHub release:

- `mcp-chrome-lite-extension-0.1.1-chrome.zip`
- `mcp-chrome-lite-linux-amd64`
- or `mcp-chrome-lite-darwin-arm64`

Install the server binary:

```bash
chmod +x mcp-chrome-lite-linux-amd64
mv mcp-chrome-lite-linux-amd64 ~/.local/bin/mcp-chrome-lite
```

For macOS Apple Silicon, use the Darwin binary instead:

```bash
chmod +x mcp-chrome-lite-darwin-arm64
mv mcp-chrome-lite-darwin-arm64 ~/.local/bin/mcp-chrome-lite
```

Install the Chrome extension:

```bash
unzip mcp-chrome-lite-extension-0.1.1-chrome.zip -d chrome-mcp-bridge
```

Then open `chrome://extensions`, enable Developer mode, choose **Load
unpacked**, and select the `chrome-mcp-bridge` directory.

## Codex Configuration

Add this to `~/.codex/config.toml`:

```toml
[mcp_servers.chrome-mcp-bridge]
command = "/home/you/.local/bin/mcp-chrome-lite"
```

Use the real absolute path for your machine.

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
