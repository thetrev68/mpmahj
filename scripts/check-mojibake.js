#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();

const IGNORE_DIRS = new Set([
  '.git',
  'node_modules',
  'target',
  'dist',
  'build',
  'coverage',
  '.next',
  '.turbo',
  'tmp',
]);

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.json',
  '.md',
  '.rs',
  '.css',
  '.scss',
  '.html',
  '.yml',
  '.yaml',
  '.toml',
  '.txt',
]);

const BAD_TOKENS = [
  '\u00e2\u20ac\u201d',
  '\u00e2\u20ac\u201c',
  '\u00e2\u20ac\u02dc',
  '\u00e2\u20ac\u2122',
  '\u00e2\u20ac\u0153',
  '\u00e2\u20ac\u009d',
  '\u00e2\u20ac\u00a2',
  '\u00e2\u20ac\u00a6',
  '\u00e2\u201e\u00a2',
  '\u00e2\u2020\u2019',
  '\u00e2\u2020\u201d',
  '\u00e2\u2020\u0090',
  '\u00e2\u0153\u201c',
  '\u00e2\u0153\u2014',
  '\u00e2\u2014\u2021',
  '\u00e2\u2013\u00bc',
  '\u00c2\u00b1',
  '\u00c2 ',
  '\uFFFD',
];

function shouldScanFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (!TEXT_EXTENSIONS.has(ext)) {
    return false;
  }
  const normalized = filePath.replaceAll('\\', '/');
  if (normalized.includes('/types/bindings/generated/')) {
    return false;
  }
  if (normalized.includes('/docs/rustdoc/') || normalized.includes('/docs/tsdoc/')) {
    return false;
  }
  return true;
}

async function collectFiles(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) {
        continue;
      }
      await collectFiles(fullPath, out);
      continue;
    }
    if (entry.isFile() && shouldScanFile(fullPath)) {
      out.push(fullPath);
    }
  }
  return out;
}

function findTokenInLine(line) {
  for (const token of BAD_TOKENS) {
    const column = line.indexOf(token);
    if (column >= 0) {
      return { token, column };
    }
  }
  return null;
}

async function main() {
  const files = await collectFiles(ROOT);
  const findings = [];

  for (const filePath of files) {
    let text;
    try {
      text = await fs.readFile(filePath, 'utf8');
    } catch {
      continue;
    }

    const lines = text.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const match = findTokenInLine(lines[i]);
      if (!match) continue;
      findings.push({
        file: path.relative(ROOT, filePath).replaceAll('\\', '/'),
        line: i + 1,
        column: match.column + 1,
        token: match.token,
        text: lines[i].trim(),
      });
    }
  }

  if (findings.length === 0) {
    console.log('No mojibake patterns found.');
    return;
  }

  console.error(`Found ${findings.length} mojibake occurrence(s):`);
  for (const f of findings) {
    console.error(`${f.file}:${f.line}:${f.column} token="${f.token}"`);
    console.error(`  ${f.text}`);
  }
  process.exit(1);
}

main().catch((err) => {
  console.error('Failed to run mojibake check:', err);
  process.exit(1);
});
