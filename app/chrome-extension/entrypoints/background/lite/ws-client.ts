import { buildWsEndpoint, DEFAULT_WS_HOST, DEFAULT_WS_PORT } from './connection-state';
import { dispatchTool } from './tool-dispatcher';

interface ServerRequest {
  id?: string;
  type?: string;
  name?: string;
  args?: unknown;
}

const STORAGE_KEY = 'mcpChromeLiteConnection';
const ENDPOINT_STORAGE_KEY = 'mcpChromeLiteEndpoint';
const HOST_STORAGE_KEY = 'mcpChromeLiteHost';
const PORT_STORAGE_KEY = 'mcpChromeLitePort';

let socket: WebSocket | null = null;
let currentEndpoint = buildWsEndpoint(DEFAULT_WS_PORT, DEFAULT_WS_HOST);

export function initLiteWebSocketClient(): void {
  void loadEndpoint().then((endpoint) => {
    currentEndpoint = endpoint;
    void updateStatus(false, currentEndpoint);
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === 'lite_get_status') {
      sendResponse({
        connected: socket?.readyState === WebSocket.OPEN,
        endpoint: currentEndpoint,
      });
      return true;
    }

    if (message?.type === 'lite_connect') {
      const endpoint = normalizeEndpoint(message.endpoint);
      if (message.endpoint !== undefined && !endpoint) {
        sendResponse({ success: false, error: 'Invalid WebSocket endpoint' });
        return true;
      }

      if (endpoint) {
        void chrome.storage.local.set({ [ENDPOINT_STORAGE_KEY]: endpoint }).then(() => {
          currentEndpoint = endpoint;
          if (socket) {
            reconnect();
          } else {
            connect();
          }
          sendResponse({
            success: true,
            connected: socket?.readyState === WebSocket.OPEN,
            endpoint: currentEndpoint,
          });
        });
      } else {
        connect();
        sendResponse({
          success: true,
          connected: socket?.readyState === WebSocket.OPEN,
          endpoint: currentEndpoint,
        });
      }
      return true;
    }

    if (message?.type === 'lite_set_endpoint') {
      const endpoint = endpointFromMessage(message);
      if (!endpoint) {
        sendResponse({ success: false, error: 'Invalid WebSocket endpoint' });
        return true;
      }

      void chrome.storage.local.set({ [ENDPOINT_STORAGE_KEY]: endpoint }).then(() => {
        currentEndpoint = endpoint;
        if (socket) {
          reconnect();
        } else {
          void updateStatus(false, currentEndpoint);
        }
        sendResponse({ success: true });
      });
      return true;
    }

    if (message?.type === 'lite_set_port') {
      const nextPort = Number(message.port);
      if (isValidPort(nextPort)) {
        const endpoint = replaceEndpointPort(currentEndpoint, nextPort);
        void chrome.storage.local.set({ [ENDPOINT_STORAGE_KEY]: endpoint }).then(() => {
          currentEndpoint = endpoint;
          if (socket) {
            reconnect();
          } else {
            void updateStatus(false, currentEndpoint);
          }
          sendResponse({ success: true });
        });
      } else {
        sendResponse({ success: false, error: 'Invalid port' });
      }
      return true;
    }

    return undefined;
  });
}

async function loadEndpoint(): Promise<string> {
  const stored = await chrome.storage.local.get([
    ENDPOINT_STORAGE_KEY,
    HOST_STORAGE_KEY,
    PORT_STORAGE_KEY,
  ]);
  const endpoint = normalizeEndpoint(stored[ENDPOINT_STORAGE_KEY]);
  if (endpoint) {
    return endpoint;
  }

  const host = normalizeHost(stored[HOST_STORAGE_KEY]) || DEFAULT_WS_HOST;
  const value = Number(stored[PORT_STORAGE_KEY]);
  return buildWsEndpoint(isValidPort(value) ? value : DEFAULT_WS_PORT, host);
}

function connect(): void {
  if (socket?.readyState === WebSocket.OPEN || socket?.readyState === WebSocket.CONNECTING) {
    return;
  }

  socket = new WebSocket(currentEndpoint);

  socket.addEventListener('open', () => {
    socket?.send(JSON.stringify({ type: 'extension_ready' }));
    void updateStatus(true, currentEndpoint);
  });

  socket.addEventListener('message', (event) => {
    void handleServerMessage(event.data);
  });

  socket.addEventListener('close', () => {
    socket = null;
    void updateStatus(false, currentEndpoint);
  });

  socket.addEventListener('error', () => {
    void updateStatus(false, currentEndpoint);
  });
}

function endpointFromMessage(message: {
  endpoint?: unknown;
  host?: unknown;
  port?: unknown;
}): string {
  const endpoint = normalizeEndpoint(message.endpoint);
  if (endpoint) {
    return endpoint;
  }

  const host = normalizeHost(message.host);
  const port = Number(message.port);
  if (!host || !isValidPort(port)) {
    return '';
  }
  return buildWsEndpoint(port, host);
}

function normalizeEndpoint(endpoint: unknown): string {
  if (typeof endpoint !== 'string') {
    return '';
  }

  try {
    const url = new URL(endpoint.trim());
    if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
      return '';
    }
    if (!url.hostname || !url.port || url.username || url.password) {
      return '';
    }
    if (url.pathname === '/') {
      url.pathname = '/extension';
    }
    url.hash = '';
    return url.toString();
  } catch {
    return '';
  }
}

function replaceEndpointPort(endpoint: string, port: number): string {
  const url = new URL(endpoint);
  url.port = String(port);
  return url.toString();
}

function normalizeHost(host: unknown): string {
  if (typeof host !== 'string') {
    return '';
  }
  const value = host.trim();
  if (!value || value.includes('/') || value.includes(':')) {
    return '';
  }
  return value;
}

function isValidPort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

function reconnect(): void {
  if (socket) {
    socket.close();
    socket = null;
  }
  connect();
}

async function updateStatus(connected: boolean, endpoint: string): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEY]: {
      connected,
      endpoint,
      updatedAt: Date.now(),
    },
  });
  chrome.runtime
    .sendMessage({ type: 'lite_status_changed', connected, endpoint })
    .catch(() => undefined);
}

async function handleServerMessage(data: unknown): Promise<void> {
  const request = parseRequest(data);
  if (!request.id || request.type !== 'call_tool' || !request.name) {
    return;
  }

  const response = await dispatchTool({ name: request.name, args: request.args ?? {} });
  send({
    id: request.id,
    type: 'tool_result',
    status: response.status,
    result: response.result,
    error: response.error,
  });
}

function parseRequest(data: unknown): ServerRequest {
  if (typeof data !== 'string') {
    return {};
  }
  try {
    return JSON.parse(data) as ServerRequest;
  } catch {
    return {};
  }
}

function send(payload: unknown): void {
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }
  socket.send(JSON.stringify(payload));
}
