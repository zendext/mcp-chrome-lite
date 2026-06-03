import { beforeEach, describe, expect, it, type Mock, vi } from 'vitest';

describe('lite websocket client', () => {
  let listener:
    | ((
        message: unknown,
        sender: unknown,
        sendResponse: (value: unknown) => void,
      ) => true | undefined)
    | null;
  let websocketCtor: ReturnType<typeof vi.fn>;
  let websocketOpen: (() => void) | null;
  let websocketSend: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.resetModules();
    listener = null;
    websocketCtor = vi.fn();
    websocketOpen = null;
    websocketSend = vi.fn();

    class MockWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      readyState = MockWebSocket.CONNECTING;

      constructor(url: string) {
        websocketCtor(url);
      }

      addEventListener(event: string, callback: () => void) {
        if (event === 'open') {
          websocketOpen = callback;
        }
      }
      close() {}
      send(payload: string) {
        websocketSend(payload);
      }
    }

    vi.stubGlobal('WebSocket', MockWebSocket);

    (chrome.storage.local.get as Mock).mockResolvedValue({});
    (chrome.storage.local.set as Mock).mockResolvedValue(undefined);
    (chrome.runtime.sendMessage as Mock).mockResolvedValue(undefined);
    (chrome.runtime.onMessage.addListener as Mock).mockImplementation(
      (nextListener) => {
        listener = nextListener as typeof listener;
      },
    );
  });

  it('does not open websocket during background initialization', async () => {
    const { initLiteWebSocketClient } = await import(
      '@/entrypoints/background/lite/ws-client'
    );

    initLiteWebSocketClient();
    await Promise.resolve();
    await Promise.resolve();

    expect(websocketCtor).not.toHaveBeenCalled();
  });

  it('opens websocket only after explicit connect message', async () => {
    const { initLiteWebSocketClient } = await import(
      '@/entrypoints/background/lite/ws-client'
    );
    initLiteWebSocketClient();

    listener?.({ type: 'lite_connect' }, {}, vi.fn());

    expect(websocketCtor).toHaveBeenCalledWith(
      'ws://127.0.0.1:12306/extension',
    );
  });

  it('connects to a user-configured websocket endpoint', async () => {
    const { initLiteWebSocketClient } = await import(
      '@/entrypoints/background/lite/ws-client'
    );
    initLiteWebSocketClient();

    listener?.(
      {
        type: 'lite_set_endpoint',
        endpoint: 'ws://localhost:45678/custom-extension',
      },
      {},
      vi.fn(),
    );
    await Promise.resolve();

    listener?.({ type: 'lite_connect' }, {}, vi.fn());

    expect(websocketCtor).toHaveBeenCalledWith(
      'ws://localhost:45678/custom-extension',
    );
  });

  it('saves and connects with endpoint from explicit connect message', async () => {
    const { initLiteWebSocketClient } = await import(
      '@/entrypoints/background/lite/ws-client'
    );
    initLiteWebSocketClient();

    listener?.(
      { type: 'lite_connect', endpoint: 'ws://127.0.0.1:56789/extension' },
      {},
      vi.fn(),
    );
    await Promise.resolve();

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      mcpChromeLiteEndpoint: 'ws://127.0.0.1:56789/extension',
    });
    expect(websocketCtor).toHaveBeenCalledWith(
      'ws://127.0.0.1:56789/extension',
    );
  });

  it('announces readiness after websocket opens', async () => {
    const { initLiteWebSocketClient } = await import(
      '@/entrypoints/background/lite/ws-client'
    );
    initLiteWebSocketClient();

    listener?.({ type: 'lite_connect' }, {}, vi.fn());
    websocketOpen?.();

    expect(websocketSend).toHaveBeenCalledWith(
      JSON.stringify({ type: 'extension_ready' }),
    );
  });
});
