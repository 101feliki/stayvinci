import { defineConfig } from 'vitest/config';

export default defineConfig({
  // NestJS uses legacy (experimental) decorators with type metadata; tell oxc to compile them.
  oxc: { decorator: { legacy: true, emitDecoratorMetadata: true } },
  test: {
    server: { deps: { external: [/@electric-sql\/pglite/] } },
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
  },
});
