import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('lite popup', () => {
  it('does not render a separate refresh action', () => {
    const popupSource = readFileSync(
      join(process.cwd(), 'entrypoints/popup/main.tsx'),
      'utf8',
    );

    expect(popupSource).toContain('Connect');
    expect(popupSource).toContain('Copy MCP config');
    expect(popupSource).not.toContain('Refresh');
  });
});
