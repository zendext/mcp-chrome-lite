import { describe, expect, it } from 'vitest';
import { buildWsEndpoint, connectionMessage } from '@/entrypoints/background/lite/connection-state';

describe('lite connection state', () => {
  it('builds the default local websocket endpoint', () => {
    expect(buildWsEndpoint()).toBe('ws://127.0.0.1:12306/extension');
  });

  it('builds an endpoint with a custom host and port', () => {
    expect(buildWsEndpoint(45678, 'localhost')).toBe('ws://localhost:45678/extension');
  });

  it('explains that Codex or another MCP client must start the server when disconnected', () => {
    expect(connectionMessage(false)).toContain('Start Codex');
  });
});
