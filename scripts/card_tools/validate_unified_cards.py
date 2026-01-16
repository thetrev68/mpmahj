#!/usr/bin/env python3
"""
Validate unified Mahjong card JSON files.

This helper prints summary counts and flags structural issues:
- histogram/ineligible length (must be 42)
- negative or non-integer counts
- ineligible counts exceeding histogram counts
- duplicate pattern/variation IDs
"""

from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path
from typing import Any

HISTOGRAM_SIZE = 42
HAND_TILE_COUNT = 14


def _load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def _summarize(patterns: list[dict[str, Any]]) -> tuple[int, int, dict[str, tuple[int, int]]]:
    total_variations = 0
    per_category: dict[str, list[int]] = {}

    for pattern in patterns:
        cat = str(pattern.get("category", ""))
        per_category.setdefault(cat, [0, 0])
        per_category[cat][0] += 1
        variations = pattern.get("variations", [])
        per_category[cat][1] += len(variations)
        total_variations += len(variations)

    category_summary = {
        cat: (counts[0], counts[1]) for cat, counts in sorted(per_category.items())
    }
    return len(patterns), total_variations, category_summary


def _validate_pattern(pattern: dict[str, Any], errors: list[str], warnings: list[str]) -> None:
    pid = str(pattern.get("id", ""))
    variations = pattern.get("variations", [])

    seen_variation_ids: set[str] = set()
    for v in variations:
        vid = str(v.get("id", ""))
        if vid in seen_variation_ids:
            errors.append(f"{pid}: duplicate variation id {vid}")
        seen_variation_ids.add(vid)

        hist = v.get("histogram")
        ineligible = v.get("ineligible_histogram")

        if not isinstance(hist, list) or len(hist) != HISTOGRAM_SIZE:
            errors.append(f"{pid}/{vid}: histogram length {len(hist) if isinstance(hist, list) else 'n/a'}")
            continue
        if not isinstance(ineligible, list) or len(ineligible) != HISTOGRAM_SIZE:
            errors.append(
                f"{pid}/{vid}: ineligible_histogram length "
                f"{len(ineligible) if isinstance(ineligible, list) else 'n/a'}"
            )
            continue

        total = 0
        for i, (h, inh) in enumerate(zip(hist, ineligible)):
            if not isinstance(h, int) or h < 0:
                errors.append(f"{pid}/{vid}: histogram[{i}] invalid ({h})")
            if not isinstance(inh, int) or inh < 0:
                errors.append(f"{pid}/{vid}: ineligible_histogram[{i}] invalid ({inh})")
            if isinstance(h, int) and isinstance(inh, int) and inh > h:
                errors.append(f"{pid}/{vid}: ineligible[{i}] > histogram[{i}]")
            if isinstance(h, int):
                total += h

        if total != HAND_TILE_COUNT:
            warnings.append(f"{pid}/{vid}: total tiles {total} (expected {HAND_TILE_COUNT})")


def validate_file(path: Path, strict: bool) -> int:
    data = _load_json(path)
    patterns = data.get("patterns", [])
    if not isinstance(patterns, list):
        print(f"{path}: invalid or missing patterns list")
        return 1

    pattern_ids = Counter(p.get("id") for p in patterns)
    errors: list[str] = []
    warnings: list[str] = []

    for pid, count in pattern_ids.items():
        if not pid:
            errors.append(f"{path}: pattern missing id")
        elif count > 1:
            errors.append(f"{path}: duplicate pattern id {pid}")

    for pattern in patterns:
        _validate_pattern(pattern, errors, warnings)

    total_patterns, total_variations, categories = _summarize(patterns)
    print(f"{path}: {total_patterns} patterns, {total_variations} variations")
    for cat, (p_count, v_count) in categories.items():
        print(f"  {cat}: {p_count} patterns, {v_count} variations")

    if warnings:
        print(f"{path}: {len(warnings)} warnings")
        for w in warnings[:10]:
            print(f"  WARN: {w}")
        if len(warnings) > 10:
            print(f"  WARN: ... {len(warnings) - 10} more")

    if errors:
        print(f"{path}: {len(errors)} errors")
        for e in errors[:10]:
            print(f"  ERR: {e}")
        if len(errors) > 10:
            print(f"  ERR: ... {len(errors) - 10} more")
        return 1

    if strict and warnings:
        return 1

    return 0


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Validate unified card JSON files"
    )
    parser.add_argument("paths", nargs="+", help="Paths to unified_card*.json files")
    parser.add_argument(
        "--strict",
        action="store_true",
        help="Treat warnings as errors (non-zero exit)",
    )
    args = parser.parse_args()

    exit_code = 0
    for path_str in args.paths:
        path = Path(path_str)
        if not path.exists():
            print(f"{path}: not found")
            exit_code = 1
            continue
        exit_code |= validate_file(path, args.strict)

    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
