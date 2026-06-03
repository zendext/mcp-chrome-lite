import type { PickedElement } from 'mcp-chrome-lite-shared';

export interface ElementPickerControllerOptions {
  hostId?: string;
  zIndex?: number;
  onCancel?: () => void;
  onConfirm?: () => void;
  onSetActiveRequest?: (requestId: string) => void;
  onClearSelection?: (requestId: string) => void;
}

export interface ElementPickerController {
  show: (state: ElementPickerUiState) => void;
  update: (patch: ElementPickerUiPatch) => void;
  hide: () => void;
  isVisible: () => boolean;
  dispose: () => void;
}

export interface ElementPickerUiRequest {
  id: string;
  name: string;
  description?: string;
}

export interface ElementPickerUiState {
  sessionId: string;
  requests: ElementPickerUiRequest[];
  activeRequestId: string | null;
  selections: Record<string, PickedElement | null>;
  deadlineTs: number;
  errorMessage: string | null;
}

export type ElementPickerUiPatch = Partial<
  Omit<ElementPickerUiState, 'sessionId'>
> & {
  sessionId: string;
};

const DEFAULT_HOST_ID = '__mcp_chrome_lite_element_picker__';
const DEFAULT_Z_INDEX = 2147483647;

const styles = `
  :host {
    all: initial;
    color-scheme: light;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .panel {
    position: fixed;
    right: 16px;
    bottom: 16px;
    width: min(420px, calc(100vw - 32px));
    max-height: min(560px, calc(100vh - 32px));
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    border: 1px solid #d4d8df;
    border-radius: 8px;
    background: #ffffff;
    color: #1f2328;
    box-shadow: 0 16px 40px rgba(31, 35, 40, 0.18);
    box-sizing: border-box;
  }

  .header,
  .actions,
  .item-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  .title {
    margin: 0;
    font-size: 14px;
    line-height: 20px;
    font-weight: 700;
  }

  .timer {
    font: 12px/18px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    color: #57606a;
    white-space: nowrap;
  }

  .hint,
  .desc,
  .selected {
    margin: 0;
    font-size: 12px;
    line-height: 17px;
    color: #57606a;
  }

  .error {
    margin: 0;
    padding: 8px 10px;
    border: 1px solid #ffb3b8;
    border-radius: 6px;
    background: #fff1f2;
    color: #a40e26;
    font-size: 12px;
    line-height: 17px;
  }

  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    overflow: auto;
  }

  .item {
    padding: 10px;
    border: 1px solid #d4d8df;
    border-radius: 6px;
    background: #f6f8fa;
    cursor: pointer;
  }

  .item.active {
    border-color: #0969da;
    background: #eef6ff;
  }

  .name {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    line-height: 18px;
    font-weight: 650;
  }

  .badge {
    flex: none;
    padding: 2px 7px;
    border-radius: 999px;
    border: 1px solid #d4d8df;
    background: #ffffff;
    color: #57606a;
    font-size: 11px;
    line-height: 16px;
  }

  .badge.selected {
    border-color: #2da44e;
    color: #1a7f37;
  }

  .selected {
    margin-top: 6px;
    word-break: break-word;
  }

  button {
    height: 30px;
    padding: 0 10px;
    border: 1px solid #d4d8df;
    border-radius: 6px;
    background: #ffffff;
    color: #1f2328;
    font: 600 12px/18px inherit;
    cursor: pointer;
  }

  button.primary {
    border-color: #0969da;
    background: #0969da;
    color: #ffffff;
  }

  button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }
`;

function createHost(
  hostId: string,
  zIndex: number,
): { host: HTMLElement; root: ShadowRoot } {
  let host = document.getElementById(hostId);
  if (!host) {
    host = document.createElement('div');
    host.id = hostId;
    document.documentElement.appendChild(host);
  }
  host.style.position = 'relative';
  host.style.zIndex = String(zIndex);

  const root = host.shadowRoot || host.attachShadow({ mode: 'open' });
  return { host, root };
}

function formatSeconds(deadlineTs: number): string {
  const remaining = Math.max(0, Math.ceil((deadlineTs - Date.now()) / 1000));
  return `${remaining}s`;
}

function selectedLabel(element: PickedElement | null | undefined): string {
  if (!element) return '';
  const tag = element.tagName ? element.tagName.toLowerCase() : 'element';
  const text = element.text?.trim();
  return text ? `${tag}: ${text.slice(0, 80)}` : `${tag}: ${element.selector}`;
}

export function createElementPickerController(
  options: ElementPickerControllerOptions = {},
): ElementPickerController {
  const hostId = options.hostId || DEFAULT_HOST_ID;
  const zIndex = options.zIndex || DEFAULT_Z_INDEX;
  let state: ElementPickerUiState | null = null;
  let host: HTMLElement | null = null;
  let root: ShadowRoot | null = null;
  let timer: number | undefined;

  const render = () => {
    if (!state || !root) return;

    const selectedCount = Object.values(state.selections).filter(
      Boolean,
    ).length;
    root.innerHTML = '';

    const style = document.createElement('style');
    style.textContent = styles;
    root.appendChild(style);

    const panel = document.createElement('section');
    panel.className = 'panel';

    const header = document.createElement('div');
    header.className = 'header';
    header.innerHTML = `<h2 class="title">Select elements</h2><span class="timer">${formatSeconds(state.deadlineTs)}</span>`;
    panel.appendChild(header);

    const hint = document.createElement('p');
    hint.className = 'hint';
    hint.textContent = 'Pick the requested elements on the page, then confirm.';
    panel.appendChild(hint);

    if (state.errorMessage) {
      const error = document.createElement('p');
      error.className = 'error';
      error.textContent = state.errorMessage;
      panel.appendChild(error);
    }

    const list = document.createElement('div');
    list.className = 'list';
    for (const request of state.requests) {
      const selected = state.selections[request.id];
      const item = document.createElement('article');
      item.className =
        request.id === state.activeRequestId ? 'item active' : 'item';
      item.tabIndex = 0;
      item.addEventListener('click', () =>
        options.onSetActiveRequest?.(request.id),
      );

      const itemHeader = document.createElement('div');
      itemHeader.className = 'item-header';

      const name = document.createElement('div');
      name.className = 'name';
      name.textContent = request.name;
      itemHeader.appendChild(name);

      const badge = document.createElement('span');
      badge.className = selected ? 'badge selected' : 'badge';
      badge.textContent = selected ? 'Selected' : 'Waiting';
      itemHeader.appendChild(badge);
      item.appendChild(itemHeader);

      if (request.description) {
        const desc = document.createElement('p');
        desc.className = 'desc';
        desc.textContent = request.description;
        item.appendChild(desc);
      }

      if (selected) {
        const picked = document.createElement('p');
        picked.className = 'selected';
        picked.textContent = selectedLabel(selected);
        item.appendChild(picked);

        const clear = document.createElement('button');
        clear.type = 'button';
        clear.textContent = 'Clear';
        clear.addEventListener('click', (event) => {
          event.stopPropagation();
          options.onClearSelection?.(request.id);
        });
        item.appendChild(clear);
      }

      list.appendChild(item);
    }
    panel.appendChild(list);

    const actions = document.createElement('div');
    actions.className = 'actions';

    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.textContent = 'Cancel';
    cancel.addEventListener('click', () => options.onCancel?.());
    actions.appendChild(cancel);

    const confirm = document.createElement('button');
    confirm.type = 'button';
    confirm.className = 'primary';
    confirm.textContent = 'Confirm';
    confirm.disabled = selectedCount === 0;
    confirm.addEventListener('click', () => options.onConfirm?.());
    actions.appendChild(confirm);

    panel.appendChild(actions);
    root.appendChild(panel);
  };

  const startTimer = () => {
    if (timer !== undefined) window.clearInterval(timer);
    timer = window.setInterval(render, 1000);
  };

  return {
    show(nextState) {
      const created = createHost(hostId, zIndex);
      host = created.host;
      root = created.root;
      state = nextState;
      startTimer();
      render();
    },
    update(patch) {
      if (!state || patch.sessionId !== state.sessionId) return;
      state = { ...state, ...patch };
      render();
    },
    hide() {
      if (timer !== undefined) window.clearInterval(timer);
      timer = undefined;
      state = null;
      if (root) root.innerHTML = '';
      host?.remove();
      host = null;
      root = null;
    },
    isVisible() {
      return Boolean(state && host);
    },
    dispose() {
      this.hide();
    },
  };
}
