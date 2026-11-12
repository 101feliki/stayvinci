import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // PGlite loads its WebAssembly and extension files relative to its own package;
    // keep it out of Vite's transform so those paths resolve.
    server: { deps: { external: [/@electric-sql\/pglite/] } },
    testTimeout: 30_000,
    hookTimeout: 120_000,
  },
});
