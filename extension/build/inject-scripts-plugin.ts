import { readdir, rm } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';

import { build } from 'esbuild';

export interface InjectScriptsPluginOptions {
  srcDir?: string;
  outSubdir?: string;
}

interface RollupOutputOptions {
  dir?: string;
}

async function collectTypeScriptFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) {
        return collectTypeScriptFiles(path);
      }
      return entry.isFile() && entry.name.endsWith('.ts') ? [path] : [];
    }),
  );
  return files.flat();
}

export function injectScriptsPlugin(options: InjectScriptsPluginOptions = {}) {
  const srcDir = resolve(options.srcDir ?? 'inject-scripts-src');
  const outSubdir = options.outSubdir ?? 'inject-scripts';
  const builtOutDirs = new Set<string>();

  return {
    name: 'mcp-chrome-lite-inject-scripts',
    buildStart() {
      builtOutDirs.clear();
    },
    async writeBundle(outputOptions: RollupOutputOptions) {
      if (!outputOptions.dir) {
        throw new Error(
          'Cannot build inject scripts without an output directory.',
        );
      }

      const entryPoints = await collectTypeScriptFiles(srcDir);
      const outdir = join(outputOptions.dir, outSubdir);
      if (builtOutDirs.has(outdir)) {
        return;
      }
      builtOutDirs.add(outdir);

      await rm(outdir, { force: true, recursive: true });

      if (entryPoints.length === 0) {
        return;
      }

      await build({
        absWorkingDir: srcDir,
        entryPoints: entryPoints.map((entry) => relative(srcDir, entry)),
        outdir,
        allowOverwrite: true,
        bundle: false,
        format: 'iife',
        platform: 'browser',
        sourcemap: false,
        target: 'es2015',
        write: true,
      });
    },
  };
}
