import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { nativeScannerWorks, tailwindJsScanner } from './tailwind-js-scanner.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const useNative = nativeScannerWorks();
if (!useNative) {
  console.warn(
    '[tailwind] Native scanner unavailable (blocked by OS policy?). Using JS scanner fallback.',
  );
}

export default defineConfig({
  plugins: [
    react(),
    useNative
      ? tailwindcss()
      : tailwindJsScanner([path.join(here, 'src'), path.join(here, '../../packages/ui/src')]),
  ],
  server: { port: 5174 },
});
