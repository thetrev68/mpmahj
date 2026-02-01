#!/usr/bin/env python3
"""
file: tree_scanner.py
MPMAHJ Repository Code Scanner
Strictly scans for source code files, ignoring all configs and build artifacts.
Separately tracks Markdown documentation.

Target Extensions: .rs, .ts, .tsx, .js, .py, .css, .html, .sql
Doc Extensions:    .md
"""

import sys
from pathlib import Path
from typing import Set, Optional
import argparse

class CodeTreeScanner:
    def __init__(self):
        # Directories to completely ignore
        self.ignore_dirs = {
            # Version Control
            ".git", ".github", ".husky", ".claude", ".gemini", ".vscode", ".idea",
            # Dependencies & Build
            "node_modules", "target", "dist", "build", "venv", "__pycache__", 
            ".cargo", ".rustup", "tmp", "temp", "coverage", ".sqlx",
            # Logs & Caches
            "logs", ".ruff_cache", ".pytest_cache", ".vite", "flycheck",
            # Archives
            "client-archive-2026-01-31", "archive", "deleteme",
            # We explicitly allow 'docs' now to scan for MD files, 
            # but usually we might ignore other asset folders if they exist.
        }
        
        # Specific filenames to ignore even if they match extensions
        self.ignore_files = {
            "tree_scanner.py", # Don't scan self
        }

        # Whitelist of file extensions to constitute "Code"
        self.code_extensions = {
            '.rs',      # Rust
            '.ts',      # TypeScript
            '.tsx',     # React TS
            '.js',      # JavaScript
            '.py',      # Python
            '.css',     # Styles
            '.html',    # HTML
            '.sql'      # SQL
        }

        # Whitelist for Documentation
        self.doc_extensions = {
            '.md'
        }
        
        self.output_lines = []
        self.stats = {
            'total_dirs': 0,
            'total_files': 0,
            'total_lines': 0,
            'total_doc_files': 0,
            'total_doc_lines': 0
        }
    
    def count_lines(self, file_path: Path) -> int:
        """Count non-empty lines in a file"""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                return sum(1 for line in f if line.strip())
        except Exception:
            return 0
    
    def get_file_type(self, file_path: Path) -> Optional[str]:
        """Returns 'code', 'doc', or None"""
        if file_path.name in self.ignore_files:
            return None
        
        suffix = file_path.suffix.lower()
        if suffix in self.code_extensions:
            return 'code'
        if suffix in self.doc_extensions:
            return 'doc'
        return None

    def scan_directory(self, directory: Path, prefix: str = "") -> None:
        """Recursively scan directory and build tree"""
        try:
            # Sort: Directories first, then files
            items = sorted(directory.iterdir(), key=lambda x: (not x.is_dir(), x.name.lower()))
        except PermissionError:
            return
        
        # Filter items
        filtered_items = []
        for item in items:
            if item.is_dir():
                if item.name not in self.ignore_dirs and not item.name.startswith('.'):
                    filtered_items.append((item, 'dir'))
            else:
                ftype = self.get_file_type(item)
                if ftype:
                    filtered_items.append((item, ftype))
        
        # Process filtered items
        for i, (item, ftype) in enumerate(filtered_items):
            is_last = i == len(filtered_items) - 1
            pointer = "└── " if is_last else "├── "
            
            if ftype == 'dir':
                self.stats['total_dirs'] += 1
                self.output_lines.append(f"{prefix}{pointer}{item.name}/")
                
                next_prefix = prefix + ("    " if is_last else "│   ")
                self.scan_directory(item, next_prefix)
                
            else:
                line_count = self.count_lines(item)
                display = f"{item.name} ({line_count} lines)"
                self.output_lines.append(f"{prefix}{pointer}{display}")

                if ftype == 'code':
                    self.stats['total_files'] += 1
                    self.stats['total_lines'] += line_count
                elif ftype == 'doc':
                    self.stats['total_doc_files'] += 1
                    self.stats['total_doc_lines'] += line_count

    def generate(self, root_path: Path, output_file: str = "tree.txt"):
        print(f"🚀 Scanning in: {root_path}")
        print(f"📋 Code extensions: {', '.join(sorted(self.code_extensions))}")
        print(f"📄 Doc extensions:  {', '.join(sorted(self.doc_extensions))}")
        
        self.output_lines = [f"{root_path.name}/"]
        # Reset stats
        self.stats = {k: 0 for k in self.stats}
        
        self.scan_directory(root_path)
        
        # Source Stats footer
        self.output_lines.append("")
        self.output_lines.append("-" * 40)
        self.output_lines.append(f"Total Source Files: {self.stats['total_files']}")
        self.output_lines.append(f"Total Source Lines: {self.stats['total_lines']:,}")
        self.output_lines.append("-" * 40)
        
        # Doc Stats footer
        self.output_lines.append(f"Total Doc Files:    {self.stats['total_doc_files']}")
        self.output_lines.append(f"Total Doc Lines:    {self.stats['total_doc_lines']:,}")
        self.output_lines.append("-" * 40)
        
        content = "\n".join(self.output_lines)
        
        try:
            with open(output_file, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"✅ Tree saved to: {output_file}")
            
            # Print stats to console
            print(f"\n📊 Source Code Summary:")
            print(f"   Files: {self.stats['total_files']}")
            print(f"   Lines: {self.stats['total_lines']:,}")
            
            print(f"\n📝 Documentation Summary:")
            print(f"   Files: {self.stats['total_doc_files']}")
            print(f"   Lines: {self.stats['total_doc_lines']:,}")
            
        except Exception as e:
            print(f"❌ Error writing file: {e}")

def main():
    parser = argparse.ArgumentParser(description="MPMAHJ Code Scanner")
    parser.add_argument("-o", "--output", default="tree.txt", help="Output file")
    args = parser.parse_args()
    
    scanner = CodeTreeScanner()
    scanner.generate(Path.cwd(), args.output)

if __name__ == "__main__":
    main()