import { createEffect, createSignal, onCleanup, onMount } from 'solid-js';
import { render } from 'solid-js/web';
import '../styles/tailwind.css';
import './style.css';
import { connectionMessage } from '../background/lite/connection-state';

interface LiteStatus {
  connected: boolean;
  endpoint: string;
}

function Popup() {
  const [status, setStatus] = createSignal<LiteStatus>({
    connected: false,
    endpoint: 'ws://127.0.0.1:12306/extension',
  });
  const [endpointInput, setEndpointInput] = createSignal(
    'ws://127.0.0.1:12306/extension',
  );
  const [error, setError] = createSignal('');
  const [notice, setNotice] = createSignal('');

  const refresh = async () => {
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'lite_get_status',
      });
      const endpoint = response?.endpoint || 'ws://127.0.0.1:12306/extension';
      setStatus({
        connected: Boolean(response?.connected),
        endpoint,
      });
      setEndpointInput(endpoint);
      setError('');
    } catch (err) {
      setStatus((current) => ({ ...current, connected: false }));
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const connect = async () => {
    try {
      const endpoint = endpointInput().trim();
      if (!isValidEndpoint(endpoint)) {
        setNotice('');
        setError('Endpoint must be a ws:// or wss:// URL with host and port.');
        return;
      }
      const response = await chrome.runtime.sendMessage({
        type: 'lite_connect',
        endpoint,
      });
      if (!response?.success) {
        setStatus((current) => ({ ...current, connected: false }));
        setNotice('');
        setError(response?.error || 'Failed to connect.');
        return;
      }
      await refresh();
      setNotice('');
      setError('');
    } catch (err) {
      setStatus((current) => ({ ...current, connected: false }));
      setNotice('');
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  const copyConfig = async () => {
    const config = [
      '[mcp_servers.chrome-mcp-bridge]',
      'command = "mcp-chrome-lite"',
      '',
    ].join('\n');
    try {
      await navigator.clipboard.writeText(config);
      setNotice('MCP config copied.');
      setError('');
    } catch (err) {
      setNotice('');
      setError(
        err instanceof Error ? err.message : 'Failed to copy MCP config.',
      );
    }
  };

  onMount(() => {
    void refresh();
    const listener = (message: {
      type?: string;
      connected?: boolean;
      endpoint?: string;
    }) => {
      if (message?.type === 'lite_status_changed') {
        setStatus({
          connected: Boolean(message.connected),
          endpoint: message.endpoint || status().endpoint,
        });
      }
    };
    chrome.runtime.onMessage.addListener(listener);
    onCleanup(() => chrome.runtime.onMessage.removeListener(listener));
  });

  createEffect(() => {
    setEndpointInput(status().endpoint);
  });

  const isValidEndpoint = (endpoint: string) => {
    try {
      const url = new URL(endpoint);
      return (
        (url.protocol === 'ws:' || url.protocol === 'wss:') &&
        Boolean(url.hostname) &&
        Boolean(url.port) &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  };

  return (
    <main class="lite-popup">
      <header class="lite-header">
        <div>
          <h1>Chrome MCP Bridge</h1>
          <p>{connectionMessage(status().connected)}</p>
        </div>
        <span
          class={status().connected ? 'status status-on' : 'status status-off'}
        >
          {status().connected ? 'Connected' : 'Waiting'}
        </span>
      </header>

      <section class="lite-section">
        <label for="endpoint">Extension WebSocket</label>
        <input
          id="endpoint"
          value={endpointInput()}
          onInput={(event: InputEvent & { currentTarget: HTMLInputElement }) =>
            setEndpointInput(event.currentTarget.value)
          }
        />
      </section>

      <section class="lite-actions">
        <button type="button" onClick={connect}>
          Connect
        </button>
        <button type="button" onClick={copyConfig}>
          Copy MCP config
        </button>
      </section>

      {notice() ? <p class="lite-notice">{notice()}</p> : null}
      {error() ? <p class="lite-error">{error()}</p> : null}
    </main>
  );
}

render(() => <Popup />, document.getElementById('app')!);
