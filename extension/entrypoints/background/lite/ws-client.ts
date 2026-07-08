import {
  buildWsEndpoint,
  DEFAULT_WS_HOST,
  DEFAULT_WS_PORT,
} from './connection-state';
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
const RECONNECT_DELAY_MS = 2000;
const HEARTBEAT_INTERVAL_MS = 20000;

let socket: WebSocket | null = null;
let currentEndpoint = buildWsEndpoint(DEFAULT_WS_PORT, DEFAULT_WS_HOST);
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

export function initLiteWebSocketClient(): void {
  void loadEndpoint().then((endpoint) => {
    currentEndpoint = endpoint;
    void updateStatus(false, currentEndpoint);
    connect();
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
        void chrome.storage.local
          .set({ [ENDPOINT_STORAGE_KEY]: endpoint })
          .then(() => {
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

      void chrome.storage.local
        .set({ [ENDPOINT_STORAGE_KEY]: endpoint })
        .then(() => {
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
        void chrome.storage.local
          .set({ [ENDPOINT_STORAGE_KEY]: endpoint })
          .then(() => {
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
  if (
    socket?.readyState === WebSocket.OPEN ||
    socket?.readyState === WebSocket.CONNECTING
  ) {
    return;
  }

  clearReconnectTimer();

  const activeSocket = new WebSocket(currentEndpoint);
  socket = activeSocket;

  activeSocket.addEventListener('open', () => {
    if (socket !== activeSocket) {
      return;
    }
    activeSocket.send(JSON.stringify({ type: 'extension_ready' }));
    startHeartbeat();
    void updateStatus(true, currentEndpoint);
  });

  activeSocket.addEventListener('message', (event) => {
    if (socket !== activeSocket) {
      return;
    }
    void handleServerMessage(event.data);
  });

  activeSocket.addEventListener('close', () => {
    if (socket !== activeSocket) {
      return;
    }
    socket = null;
    stopHeartbeat();
    void updateStatus(false, currentEndpoint);
    scheduleReconnect();
  });

  activeSocket.addEventListener('error', () => {
    if (socket !== activeSocket) {
      return;
    }
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
  clearReconnectTimer();
  stopHeartbeat();
  if (socket) {
    socket.close();
    socket = null;
  }
  connect();
}

function scheduleReconnect(): void {
  if (reconnectTimer) {
    return;
  }
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, RECONNECT_DELAY_MS);
}

function clearReconnectTimer(): void {
  if (!reconnectTimer) {
    return;
  }
  clearTimeout(reconnectTimer);
  reconnectTimer = null;
}

function startHeartbeat(): void {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      stopHeartbeat();
      return;
    }

    socket.send(
      JSON.stringify({
        type: 'extension_heartbeat',
        ts: Date.now(),
      }),
    );
  }, HEARTBEAT_INTERVAL_MS);
}

function stopHeartbeat(): void {
  if (!heartbeatTimer) {
    return;
  }
  clearInterval(heartbeatTimer);
  heartbeatTimer = null;
}

async function updateStatus(
  connected: boolean,
  endpoint: string,
): Promise<void> {
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

  const response = await dispatchTool({
    name: request.name,
    args: request.args ?? {},
  });
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
