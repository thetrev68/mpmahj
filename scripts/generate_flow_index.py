#!/usr/bin/env python3
"""
Generate `crates/mahjong_core/src/flow/_index.json` by scanning Rust source files in
`crates/mahjong_core/src/flow` and extracting public types and their doc comments.

This is intentionally small and conservative: it does not attempt full Rust parsing,
just extracts `///` comments immediately preceding `pub` items and captures simple
`pub enum/struct/const/type/fn` declarations.

Usage:
  python scripts/generate_flow_index.py --out crates/mahjong_core/src/flow/_index.json

Notes:
- Rustdoc is the source of truth. This generator is a convenience for LLMs and tooling.
- The output follows `_index.schema.json` in the same folder.
"""

import argparse
import json
import os
import re
from datetime import datetime, timezone

RUST_FLOW_DIRS = [
    "crates/mahjong_core/src/flow",
    "crates/mahjong_core/src/flow.rs",
]

PUB_ITEM_RE = re.compile(r"^pub\s+(enum|struct|fn|type|const|trait)\s+([A-Za-z0-9_]+)")
DOC_LINE_RE = re.compile(r"^\s*///\s?(.*)$")


def extract_from_file(path):
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    entries = []
    i = 0
    while i < len(lines):
        line = lines[i]
        m = PUB_ITEM_RE.match(line)
        if m:
            kind = m.group(1)
            name = m.group(2)
            # back up to collect doc comments. Skip over attribute lines (#[...]) and blank lines
            docs = []
            j = i - 1
            while j >= 0:
                line_j = lines[j].rstrip()
                dm = DOC_LINE_RE.match(line_j)
                if dm:
                    docs.insert(0, dm.group(1).strip())
                    j -= 1
                    continue
                # skip attribute macros and blank lines between doc and item
                if line_j.strip().startswith('#[') or line_j.strip() == '':
                    j -= 1
                    continue
                break
            # capture a short signature line (first line of the declaration)
            signature = line.strip()
            # find end of declaration for line_end
            line_start = i + 1
            line_end = line_start
            # crude heuristic: for enums/structs, look ahead for closing '}'
            if kind in ("enum", "struct", "trait"):
                depth = 0
                for k in range(i, len(lines)):
                    if "{" in lines[k]:
                        depth += lines[k].count("{")
                    if "}" in lines[k]:
                        depth -= lines[k].count("}")
                    line_end = k + 1
                    if depth <= 0:
                        break
            entries.append({
                "name": name,
                "kind": kind,
                "signature": signature,
                "doc": "\n".join(docs),
                "path": os.path.relpath(path).replace('\\\\','/'),
                "line_start": line_start,
                "line_end": line_end,
            })
            i = line_end
            continue
        i += 1
    return entries


def main(out_path):
    all_entries = []

    # Support both a flow/ directory (post-refactor) and legacy flow.rs file
    for flow_path in RUST_FLOW_DIRS:
        if os.path.isdir(flow_path):
            for root, dirs, files in os.walk(flow_path):
                for fn in sorted(files):
                    if fn.endswith('.rs'):
                        path = os.path.join(root, fn)
                        entries = extract_from_file(path)
                        all_entries.extend(entries)
        elif os.path.isfile(flow_path):
            entries = extract_from_file(flow_path)
            all_entries.extend(entries)

    payload = {
        "generated_by": "generate_flow_index.py",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "entries": all_entries,
    }

    with open(out_path, "w", encoding="utf-8") as out:
        json.dump(payload, out, indent=2, ensure_ascii=False)

    print(f"Wrote {len(all_entries)} entries to {out_path}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("--out", default="crates/mahjong_core/src/flow/_index.json")
    args = parser.parse_args()
    main(args.out)
