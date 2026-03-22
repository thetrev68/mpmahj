#!/usr/bin/env node
import net from 'node:net';
import path from 'node:path';
import fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const isWindows = process.platform === 'win32';

function parseDotEnv(filePath) {
  const values = {};

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    for (const rawLine of content.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      const eq = line.indexOf('=');
      if (eq <= 0) continue;

      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      if (key) values[key] = value;
    }
  } catch {
    // Optional .env file.
  }

  return values;
}

function resolveWebSocketConfig() {
  const dotEnv = parseDotEnv(path.join(repoRoot, '.env'));
  const defaultPort = process.env.PORT || dotEnv.PORT || '3100';
  const defaultWsUrl = `ws://localhost:${defaultPort}/ws`;
  const configuredWsUrl = process.env.VITE_WS_URL || dotEnv.VITE_WS_URL || defaultWsUrl;
  const source = process.env.VITE_WS_URL
    ? 'process.env.VITE_WS_URL'
    : dotEnv.VITE_WS_URL
      ? '.env VITE_WS_URL'
      : process.env.PORT
        ? 'process.env.PORT (derived ws://localhost:<PORT>/ws)'
        : dotEnv.PORT
          ? '.env PORT (derived ws://localhost:<PORT>/ws)'
          : 'default ws://localhost:3100/ws';

  let url;
  try {
    url = new URL(configuredWsUrl);
  } catch {
    throw new Error(`Invalid VITE_WS_URL: ${configuredWsUrl}`);
  }

  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') {
    throw new Error(`VITE_WS_URL must use ws:// or wss://, got: ${configuredWsUrl}`);
  }

  const serverPort = Number(url.port || (url.protocol === 'wss:' ? 443 : 80));
  if (!Number.isInteger(serverPort) || serverPort < 1 || serverPort > 65535) {
    throw new Error(`VITE_WS_URL has invalid port: ${configuredWsUrl}`);
  }

  return {
    wsUrl: configuredWsUrl,
    serverPort,
    readinessHost: url.hostname === '0.0.0.0' ? '127.0.0.1' : url.hostname,
    source,
  };
}

const wsConfig = resolveWebSocketConfig();

function spawnClientDev(env) {
  if (isWindows) {
    // On Windows, npm is a .cmd shim and should be launched via cmd.exe.
    return spawn(
      'cmd.exe',
      ['/d', '/s', '/c', 'npm run dev --workspace=client -- --port 5173 --strictPort'],
      {
        cwd: repoRoot,
        env,
        stdio: 'inherit',
        shell: false,
      }
    );
  }

  return spawn(
    'npm',
    ['run', 'dev', '--workspace=client', '--', '--port', '5173', '--strictPort'],
    {
      cwd: repoRoot,
      env,
      stdio: 'inherit',
      shell: false,
    }
  );
}

const PORTS_TO_CLEAR = [wsConfig.serverPort, 5173, 5174, 5175, 5176, 5177];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function runKillScript() {
  const scriptPath = path.join(repoRoot, 'scripts', 'kill-dev.mjs');
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: process.env,
  });

  if (result.status !== 0) {
    throw new Error(`kill-dev.mjs failed with code ${result.status ?? 'unknown'}`);
  }
}

function isPortOpen(port, host = '127.0.0.1', timeoutMs = 250) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;

    const finish = (value) => {
      if (done) return;
      done = true;
      socket.destroy();
      resolve(value);
    };

    socket.setTimeout(timeoutMs);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
    socket.connect(port, host);
  });
}

async function waitForPortOpen(port, host = '127.0.0.1', attempts = 120, intervalMs = 500) {
  for (let i = 0; i < attempts; i += 1) {
    if (await isPortOpen(port, host)) return true;
    await sleep(intervalMs);
  }
  return false;
}

async function waitForPortsClear(ports, attempts = 60, intervalMs = 300) {
  for (let i = 0; i < attempts; i += 1) {
    let busy = false;
    for (const port of ports) {
      if (await isPortOpen(port)) {
        busy = true;
        break;
      }
    }

    if (!busy) {
      await sleep(400);
      let recheckBusy = false;
      for (const port of ports) {
        if (await isPortOpen(port)) {
          recheckBusy = true;
          break;
        }
      }
      if (!recheckBusy) return true;
    }

    await sleep(intervalMs);
  }

  return false;
}

async function ensureDevEnvironmentClear() {
  runKillScript();

  const clear = await waitForPortsClear(PORTS_TO_CLEAR, 60, 300);
  if (!clear) {
    throw new Error('One or more dev ports are still busy after cleanup.');
  }
}

function killTree(pid) {
  if (!pid) return;

  if (isWindows) {
    spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)], { stdio: 'ignore' });
    return;
  }

  try {
    process.kill(pid, 'SIGTERM');
  } catch {
    // Ignore if already exited.
  }
}

const allowedOrigins =
  process.env.ALLOWED_ORIGINS ||
  'http://localhost:5173,http://localhost:1420,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:5177';
const rustLog = process.env.RUST_LOG || 'info';

const env = {
  ...process.env,
  ALLOWED_ORIGINS: allowedOrigins,
  RUST_LOG: rustLog,
  VITE_WS_URL: wsConfig.wsUrl,
  PORT: String(wsConfig.serverPort),
};

if (process.env.SESSION_POOLER_DATABASE_URL) {
  env.DATABASE_URL = process.env.SESSION_POOLER_DATABASE_URL;
}

let serverProc;
let clientProc;
let shuttingDown = false;

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log('\nShutting down dev servers...');
  killTree(clientProc?.pid);
  killTree(serverProc?.pid);

  try {
    await ensureDevEnvironmentClear();
  } catch {
    // Best-effort final cleanup.
  }

  process.exit(exitCode);
}

process.on('SIGINT', () => {
  void shutdown(130);
});
process.on('SIGTERM', () => {
  void shutdown(143);
});

async function main() {
  try {
    await ensureDevEnvironmentClear();
  } catch (error) {
    console.error(`ERROR: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }

  console.log('== American Mahjong Dev Servers ==');
  console.log(`CORS ALLOWED_ORIGINS: ${allowedOrigins}`);
  console.log(`RUST_LOG: ${rustLog}`);
  console.log(`WS config source: ${wsConfig.source}`);
  console.log(`Resolved backend PORT from VITE_WS_URL: ${wsConfig.serverPort}`);

  serverProc = spawn('cargo', ['run', '--features', 'database'], {
    cwd: path.join(repoRoot, 'crates', 'mahjong_server'),
    env,
    stdio: 'inherit',
    shell: false,
  });

  serverProc.on('exit', (code) => {
    if (!shuttingDown) {
      console.error(`Server exited unexpectedly with code ${code ?? 1}`);
      void shutdown(code ?? 1);
    }
  });

  console.log(`Waiting for server on ${wsConfig.readinessHost}:${wsConfig.serverPort}...`);
  const serverReady = await waitForPortOpen(wsConfig.serverPort, wsConfig.readinessHost, 120, 500);
  if (!serverReady) {
    console.error(`Server did not become ready on port ${wsConfig.serverPort} in time.`);
    await shutdown(1);
    return;
  }

  clientProc = spawnClientDev(env);

  clientProc.on('error', (error) => {
    if (!shuttingDown) {
      console.error(`Client spawn failed: ${error.message}`);
      void shutdown(1);
    }
  });

  clientProc.on('exit', (code) => {
    if (!shuttingDown) {
      if (code === 0) {
        void shutdown(0);
      } else {
        console.error(`Client exited with code ${code ?? 1}`);
        void shutdown(code ?? 1);
      }
    }
  });

  console.log(`Server:   ${wsConfig.wsUrl}`);
  console.log('Frontend: http://localhost:5173');
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  await shutdown(1);
});
