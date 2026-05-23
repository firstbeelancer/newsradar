import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': resolve(__dirname, '../src'),
      '@shared': resolve(__dirname, '../src/shared'),
      '@features': resolve(__dirname, '../src/features'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['**/*.test.{ts,tsx}'],
    setupFiles: ['./__tests__/setup.ts'],
    css: true,
  },
});
