import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: {
    include: ['tests/**/*.test.ts'],
    // PGlite boots a WASM Postgres per test file.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})
