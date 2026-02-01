import { defineConfig, mergeConfig } from 'vitest/config';
import viteConfig from './vite.config';

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      // Use jsdom environment for React component testing
      environment: 'jsdom',

      // Setup file runs before each test file
      setupFiles: ['./src/test/setup.ts'],

      // Global test utilities (optional, but convenient)
      globals: true,

      // Coverage configuration
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json', 'html'],
        exclude: [
          'node_modules/',
          'src/test/',
          '**/*.d.ts',
          '**/*.config.*',
          '**/mockData/',
          'dist/',
        ],
      },

      // Test file patterns
      include: ['src/**/*.{test,spec}.{ts,tsx}'],

      // Exclude patterns
      exclude: ['node_modules/', 'dist/', '.idea/', '.git/', '.cache/'],
    },
  })
);
