import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * One project per package so that tests resolving paths from `process.cwd()`
 * (nginx.conf, src/app/router.tsx, ...) see their own package root.
 *
 * Dummy DATABASE_URL / REDIS_URL keep `config/env.ts` from calling
 * process.exit(1) at import time — the unit tests never open a connection.
 */
const workerEnv = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379/0',
  JWT_SECRET: 'test-jwt-secret-at-least-32-characters-long',
  ENCRYPTION_KEY: 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2',
};

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'api',
          root: './packages/api',
          globals: true,
          include: ['**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**'],
          env: workerEnv,
        },
      },
      {
        test: {
          name: 'worker',
          root: './packages/worker',
          globals: true,
          include: ['**/*.test.ts'],
          exclude: ['**/node_modules/**', '**/dist/**'],
          env: workerEnv,
        },
      },
      {
        // Web sources import through the Vite aliases, so the test project has
        // to resolve them the same way the app build does.
        resolve: {
          alias: {
            '@': resolve(import.meta.dirname, 'packages/web/src'),
            '@shared': resolve(import.meta.dirname, 'packages/web/src/shared'),
            '@features': resolve(import.meta.dirname, 'packages/web/src/features'),
          },
        },
        test: {
          name: 'web',
          root: './packages/web',
          globals: true,
          include: ['**/*.test.ts', '**/*.test.tsx'],
          exclude: ['**/node_modules/**', '**/dist/**'],
          env: workerEnv,
        },
      },
    ],
  },
});
