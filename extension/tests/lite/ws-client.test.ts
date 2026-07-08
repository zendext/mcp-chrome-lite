import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type Mock,
  vi,
} from 'vitest';

type MockSocketInstance = {
  readyState: number;
  close: ReturnType<typeof vi.fn>;
  send: (payload: string) => void;
  emitOpen: () => void;
  emitClose: () => void;
  emitError: () => void;
  emitMessage: (data: unknown) => void;
};

async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('lite websocket client', () => {
  let listener:
    | ((
        message: unknown,
        sender: unknown,
        sendResponse: (value: unknown) => void,
      ) => true | undefined)
    | null;
  let websocketCtor: ReturnType<typeof vi.fn>;
  let websocketSend: ReturnType<typeof vi.fn>;
  let websocketInstances: MockSocketInstance[];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetModules();
    listener = null;
    websocketCtor = vi.fn();
    websocketSend = vi.fn();
    websocketInstances = [];

    class MockWebSocket {
      static CONNECTING = 0;
      static OPEN = 1;
      static CLOSED = 3;

      readyState = MockWebSocket.CONNECTING;
      private readonly listeners = new Map<
        string,
        Array<(event?: unknown) => void>
      >();

      constructor(url: string) {
        websocketCtor(url);
        websocketInstances.push(this as unknown as MockSocketInstance);
      }

      addEventListener(event: string, callback: (event?: unknown) => void) {
        const listeners = this.listeners.get(event) ?? [];
        listeners.push(callback);
        this.listeners.set(event, listeners);
      }

      close = vi.fn(() => {
        this.readyState = MockWebSocket.CLOSED;
      });

      send(payload: string) {
        websocketSend(payload);
      }

      emitOpen() {
        this.readyState = MockWebSocket.OPEN;
        this.emit('open');
      }

      emitClose() {
        this.readyState = MockWebSocket.CLOSED;
        this.emit('close');
      }

      emitError() {
        this.emit('error');
      }

      emitMessage(data: unknown) {
        this.emit('message', { data });
      }

      private emit(event: string, payload?: unknown) {
        for (const callback of this.listeners.get(event) ?? []) {
          callback(payload);
        }
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

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens websocket during background initialization', async () => {
    const { initLiteWebSocketClient } = await import(
      '@/entrypoints/background/lite/ws-client'
    );

    initLiteWebSocketClient();
    await flushPromises();

    expect(websocketCtor).toHaveBeenCalledWith(
      'ws://127.0.0.1:12306/extension',
    );
  });

  it('restores a stored websocket endpoint during initialization', async () => {
    (chrome.storage.local.get as Mock).mockResolvedValue({
      mcpChromeLiteEndpoint: 'ws://127.0.0.1:56789/extension',
    });

    const { initLiteWebSocketClient } = await import(
      '@/entrypoints/background/lite/ws-client'
    );

    initLiteWebSocketClient();
    await flushPromises();

    expect(websocketCtor).toHaveBeenCalledWith(
      'ws://127.0.0.1:56789/extension',
    );
  });

  it('does not open a duplicate websocket when already connecting', async () => {
    const { initLiteWebSocketClient } = await import(
      '@/entrypoints/background/lite/ws-client'
    );
    initLiteWebSocketClient();
    await flushPromises();

    listener?.({ type: 'lite_connect' }, {}, vi.fn());

    expect(websocketCtor).toHaveBeenCalledTimes(1);
  });

  it('connects to a user-configured websocket endpoint', async () => {
    const { initLiteWebSocketClient } = await import(
      '@/entrypoints/background/lite/ws-client'
    );
    initLiteWebSocketClient();
    await flushPromises();

    listener?.(
      {
        type: 'lite_set_endpoint',
        endpoint: 'ws://localhost:45678/custom-extension',
      },
      {},
      vi.fn(),
    );
    await flushPromises();

    expect(websocketCtor).toHaveBeenCalledWith(
      'ws://localhost:45678/custom-extension',
    );
    expect(websocketInstances[0]?.close).toHaveBeenCalled();
  });

  it('saves and connects with endpoint from explicit connect message', async () => {
    const { initLiteWebSocketClient } = await import(
      '@/entrypoints/background/lite/ws-client'
    );
    initLiteWebSocketClient();
    await flushPromises();

    listener?.(
      { type: 'lite_connect', endpoint: 'ws://127.0.0.1:56789/extension' },
      {},
      vi.fn(),
    );
    await flushPromises();

    expect(chrome.storage.local.set).toHaveBeenCalledWith({
      mcpChromeLiteEndpoint: 'ws://127.0.0.1:56789/extension',
    });
    expect(websocketCtor).toHaveBeenCalledWith(
      'ws://127.0.0.1:56789/extension',
    );
  });

  it('announces readiness and sends a heartbeat after websocket opens', async () => {
    const { initLiteWebSocketClient } = await import(
      '@/entrypoints/background/lite/ws-client'
    );
    initLiteWebSocketClient();
    await flushPromises();

    websocketInstances[0]?.emitOpen();

    expect(websocketSend).toHaveBeenCalledWith(
      JSON.stringify({ type: 'extension_ready' }),
    );

    vi.advanceTimersByTime(20_000);

    expect(websocketSend).toHaveBeenCalledWith(
      expect.stringContaining('"type":"extension_heartbeat"'),
    );
  });

  it('reconnects after the websocket closes', async () => {
    const { initLiteWebSocketClient } = await import(
      '@/entrypoints/background/lite/ws-client'
    );
    initLiteWebSocketClient();
    await flushPromises();

    websocketInstances[0]?.emitClose();

    expect(websocketCtor).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1999);
    expect(websocketCtor).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(websocketCtor).toHaveBeenCalledTimes(2);
  });

  it('ignores stale close events from a replaced websocket', async () => {
    const { initLiteWebSocketClient } = await import(
      '@/entrypoints/background/lite/ws-client'
    );
    initLiteWebSocketClient();
    await flushPromises();

    const replacedSocket = websocketInstances[0];
    listener?.(
      { type: 'lite_connect', endpoint: 'ws://127.0.0.1:56789/extension' },
      {},
      vi.fn(),
    );
    await flushPromises();

    replacedSocket?.emitClose();
    vi.advanceTimersByTime(2000);

    expect(websocketCtor).toHaveBeenCalledTimes(2);
  });
});
