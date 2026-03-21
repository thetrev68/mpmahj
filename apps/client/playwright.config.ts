import { defineConfig, devices } from '@playwright/test';

const isCI = !!process.env.CI;
const e2eServerPort = process.env.PLAYWRIGHT_SERVER_PORT ?? '33001';
const e2eServerHttpUrl = `http://localhost:${e2eServerPort}/`;
const e2eServerWsUrl = `ws://localhost:${e2eServerPort}/ws`;
const e2eDatabaseUrl = process.env.SESSION_POOLER_DATABASE_URL ?? process.env.DATABASE_URL;

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
      command: 'cargo run -p mahjong_server --features database',
      url: e2eServerHttpUrl,
      timeout: 120_000,
      reuseExistingServer: !isCI,
      cwd: '../..',
      env: {
        ...process.env,
        ...(e2eDatabaseUrl ? { DATABASE_URL: e2eDatabaseUrl } : {}),
        PORT: e2eServerPort,
        MAHJONG_ALLOW_TEST_TOKENS: '1',
        DATABASE_MAX_CONNECTIONS: process.env.DATABASE_MAX_CONNECTIONS ?? '5',
        DATABASE_ACQUIRE_TIMEOUT_SECS: process.env.DATABASE_ACQUIRE_TIMEOUT_SECS ?? '10',
        ALLOWED_ORIGINS: 'http://localhost:5173,http://127.0.0.1:5173',
        RATE_LIMIT_AUTH_MAX: '200',
        RATE_LIMIT_AUTH_CONNECTION_MAX: '200',
        RATE_LIMIT_RECONNECT_MAX: '200',
        RATE_LIMIT_RECONNECT_IP_MAX: '200',
        RATE_LIMIT_GUEST_COMMAND_MAX: '1000',
        RATE_LIMIT_GUEST_COMMAND_WINDOW_SECS: '1',
        RATE_LIMIT_CHARLESTON_MAX: '1000',
        RATE_LIMIT_CHARLESTON_WINDOW_SECS: '1',
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
        VITE_WS_URL: e2eServerWsUrl,
        VITE_E2E_TEST_MODE: 'true',
      },
    },
  ],
});
