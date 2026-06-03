// @vitest-environment node

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { injectScriptsPlugin } from '../../build/inject-scripts-plugin';

describe('inject scripts plugin', () => {
  it('compiles TypeScript inject scripts into JavaScript files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'mcp-chrome-lite-inject-'));
    try {
      await writeFile(
        join(root, 'example.ts'),
        'const answer: number = 42; globalThis.__answer = answer;',
      );

      const outDir = join(root, 'out');
      const plugin = injectScriptsPlugin({
        srcDir: root,
        outSubdir: 'inject-scripts',
      });

      await plugin.writeBundle?.call({} as never, { dir: outDir } as never);

      const output = await readFile(
        join(outDir, 'inject-scripts', 'example.js'),
        'utf8',
      );
      expect(output).toContain('answer');
      expect(output).not.toContain(': number');
    } finally {
      await rm(root, { force: true, recursive: true });
    }
  });
});
