import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    // Git worktrees live under the repo root — exclude their duplicate source
    // tree from test discovery on top of vitest's built-in node_modules/.git excludes.
    exclude: ['**/node_modules/**', '**/.next/**', '**/.worktrees/**'],
  },
})
