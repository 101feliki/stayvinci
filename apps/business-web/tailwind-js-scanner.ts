// Fallback for machines where Windows Application Control (Smart App Control)
// blocks Tailwind's native "oxide" scanner. Tailwind then falls back to a WASI
// build that cannot read files on Windows, so no utilities are generated.
//
// This plugin keeps Tailwind's own compiler (@tailwindcss/node) and only
// replaces the file scanner with a small JavaScript one. It is used only when
// the native scanner is unavailable; everywhere else (CI, macOS, Linux, other
// Windows machines) the official @tailwindcss/vite plugin runs unchanged.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { compile } from '@tailwindcss/node';
import type { Plugin } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCAN_EXT = /\.(tsx?|jsx?|html)$/;

/** True when Tailwind's native scanner can actually read files on this machine. */
export function nativeScannerWorks(): boolean {
  try {
    const require = createRequire(import.meta.url);
    const fromVite = createRequire(require.resolve('@tailwindcss/vite'));
    const { Scanner } = fromVite('@tailwindcss/oxide') as {
      Scanner: new (o: { sources: { base: string; pattern: string; negated: boolean }[] }) => {
        scan(): string[];
      };
    };
    const found = new Scanner({
      sources: [{ base: path.join(here, 'src'), pattern: '**/*', negated: false }],
    }).scan();
    return found.length > 0;
  } catch {
    return false;
  }
}

function walk(dir: string, out: string[]) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (SCAN_EXT.test(name)) out.push(full);
  }
}

/** Split source text into possible class candidates. Tailwind ignores anything invalid. */
function candidatesFrom(text: string, into: Set<string>) {
  for (const token of text.split(/[\s"'`]+/)) {
    if (!token) continue;
    into.add(token);
    for (const part of token.split(/[{}()<>;,=]+/)) if (part) into.add(part);
  }
}

export function tailwindJsScanner(scanDirs: string[]): Plugin {
  return {
    name: 'stayvinci:tailwind-js-scanner',
    enforce: 'pre',
    async transform(code, id) {
      const file = id.split('?')[0] ?? id;
      if (!file.endsWith('.css') || !code.includes('tailwindcss')) return null;
      const compiler = await compile(code, {
        base: path.dirname(file),
        from: file,
        onDependency: (dep) => this.addWatchFile(dep),
      });
      const dirs = [...scanDirs, ...compiler.sources.map((s) => s.base)];
      const files: string[] = [path.join(here, 'index.html')];
      for (const d of new Set(dirs)) walk(d, files);
      const candidates = new Set<string>();
      for (const f of files) {
        this.addWatchFile(f);
        candidatesFrom(readFileSync(f, 'utf8'), candidates);
      }
      return { code: compiler.build([...candidates]), map: null };
    },
  };
}
