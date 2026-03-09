#!/usr/bin/env node
import { execFileSync } from 'node:child_process';

const PORTS = [3000, 5173, 5174, 5175, 5176, 5177];
const isWindows = process.platform === 'win32';

function run(cmd, args, options = {}) {
  try {
    return execFileSync(cmd, args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      ...options,
    });
  } catch {
    return '';
  }
}

function extractPort(localAddress) {
  const match = String(localAddress).match(/[:.](\d+)$/);
  return match ? Number(match[1]) : null;
}

function findWindowsListeningPidsByPort(port) {
  const output = run('netstat', ['-aon', '-p', 'tcp']);
  const pids = new Set();

  for (const rawLine of output.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 5) continue;

    const proto = parts[0]?.toUpperCase();
    const localAddress = parts[1];
    const state = parts[3]?.toUpperCase();
    const pid = parts[4];

    if (proto !== 'TCP' || state !== 'LISTENING') continue;
    if (!/^\d+$/.test(pid)) continue;

    const localPort = extractPort(localAddress);
    if (localPort === port) pids.add(Number(pid));
  }

  return [...pids];
}

function findUnixListeningPidsByPort(port) {
  const pids = new Set();

  const lsof = run('lsof', ['-nP', `-iTCP:${port}`, '-sTCP:LISTEN', '-t']);
  for (const line of lsof.split(/\r?\n/)) {
    const v = line.trim();
    if (/^\d+$/.test(v)) pids.add(Number(v));
  }
  if (pids.size > 0) return [...pids];

  const ss = run('ss', ['-ltnp', `sport = :${port}`]);
  for (const m of ss.matchAll(/pid=(\d+)/g)) {
    pids.add(Number(m[1]));
  }
  if (pids.size > 0) return [...pids];

  const netstat = run('netstat', ['-lntp']);
  for (const rawLine of netstat.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const parts = line.split(/\s+/);
    if (parts.length < 7) continue;

    const localAddress = parts[3];
    const pidProgram = parts[6];
    const localPort = extractPort(localAddress);

    if (localPort !== port) continue;
    const pid = Number(String(pidProgram).split('/')[0]);
    if (Number.isInteger(pid) && pid > 0) pids.add(pid);
  }

  return [...pids];
}

function killPid(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;

  if (isWindows) {
    try {
      execFileSync('taskkill', ['/F', '/T', '/PID', String(pid)], {
        stdio: 'ignore',
      });
      return true;
    } catch {
      return false;
    }
  }

  try {
    process.kill(pid, 'SIGKILL');
    return true;
  } catch {
    return false;
  }
}

function findWindowsViteNodePids() {
  if (!isWindows) return [];

  // Defense-in-depth: catch orphaned Vite node.exe processes in this repo.
  // Do not depend on process cwd being present in command line; match vite.js path.
  const repoRoot = process.cwd().toLowerCase().replace(/\//g, '\\');
  const script = [
    "$ErrorActionPreference='SilentlyContinue'",
    '$procs = Get-CimInstance Win32_Process -Filter "Name=\'node.exe\'"',
    '$procs | ForEach-Object {',
    '  "$($_.ProcessId)|$($_.CommandLine)"',
    '}',
  ].join('; ');

  const out = run('powershell', ['-NoProfile', '-Command', script]);
  const pids = new Set();
  for (const line of out.split(/\r?\n/)) {
    const v = line.trim();
    if (!v) continue;

    const sep = v.indexOf('|');
    if (sep <= 0) continue;

    const pid = v.slice(0, sep).trim();
    const cmd = v
      .slice(sep + 1)
      .trim()
      .toLowerCase()
      .replace(/\//g, '\\');

    if (!/^\d+$/.test(pid) || !cmd) continue;

    const isRepoViteProc =
      cmd.includes(repoRoot) &&
      (cmd.includes('\\vite\\bin\\vite.js') || cmd.includes('\\vite\\dist\\node\\cli.js'));

    if (isRepoViteProc) pids.add(Number(pid));
  }
  return [...pids];
}

function findWindowsBackendPids() {
  if (!isWindows) return [];

  const repoRoot = process.cwd().toLowerCase().replace(/\//g, '\\');
  const script = [
    "$ErrorActionPreference='SilentlyContinue'",
    '$procs = Get-CimInstance Win32_Process',
    '$procs | ForEach-Object {',
    '  "$($_.ProcessId)|$($_.Name)|$($_.CommandLine)"',
    '}',
  ].join('; ');

  const out = run('powershell', ['-NoProfile', '-Command', script]);
  const pids = new Set();

  for (const line of out.split(/\r?\n/)) {
    const v = line.trim();
    if (!v) continue;

    const parts = v.split('|');
    if (parts.length < 3) continue;

    const [pid, name, ...commandParts] = parts;
    const cmd = commandParts.join('|').trim().toLowerCase().replace(/\//g, '\\');
    const exe = name.trim().toLowerCase();

    if (!/^\d+$/.test(pid) || !cmd) continue;

    const isRepoServerExe = exe === 'mahjong_server.exe' && cmd.includes(repoRoot);
    const isRepoServerCargo =
      exe === 'cargo.exe' &&
      cmd.includes(repoRoot) &&
      cmd.includes('mahjong_server') &&
      cmd.includes('run') &&
      cmd.includes('--features') &&
      cmd.includes('database');

    if (isRepoServerExe || isRepoServerCargo) pids.add(Number(pid));
  }

  return [...pids];
}

function findUnixBackendPids() {
  if (isWindows) return [];

  const repoRoot = process.cwd();
  const pids = new Set();
  const out = run('pgrep', ['-af', 'mahjong_server|cargo']);

  for (const line of out.split(/\r?\n/)) {
    const v = line.trim();
    if (!v) continue;

    const match = v.match(/^(\d+)\s+(.*)$/);
    if (!match) continue;

    const [, pid, cmd] = match;
    if (!cmd.includes(repoRoot)) continue;

    const isServerExe = cmd.includes('mahjong_server');
    const isServerCargo =
      cmd.includes('cargo') &&
      cmd.includes('run') &&
      cmd.includes('mahjong_server') &&
      cmd.includes('--features') &&
      cmd.includes('database');

    if (isServerExe || isServerCargo) pids.add(Number(pid));
  }

  return [...pids];
}

let killed = 0;
const seen = new Set();

for (const port of PORTS) {
  const pids = isWindows ? findWindowsListeningPidsByPort(port) : findUnixListeningPidsByPort(port);

  for (const pid of pids) {
    if (seen.has(pid)) continue;
    seen.add(pid);
    console.log(`Killing PID ${pid} on port ${port}`);
    if (killPid(pid)) killed += 1;
  }
}

for (const pid of findWindowsViteNodePids()) {
  if (seen.has(pid)) continue;
  seen.add(pid);
  console.log(`Killing orphaned Vite node PID ${pid}`);
  if (killPid(pid)) killed += 1;
}

const backendPids = isWindows ? findWindowsBackendPids() : findUnixBackendPids();
for (const pid of backendPids) {
  if (seen.has(pid)) continue;
  seen.add(pid);
  console.log(`Killing orphaned backend PID ${pid}`);
  if (killPid(pid)) killed += 1;
}

if (killed === 0) {
  console.log('No dev servers found running.');
} else {
  console.log(`Done. Killed ${killed} process(es).`);
}
