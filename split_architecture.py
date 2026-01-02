#!/usr/bin/env python3
"""
Script to split ARCHITECTURE.md into separate files per section.
"""

import re
from pathlib import Path

def split_architecture():
    arch_file = Path("ARCHITECTURE.md")
    docs_dir = Path("docs/architecture")
    docs_dir.mkdir(parents=True, exist_ok=True)

    # Read the full file
    content = arch_file.read_text(encoding='utf-8')

    # Split by top-level sections (## N. Title)
    section_pattern = r'^## (\d+)\. (.+?)$'
    sections = []
    current_section = None
    current_content = []

    for line in content.split('\n'):
        match = re.match(section_pattern, line)
        if match:
            # Save previous section
            if current_section:
                sections.append((current_section, '\n'.join(current_content)))

            # Start new section
            current_section = {
                'number': int(match.group(1)),
                'title': match.group(2),
                'line': line
            }
            current_content = [f"# {match.group(1)}. {match.group(2)}", ""]
        elif current_section:
            current_content.append(line)

    # Don't forget the last section
    if current_section:
        sections.append((current_section, '\n'.join(current_content)))

    # Write each section to a file
    for section_info, section_content in sections:
        num = section_info['number']
        title = section_info['title']

        # Create filename
        filename = f"{num:02d}-{title.lower().replace(' ', '-').replace('/', '-').replace('(', '').replace(')', '')}.md"
        filepath = docs_dir / filename

        # Skip if already exists (Section 4 we already created)
        if filepath.exists():
            print(f"Skipping {filename} (already exists)")
            continue

        print(f"Creating {filename}...")
        filepath.write_text(section_content, encoding='utf-8')

    # Create new table of contents ARCHITECTURE.md
    toc_lines = [
        "# Technical Architecture - American Mahjong Game",
        "",
        "> **Note**: This document provides an overview and table of contents. Each section has been split into its own file for easier navigation and maintenance.",
        "",
        "See also: [PLANNING.md](PLANNING.md) for user-facing feature descriptions.",
        "",
        "---",
        "",
        "## Architecture Documents",
        ""
    ]

    for section_info, _ in sections:
        num = section_info['number']
        title = section_info['title']
        filename = f"{num:02d}-{title.lower().replace(' ', '-').replace('/', '-').replace('(', '').replace(')', '')}.md"

        toc_lines.append(f"{num}. [{title}](docs/architecture/{filename})")

    toc_lines.extend([
        "",
        "---",
        "",
        "## Quick Reference",
        "",
        "### Completed Sections",
        "",
        "- ✅ **Section 4**: State Machine Design - Game phases, Charleston, turn flow",
        "- ✅ **Section 5**: Data Models - Tile, Hand, Player, Table structures",
        "- ✅ **Section 6**: Command/Event System - API contract between client/server",
        "- ✅ **Section 7**: The Card Schema - Pattern representation (using proven format with 5 years of data)",
        "",
        "### In Progress",
        "",
        "- 🚧 **Section 8**: Validation Engine",
        "- 🚧 **Section 9**: Network Protocol",
        "- 🚧 **Section 10**: Frontend Architecture",
        "- 🚧 **Section 11**: AI System",
        "- 🚧 **Section 12**: Testing Strategy",
        "",
        "### TODO",
        "",
        "- **Section 1**: System Overview",
        "- **Section 2**: Technology Stack",
        "- **Section 3**: Module Architecture",
        "",
        "---",
        "",
        "## Key Design Decisions",
        "",
        "1. **Server-Authoritative**: Rust backend holds truth, React frontend is presentation",
        "2. **Command/Event Pattern**: Clean separation between intent (commands) and reality (events)",
        "3. **Type-Driven State Machine**: Impossible states are impossible (can't discard during Charleston)",
        "4. **Proven Card Format**: Using battle-tested format with 5 years of NMJL card data",
        "5. **Variable Suits (VSUIT1/2/3)**: Elegant solution for 'same suit' constraints",
        "",
        "---",
        "",
        "## Development Status",
        "",
        "This is a **design document**. Implementation follows the patterns documented here.",
        "",
        "For implementation progress, see the main README.md.",
    ])

    # Write new TOC
    arch_file.write_text('\n'.join(toc_lines), encoding='utf-8')
    print(f"\n✅ Created new {arch_file}")
    print(f"✅ Split into {len(sections)} section files in {docs_dir}/")

if __name__ == "__main__":
    split_architecture()
