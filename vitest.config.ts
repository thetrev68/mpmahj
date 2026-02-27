import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['apps/client/vitest.config.ts'],
  },
});
