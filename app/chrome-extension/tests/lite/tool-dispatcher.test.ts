import { describe, expect, it } from 'vitest';
import { dispatchTool } from '@/entrypoints/background/lite/tool-dispatcher';

describe('lite tool dispatcher', () => {
  it('returns an error for unknown tools', async () => {
    const result = await dispatchTool({ name: 'search_tabs_content', args: {} });

    expect(result.status).toBe('error');
    expect(result.error).toContain('not registered');
  });
});
