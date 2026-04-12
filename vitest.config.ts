import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Stub `server-only` so test files can import modules that use it as
      // a hard guard. Real module throws when imported outside an RSC build.
      'server-only': path.resolve(__dirname, './tests/stubs/server-only.ts'),
    },
  },
})
