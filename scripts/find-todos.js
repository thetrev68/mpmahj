#!/usr/bin/env node
/**
 * Cross-platform TODO finder
 * Searches for TODO, FIXME, HACK, and XXX markers in source files
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const TODO_PATTERNS = /\b(TODO|FIXME|HACK|XXX):\s*(.+)/gi;

const INCLUDE_EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx', '.rs', '.sql'];
const EXCLUDE_DIRS = [
  'node_modules',
  'target',
  'dist',
  'build',
  '.git',
  'coverage',
  'apps/client/src/types/bindings/generated', // Exclude generated files
];

const EXCLUDE_FILES = ['INCOMPLETE_WORK_AUDIT.md', 'package-lock.json', 'Cargo.lock'];

let totalMatches = 0;
let filesWithMatches = 0;
const todosByFile = new Map();

function shouldExcludePath(filePath) {
  const normalized = filePath.replace(/\\/g, '/');
  return (
    EXCLUDE_DIRS.some(
      (dir) => normalized.includes(`/${dir}/`) || normalized.startsWith(`${dir}/`)
    ) || EXCLUDE_FILES.some((file) => normalized.endsWith(file))
  );
}

function searchFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const matches = [];

    lines.forEach((line, index) => {
      TODO_PATTERNS.lastIndex = 0; // Reset regex
      const match = TODO_PATTERNS.exec(line);
      if (match) {
        matches.push({
          line: index + 1,
          type: match[1],
          text: match[2].trim(),
          fullLine: line.trim(),
        });
        totalMatches++;
      }
    });

    if (matches.length > 0) {
      filesWithMatches++;
      todosByFile.set(filePath, matches);
    }
  } catch (err) {
    // Skip files that can't be read
  }
}

function walkDirectory(dir) {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (shouldExcludePath(fullPath)) {
        continue;
      }

      if (entry.isDirectory()) {
        walkDirectory(fullPath);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (INCLUDE_EXTENSIONS.includes(ext)) {
          searchFile(fullPath);
        }
      }
    }
  } catch (err) {
    // Skip directories that can't be read
  }
}

// Main execution
console.log('Searching for TODOs, FIXMEs, HACKs, and XXXs...\n');

const rootDir = path.join(__dirname, '..');
walkDirectory(rootDir);

// Print results grouped by file
if (todosByFile.size === 0) {
  console.log('No TODOs found!');
} else {
  const sortedFiles = Array.from(todosByFile.entries()).sort((a, b) => a[0].localeCompare(b[0]));

  for (const [filePath, matches] of sortedFiles) {
    const relativePath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    console.log(`\n${relativePath}`);

    for (const match of matches) {
      console.log(`  ${match.line}: [${match.type}] ${match.text}`);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Summary: ${totalMatches} TODOs in ${filesWithMatches} files`);
  console.log(`${'='.repeat(60)}`);
}

process.exit(0);
