import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  retries: isCI ? 2 : 0,
  workers: isCI ? 1 : undefined,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'cargo run -p mahjong_server',
      url: 'http://127.0.0.1:3000/',
      timeout: 120_000,
      reuseExistingServer: !isCI,
      cwd: '../..',
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5173',
      url: 'http://127.0.0.1:5173/',
      timeout: 120_000,
      reuseExistingServer: !isCI,
      cwd: '.',
    },
  ],
});
