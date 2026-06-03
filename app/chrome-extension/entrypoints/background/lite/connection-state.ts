export const DEFAULT_WS_HOST = '127.0.0.1';
export const DEFAULT_WS_PORT = 12306;
export const WS_PATH = '/extension';

export function buildWsEndpoint(port: number = DEFAULT_WS_PORT, host = DEFAULT_WS_HOST): string {
  return `ws://${host}:${port}${WS_PATH}`;
}

export function connectionMessage(connected: boolean): string {
  if (connected) {
    return 'Connected to mcp-chrome-lite server.';
  }
  return 'Start Codex or another MCP client configured with mcp-chrome-lite, then click Connect.';
}
