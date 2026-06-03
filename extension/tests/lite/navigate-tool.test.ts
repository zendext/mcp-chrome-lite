import { beforeEach, describe, expect, it, vi } from 'vitest';
import { navigateTool } from '@/entrypoints/background/tools/browser/common';

const chromeMock = chrome as unknown as {
  runtime: {
    lastError?: chrome.runtime.LastError;
  };
  tabs: {
    query: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  windows: {
    getLastFocused: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

describe('navigate tool', () => {
  beforeEach(() => {
    chromeMock.runtime.lastError = undefined;
    chromeMock.windows = {
      getLastFocused: vi.fn().mockResolvedValue({ id: 10 }),
      update: vi.fn().mockResolvedValue({}),
    };
    chromeMock.tabs.query.mockResolvedValue([]);
    chromeMock.tabs.create.mockResolvedValue({
      id: 123,
      windowId: 10,
      url: 'data:text/html,hello',
    } as chrome.tabs.Tab);
  });

  it('opens data URLs without passing an invalid match pattern to tabs.query', async () => {
    chromeMock.tabs.query.mockImplementation(
      async (queryInfo: chrome.tabs.QueryInfo) => {
        const patterns = Array.isArray(queryInfo.url)
          ? queryInfo.url
          : [queryInfo.url];
        if (patterns.includes('data:///*')) {
          throw new Error("Invalid url pattern 'data:///*'");
        }
        return [];
      },
    );

    const result = await navigateTool.execute({
      url: 'data:text/html,hello',
      background: true,
    });

    expect(result.isError).toBe(false);
    expect(chromeMock.tabs.create).toHaveBeenCalledWith({
      url: 'data:text/html,hello',
      windowId: 10,
      active: false,
    });
    expect(chromeMock.tabs.query).not.toHaveBeenCalledWith({
      url: expect.arrayContaining(['data:///*']),
    });
  });
});
