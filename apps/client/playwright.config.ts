import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  retries: 0,
  workers: isCI ? 1 : undefined,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
    video: 'retain-on-failure',
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
      url: 'http://localhost:3000/',
      timeout: 120_000,
      reuseExistingServer: !isCI,
      cwd: '../..',
      env: {
        ...process.env,
        ALLOWED_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173',
        RATE_LIMIT_AUTH_MAX: '200',
        RATE_LIMIT_AUTH_CONNECTION_MAX: '200',
        RATE_LIMIT_RECONNECT_MAX: '200',
        RATE_LIMIT_RECONNECT_IP_MAX: '200',
      },
    },
    {
      command: 'npm run dev -- --host localhost --port 5173',
      url: 'http://localhost:5173/',
      timeout: 120_000,
      reuseExistingServer: !isCI,
      cwd: '.',
      env: {
        ...process.env,
        VITE_WS_URL: 'ws://localhost:3000/ws',
      },
    },
  ],
});
