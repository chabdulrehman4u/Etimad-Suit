import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    hookTimeout: 180000,
    testTimeout: 60000,
    globals: true,
    environment: 'node',
  },
});

