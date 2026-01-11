#!/usr/bin/env python3
"""
Simple Markdown fixer for common markdownlint rules used in this repo.

It performs non-destructive edits (creates .bak backups) and handles:
- Ensure fenced code blocks have a language (default: text)
- Ensure blank line before/after headings
- Ensure blank lines around lists
- Normalize table pipe spacing to have single space on both sides when using pipes

This is a best-effort script and may not fix every edge case. Review changes before commit.
"""
import re
from pathlib import Path


def fix_file(p: Path):
    text = p.read_text(encoding='utf-8')
    # normalize to LF for easier regex handling
    text = text.replace('\r\n', '\n')
    orig = text

    # 1) Ensure fenced code blocks have language: ``` -> ```text
    def repl_fence(m):
        fence = m.group(1)
        lang = m.group(2)
        if lang.strip() == '':
            return fence + 'text\n'
        return m.group(0)

    text = re.sub(r'(?m)(^```)(\s*)$', repl_fence, text)

    # 2) Add blank line before and after headings (##..)
    text = re.sub(r'(?m)([^\n])\n(#{1,6} )', r"\1\n\n\2", text)
    text = re.sub(r'(?m)(\n(#{1,6} [^\n]+)\n)([^\n])', r"\1\n\3", text)

    # 3) Ensure blank lines around lists (lines starting with -, *, or numbered)
    text = re.sub(r'(?m)([^\n])\n(\s*[-*+] \S)', r"\1\n\n\2", text)
    text = re.sub(r'(?m)(\n(\s*[-*+] [^\n]+)\n)([^\n])', r"\1\n\3", text)
    text = re.sub(r'(?m)([^\n])\n(\s*\d+\. \S)', r"\1\n\n\2", text)
    text = re.sub(r'(?m)(\n(\s*\d+\. [^\n]+)\n)([^\n])', r"\1\n\3", text)

    # 4) Ensure fenced code blocks are surrounded by blank lines
    # Insert blank line before opening fence when previous line not blank
    text = re.sub(r'(?m)([^\n\s])\n(```)', r"\1\n\n\2", text)
    # Ensure blank line after closing fence when next line not blank
    text = re.sub(r'(?m)(```[\s\S]*?```)(?!\n|$)\n?(?=\S)', r"\1\n\n", text)

    # 4.5) Remove trailing spaces (single or multiple) before newline
    text = re.sub(r"[ \t]+\n", "\n", text)
    # Also strip trailing spaces at end of file
    text = re.sub(r"[ \t]+$", "", text)

    # 4.6) Collapse multiple blank lines into a single blank line
    text = re.sub(r"\n{3,}", "\n\n", text)

    # 5) Normalize table pipes: add single space around pipes when using compact style
    # Convert pipes like "|a|b|" or "| a|b |" into "| a | b |"
    def fix_table_line(line):
        if '|' not in line:
            return line
        # don't touch code fences
        if line.strip().startswith('```'):
            return line
        # split but keep leading/trailing pipe
        parts = line.split('|')
        if len(parts) <= 2:
            return line
        parts = [p.strip() for p in parts]
        return ' | '.join(parts)

    new_lines = []
    for ln in text.splitlines():
        new_lines.append(fix_table_line(ln))
    text = '\n'.join(new_lines) + ('\n' if text.endswith('\n') else '')

    # 6) Normalize ordered list prefixes to '1.' for consistent style (MD029)
    text = re.sub(r'(?m)^(?P<indent>\s*)\d+\.\s', r"\g<indent>1. ", text)

    # finally, write back using LF
    text = text.replace('\r\n', '\n')

    if text != orig:
        bak = p.with_suffix(p.suffix + '.bak')
        bak.write_text(orig, encoding='utf-8')
        p.write_text(text, encoding='utf-8')
        print(f'Fixed {p} (backup: {bak})')


def main():
    base = Path('docs/ux')
    files = list(base.rglob('*.md'))
    for f in files:
        fix_file(f)


if __name__ == '__main__':
    main()
