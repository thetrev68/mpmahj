#!/usr/bin/env python3
"""
Convert legacy American Mahjong card JSON format to unified format.

This script converts legacy card data (card2017.json, card2018.json, etc.) to the
unified format used by the game engine (unified_card2025.json).

IMPORTANT: This converter must produce EXACT matches with existing unified files.
The histograms determine game wins/losses - any error is critical.

## Legacy Format Structure
{
  "year": 2025,
  "sections": [{
    "group_description": "13579",
    "hands": [{
      "description": "11 333 5555 777 99",
      "vsuit_count": 1,  // 1, 2, 3, or 5 suits
      "concealed": false,
      "odd": false,
      "even": false,
      "components": [
        {"suit": "VSUIT1", "number": 1, "count": 2},
        ...
      ]
    }]
  }]
}

## Key Concepts

### VSUIT (Variable Suit) Expansion
- VSUIT1, VSUIT2, VSUIT3: Placeholders for actual suits (Bam, Crak, Dot)
- vsuit_count determines how many distinct suits are used:
  - vsuit_count=1: All VSUITs map to same suit -> 3 variations (B, C, D)
  - vsuit_count=2: VSUIT1/VSUIT2 map to different suits -> 6 permutations
  - vsuit_count=3: All VSUITs map to different suits -> 6 permutations
  - vsuit_count=5: Special case for consecutive patterns with varying pair position

### Wildcard Numbers (100-104)
- Numbers >= 100 represent "any consecutive numbers"
- 100 = first number in sequence, 101 = second, etc.
- Example: [100, 101, 102] with 3 consecutive expands to:
  - 1,2,3 or 2,3,4 or 3,4,5 or 4,5,6 or 5,6,7 or 6,7,8 or 7,8,9

### Odd/Even Filtering
- odd=True: Only odd numbers (1,3,5,7,9) are valid for wildcards
- even=True: Only even numbers (2,4,6,8) are valid for wildcards

### Suit-Matching Dragons (VSUIT*_DRAGON)
- VSUIT1_DRAGON: Dragon that matches VSUIT1's suit
  - Bam -> Green Dragon (index 31)
  - Crak -> Red Dragon (index 32)
  - Dot -> White Dragon (index 33)

## Tile Index Map (42-element histogram)
- 0-8: Bams (1B-9B)
- 9-17: Craks (1C-9C)
- 18-26: Dots (1D-9D)
- 27: East
- 28: South
- 29: West
- 30: North
- 31: Green Dragon
- 32: Red Dragon
- 33: White Dragon (Soap)
- 34: Flower
- 35-41: Padding (unused)

## Wind Number Mapping (legacy -> index)
- Wind number 1 = North -> index 30
- Wind number 2 = East -> index 27
- Wind number 3 = South -> index 28
- Wind number 4 = West -> index 29

## Joker Eligibility (ineligible_histogram)
- Singles (count=1): Cannot use jokers
- Pairs (count=2): Cannot use jokers
- Flowers: Cannot use jokers (regardless of count)
- Pungs/Kongs/Quints (count>=3): CAN use jokers
"""

import json
import datetime
import itertools
import argparse
from pathlib import Path
from typing import Any


# =============================================================================
# CONSTANTS
# =============================================================================

# Tile index bases for each suit
SUIT_BASES = {
    "Bam": 0,    # Indices 0-8
    "Crak": 9,   # Indices 9-17
    "Dot": 18,   # Indices 18-26
}

# All three suits in standard order
SUITS = ["Bam", "Crak", "Dot"]

# Dragon indices that match each suit
SUIT_DRAGON_INDEX = {
    "Bam": 31,   # Green Dragon
    "Crak": 32,  # Red Dragon
    "Dot": 33,   # White Dragon
}

# Legacy files sometimes encode fixed suits as strings like "Bams" or "Cracks".
FIXED_SUIT_ALIASES = {
    "Bam": "Bam",
    "Bams": "Bam",
    "Crak": "Crak",
    "Craks": "Crak",
    "Cracks": "Crak",
    "Dot": "Dot",
    "Dots": "Dot",
}

# Wind number to histogram index mapping
# Wind numbers in legacy: 1=N, 2=E, 3=S, 4=W
WIND_INDEX = {
    1: 30,  # North
    2: 27,  # East
    3: 28,  # South
    4: 29,  # West
}

# Dragon number to histogram index (for non-suit-matching dragons)
DRAGON_INDEX = {
    0: 33,  # White Dragon (legacy default)
    1: 31,  # Green Dragon
    2: 32,  # Red Dragon
}

# Special tile indices
FLOWER_INDEX = 34
HISTOGRAM_SIZE = 42

# Category name mapping (legacy -> unified)
CATEGORY_MAP = {
    "13579": "13579",
    "2025": "2025",
    "2468": "2468",
    "369": "369",
    "Consecutive": "CONSECUTIVE RUN",
    "LikeNumbers": "ANY LIKE NUMBERS",
    "Quints": "QUINTS",
    "SinglesPairs": "SINGLES AND PAIRS",
    "WindsDragons": "WINDS - DRAGONS",
}

# Score lookup by (section, description) - loaded from CSV if available
SCORE_LOOKUP: dict[str, int] = {}


# =============================================================================
# SCORE HANDLING
# =============================================================================

def load_scores_from_csv(csv_path: str) -> dict[str, int]:
    """
    Load hand scores from the CSV file.

    Returns a dict mapping (section, description) -> score
    """
    import csv

    scores = {}
    with open(csv_path, newline='') as f:
        reader = csv.DictReader(f)
        for row in reader:
            section = row.get('section', '')
            pattern = row.get('hand_pattern', '')
            points = int(row.get('hand_points', 25))
            key = (section, pattern)
            if key not in scores:
                scores[key] = points
    return scores


def get_score(section: str, description: str, concealed: bool) -> int:
    """
    Get the score for a pattern.

    Priority:
    1. CSV lookup (if loaded)
    2. Default to 25 points when no CSV is provided
    """
    key = (section, description)
    if key in SCORE_LOOKUP:
        return SCORE_LOOKUP[key]

    return 25


# =============================================================================
# VSUIT PERMUTATION GENERATION
# =============================================================================

def get_suit_permutations(vsuit_count: int) -> list[dict[str, str]]:
    """
    Generate all valid suit mappings for the given vsuit_count.

    Args:
        vsuit_count: Number of distinct suits in the pattern
            - 0: No variable suits (fixed pattern)
            - 1: All VSUITs map to the same suit -> 3 variations
            - 2: VSUIT1/VSUIT2 map to different suits -> 6 permutations
            - 3: All VSUITs map to different suits -> 6 permutations
            - 5: Special consecutive pattern (handled separately)

    Returns:
        List of dicts mapping VSUIT1/VSUIT2/VSUIT3 to actual suits

    Examples:
        >>> get_suit_permutations(1)
        [{'VSUIT1': 'Bam', 'VSUIT2': 'Bam', 'VSUIT3': 'Bam'},
         {'VSUIT1': 'Crak', 'VSUIT2': 'Crak', 'VSUIT3': 'Crak'},
         {'VSUIT1': 'Dot', 'VSUIT2': 'Dot', 'VSUIT3': 'Dot'}]
    """
    if vsuit_count == 0:
        # No variable suits - return single empty mapping
        # Note: For patterns with vsuit_count=0 and VSUIT_DRAGON components,
        # dragon expansion is handled separately
        return [{}]

    elif vsuit_count == 1:
        # All VSUITs map to the same suit
        return [
            {"VSUIT1": s, "VSUIT2": s, "VSUIT3": s}
            for s in SUITS
        ]

    elif vsuit_count == 2:
        # VSUIT1 and VSUIT2 must be different suits
        # All 6 ordered permutations of 2 from 3 suits
        perms = list(itertools.permutations(SUITS, 2))
        return [
            {"VSUIT1": p[0], "VSUIT2": p[1], "VSUIT3": p[1]}  # VSUIT3 follows VSUIT2
            for p in perms
        ]

    elif vsuit_count == 3:
        # All three VSUITs must be different
        # All 6 permutations of 3 suits
        perms = list(itertools.permutations(SUITS, 3))
        return [
            {"VSUIT1": p[0], "VSUIT2": p[1], "VSUIT3": p[2]}
            for p in perms
        ]

    elif vsuit_count == 5:
        # Special case for consecutive patterns with pair position variation
        # See generate_vsuit5_variations for handling
        return [
            {"VSUIT1": p[0], "VSUIT2": p[1], "VSUIT3": p[2]}
            for p in itertools.permutations(SUITS, 3)
        ]

    else:
        raise ValueError(f"Invalid vsuit_count: {vsuit_count}")


def has_any_dragon_pattern(components: list[dict[str, Any]], vsuit_count: int) -> bool:
    """
    Check if the pattern has "Any Dragon" semantics.

    "Any Dragon" means the VSUIT_DRAGON components should expand to all
    dragon permutations, not be tied to specific suits.

    Conditions for "Any Dragon":
    1. vsuit_count=0 with any VSUIT_DRAGON component
    2. vsuit_count=1 with multiple VSUIT_DRAGON components having different counts
    """
    dragon_comps = [c for c in components if "_DRAGON" in c.get("suit", "")]

    if not dragon_comps:
        return False

    if vsuit_count == 0:
        # No suit variation but has dragons -> "Any Dragon"
        return True

    if vsuit_count == 1 and len(dragon_comps) >= 2:
        # Check if counts are different (suggesting permutation needed)
        counts = [c["count"] for c in dragon_comps]
        if len(set(counts)) > 1:
            return True

    return False


def has_any_wind_pattern(description: str, components: list[dict[str, Any]]) -> bool:
    """
    Check if the pattern has "Any Wind" semantics.

    Legacy data encodes "Any Wind" as a single Wind component (usually number=1)
    plus a description note. We rely on the description to avoid expanding
    normal wind-specific patterns.
    """
    if "Any Wind" not in description:
        return False

    return any(c.get("suit") == "Wind" for c in components)


def get_dragon_permutations(components: list[dict[str, Any]]) -> list[dict[str, int]]:
    """
    Generate all dragon index permutations for "Any Dragon" patterns.

    Returns a list of dicts mapping VSUIT_DRAGON names to dragon indices.
    """
    dragon_comps = [c for c in components if "_DRAGON" in c.get("suit", "")]

    if not dragon_comps:
        return [{}]

    # Get unique dragon component names
    dragon_names = list(set(c["suit"] for c in dragon_comps))
    dragon_indices = [31, 32, 33]  # Green, Red, White

    if len(dragon_names) == 1:
        # Single dragon type -> 3 variations (one per dragon)
        return [{dragon_names[0]: idx} for idx in dragon_indices]

    elif len(dragon_names) == 2:
        # Two dragon types -> 6 permutations (P(3,2))
        perms = list(itertools.permutations(dragon_indices, 2))
        return [
            {dragon_names[0]: p[0], dragon_names[1]: p[1]}
            for p in perms
        ]

    elif len(dragon_names) == 3:
        # Three dragon types -> 6 permutations (3!)
        perms = list(itertools.permutations(dragon_indices, 3))
        return [
            {dragon_names[0]: p[0], dragon_names[1]: p[1], dragon_names[2]: p[2]}
            for p in perms
        ]

    return [{}]


# =============================================================================
# WILDCARD NUMBER EXPANSION
# =============================================================================

def get_consecutive_ranges(max_wildcard: int, odd_only: bool = False,
                           even_only: bool = False) -> list[int]:
    """
    Get all valid starting numbers for consecutive sequences.

    For wildcards 100, 101, 102, ..., the pattern requires N consecutive numbers
    where N = max_wildcard - 99 (e.g., 102 means 3 consecutive).

    Args:
        max_wildcard: Highest wildcard number used (e.g., 102 for 3-consecutive)
        odd_only: If True, only start on odd numbers
        even_only: If True, only start on even numbers

    Returns:
        List of valid starting numbers (1-9 based)

    Examples:
        >>> get_consecutive_ranges(102)  # 3 consecutive
        [1, 2, 3, 4, 5, 6, 7]  # 1-2-3 through 7-8-9

        >>> get_consecutive_ranges(103)  # 4 consecutive
        [1, 2, 3, 4, 5, 6]  # 1-2-3-4 through 6-7-8-9

        >>> get_consecutive_ranges(100, odd_only=True)  # Like numbers, odd only
        [1, 3, 5, 7, 9]

        >>> get_consecutive_ranges(100, even_only=True)  # Like numbers, even only
        [2, 4, 6, 8]
    """
    if max_wildcard < 100:
        return []

    # For "like numbers" (only 100 used), all valid numbers work
    if max_wildcard == 100:
        if odd_only:
            return [1, 3, 5, 7, 9]
        elif even_only:
            return [2, 4, 6, 8]
        else:
            return list(range(1, 10))

    # For consecutive sequences
    count = max_wildcard - 99  # 101 -> 2, 102 -> 3, etc.
    max_start = 10 - count     # Last valid starting number

    if odd_only:
        # For odd consecutive, must start on odd and all must be odd
        # Only works for single numbers (like 100)
        return [1, 3, 5, 7, 9][:max(0, 6 - count + 1)]
    elif even_only:
        # For even consecutive, must start on even and all must be even
        return [2, 4, 6, 8][:max(0, 5 - count + 1)]

    return list(range(1, max_start + 1))


def resolve_number(number: int, base: int) -> int:
    """
    Convert a component number to an actual tile number.

    Args:
        number: The number from the component (1-9 for fixed, 100+ for wildcard)
        base: The starting number for consecutive sequences

    Returns:
        Actual tile number (1-9)

    Examples:
        >>> resolve_number(5, base=1)  # Fixed number
        5
        >>> resolve_number(100, base=3)  # First in sequence starting at 3
        3
        >>> resolve_number(102, base=1)  # Third in sequence starting at 1
        3
    """
    if number < 100:
        return number
    else:
        # Wildcard: 100 -> base, 101 -> base+1, etc.
        return base + (number - 100)


# =============================================================================
# HISTOGRAM GENERATION
# =============================================================================

def get_tile_index(suit: str, number: int, suit_mapping: dict[str, str],
                   dragon_mapping: dict[str, int] | None = None) -> int:
    """
    Get the histogram index for a tile.

    Args:
        suit: The suit name (VSUIT1, VSUIT2, VSUIT3, Wind, Dragon, Flower)
        number: The tile number (1-9 for suits, 0-3 for winds, 0-2 for dragons)
        suit_mapping: Dict mapping VSUIT* to actual suits
        dragon_mapping: Optional dict mapping VSUIT*_DRAGON to dragon indices
                       (used for "Any Dragon" patterns)

    Returns:
        Histogram index (0-41)
    """
    # Handle variable suits
    if suit in FIXED_SUIT_ALIASES:
        actual_suit = FIXED_SUIT_ALIASES[suit]
        base = SUIT_BASES[actual_suit]
        return base + (number - 1)

    if suit.startswith("VSUIT") and "_DRAGON" in suit:
        # Check if we have a direct dragon mapping (for "Any Dragon" patterns)
        if dragon_mapping and suit in dragon_mapping:
            return dragon_mapping[suit]

        # Suit-matching dragon (e.g., VSUIT1_DRAGON)
        vsuit_key = suit.replace("_DRAGON", "")
        actual_suit = suit_mapping.get(vsuit_key, "Bam")
        return SUIT_DRAGON_INDEX[actual_suit]

    elif suit.startswith("VSUIT"):
        # Variable suit tile
        actual_suit = suit_mapping.get(suit, "Bam")
        base = SUIT_BASES[actual_suit]
        return base + (number - 1)  # number is 1-9, index is 0-8

    elif suit == "Wind":
        return WIND_INDEX.get(number, 27)

    elif suit == "Dragon":
        return DRAGON_INDEX.get(number, 31)

    elif suit == "Flower":
        return FLOWER_INDEX

    else:
        raise ValueError(f"Unknown suit: {suit}")


def build_histogram(components: list[dict[str, Any]],
                    suit_mapping: dict[str, str],
                    number_base: int,
                    dragon_mapping: dict[str, int] | None = None,
                    wind_override: int | None = None) -> list[int]:
    """
    Build a 42-element histogram from pattern components.

    Args:
        components: List of component dicts with suit, number, count
        suit_mapping: Dict mapping VSUIT* to actual suits
        number_base: Starting number for consecutive sequences
        dragon_mapping: Optional dict mapping VSUIT*_DRAGON to dragon indices

    Returns:
        42-element list of tile counts
    """
    histogram = [0] * HISTOGRAM_SIZE

    for comp in components:
        suit = comp["suit"]
        number = comp["number"]
        count = comp["count"]

        # Resolve wildcard numbers
        actual_number = resolve_number(number, number_base)
        if suit == "Wind" and wind_override is not None:
            actual_number = wind_override

        # Get histogram index
        idx = get_tile_index(suit, actual_number, suit_mapping, dragon_mapping)

        # Add to histogram
        histogram[idx] += count

    return histogram


def build_ineligible_histogram(components: list[dict[str, Any]],
                               suit_mapping: dict[str, str],
                               number_base: int,
                               dragon_mapping: dict[str, int] | None = None,
                               wind_override: int | None = None) -> list[int]:
    """
    Build the ineligible_histogram showing tiles that CANNOT use jokers.

    Joker eligibility rules (NMJL):
    - Singles (count=1): Cannot use jokers -> add to ineligible
    - Pairs (count=2): Cannot use jokers -> add to ineligible
    - Flowers: Cannot use jokers regardless of count -> add to ineligible
    - Pungs/Kongs/Quints (count>=3): CAN use jokers -> not ineligible

    Args:
        components: List of component dicts with suit, number, count
        suit_mapping: Dict mapping VSUIT* to actual suits
        number_base: Starting number for consecutive sequences
        dragon_mapping: Optional dict mapping VSUIT*_DRAGON to dragon indices

    Returns:
        42-element list of ineligible tile counts
    """
    ineligible = [0] * HISTOGRAM_SIZE

    # First, calculate total counts per tile to determine eligibility
    # This handles cases where multiple components contribute to the same tile
    tile_totals: dict[int, int] = {}

    for comp in components:
        suit = comp["suit"]
        number = comp["number"]
        count = comp["count"]

        actual_number = resolve_number(number, number_base)
        if suit == "Wind" and wind_override is not None:
            actual_number = wind_override
        idx = get_tile_index(suit, actual_number, suit_mapping, dragon_mapping)

        tile_totals[idx] = tile_totals.get(idx, 0) + count

    # Now build ineligible based on totals
    for comp in components:
        suit = comp["suit"]
        number = comp["number"]
        count = comp["count"]

        actual_number = resolve_number(number, number_base)
        if suit == "Wind" and wind_override is not None:
            actual_number = wind_override
        idx = get_tile_index(suit, actual_number, suit_mapping, dragon_mapping)

        total_for_tile = tile_totals.get(idx, count)

        # Flowers are always ineligible for jokers
        if suit == "Flower":
            ineligible[idx] += count
        # Singles and pairs are ineligible
        elif total_for_tile <= 2:
            ineligible[idx] += count
        # Pungs, kongs, quints (>=3) are eligible for jokers
        # so we don't add them to ineligible

    return ineligible


# =============================================================================
# VARIATION GENERATION
# =============================================================================

def generate_variations(hand: dict[str, Any],
                        category: str,
                        pattern_id: str) -> list[dict[str, Any]]:
    """
    Generate all histogram variations for a hand pattern.

    This expands:
    1. Variable suits (VSUIT1/2/3) into actual suits
    2. Wildcard numbers (100-104) into concrete consecutive sequences
    3. "Any Dragon" patterns into dragon permutations

    Args:
        hand: The legacy hand dict with components, vsuit_count, etc.
        category: The unified category name
        pattern_id: The base pattern ID

    Returns:
        List of variation dicts with id, histogram, ineligible_histogram
    """
    components = hand["components"]
    vsuit_count = hand.get("vsuit_count", 0)
    odd_only = hand.get("odd", False)
    even_only = hand.get("even", False)
    any_wind = has_any_wind_pattern(hand["description"], components)

    variations = []

    # Find max wildcard number used
    max_wildcard = max(
        (c["number"] for c in components if c["number"] >= 100),
        default=0
    )

    # Get all number ranges for wildcards
    if max_wildcard >= 100:
        number_ranges = get_consecutive_ranges(max_wildcard, odd_only, even_only)
    else:
        number_ranges = [1]  # Single dummy value for no wildcards

    # Get all suit permutations
    suit_perms = get_suit_permutations(vsuit_count)

    # Check if this is an "Any Dragon" pattern
    is_any_dragon = has_any_dragon_pattern(components, vsuit_count)
    if is_any_dragon:
        dragon_perms = get_dragon_permutations(components)
    else:
        dragon_perms = [None]  # Single None means use suit-based dragon mapping
    wind_numbers = [1, 2, 3, 4] if any_wind else [None]

    # Special handling for vsuit_count=5 (consecutive with varying pair position)
    if vsuit_count == 5:
        variations = generate_vsuit5_variations(
            hand, category, pattern_id,
            number_ranges, suit_perms
        )
    else:
        # Standard expansion: suit permutations × number ranges × dragon permutations
        # Use a set to deduplicate identical histograms
        seen_histograms: set[tuple[int, ...]] = set()

        for number_base in number_ranges:
            for suit_mapping in suit_perms:
                for dragon_mapping in dragon_perms:
                    for wind_override in wind_numbers:
                        histogram = build_histogram(
                            components, suit_mapping, number_base,
                            dragon_mapping, wind_override
                        )
                        ineligible = build_ineligible_histogram(
                            components, suit_mapping, number_base,
                            dragon_mapping, wind_override
                        )

                        # Deduplicate based on histogram
                        hist_key = tuple(histogram)
                        if hist_key not in seen_histograms:
                            seen_histograms.add(hist_key)
                            variations.append({
                                "id": "",  # ID assigned after deduplication
                                "histogram": histogram,
                                "ineligible_histogram": ineligible,
                            })

        # Assign sequential IDs after deduplication
        for i, v in enumerate(variations, 1):
            v["id"] = f"{pattern_id}-SEQ{i}"

    return variations


def generate_vsuit5_variations(hand: dict[str, Any],
                               category: str,
                               pattern_id: str,
                               number_ranges: list[int],
                               suit_perms: list[dict[str, str]]) -> list[dict[str, Any]]:
    """
    Generate variations for vsuit_count=5 patterns.

    These are special consecutive patterns where:
    - A run of consecutive numbers is in one suit
    - Kongs are in the other two suits
    - The pair position can be any number in the run

    Example: "112345 1111 1111"
    - 5 consecutive numbers with one as a pair
    - Two kongs matching the pair number in other suits
    """
    components = hand["components"]
    variations = []

    # Find the run components (VSUIT1 with wildcards)
    run_comps = [c for c in components
                 if c["suit"] == "VSUIT1" and c["number"] >= 100]
    run_numbers = sorted({c["number"] for c in run_comps})

    # Find which wildcard number has the pair (count > 1 in run)
    pair_wildcards = [c["number"] for c in run_comps if c["count"] == 2]

    if not run_numbers or not pair_wildcards:
        # Fallback to standard expansion
        seq = 1
        for number_base in number_ranges:
            for suit_mapping in suit_perms:
                histogram = build_histogram(components, suit_mapping, number_base)
                ineligible = build_ineligible_histogram(
                    components, suit_mapping, number_base
                )
                variations.append({
                    "id": f"{pattern_id}-SEQ{seq}",
                    "histogram": histogram,
                    "ineligible_histogram": ineligible,
                })
                seq += 1
        return variations

    # For each starting position, each pair position, and each suit arrangement
    # (dedupe because VSUIT2/VSUIT3 are symmetric kongs)
    seen_histograms: set[tuple[int, ...]] = set()

    for number_base in number_ranges:
        for suit_mapping in suit_perms:
            for pair_number in run_numbers:
                adjusted_components = []
                for comp in components:
                    suit = comp["suit"]
                    number = comp["number"]
                    count = comp["count"]

                    if suit == "VSUIT1" and number in run_numbers:
                        # Move the pair to the selected run position
                        count = 2 if number == pair_number else 1
                    elif suit in ("VSUIT2", "VSUIT3") and number >= 100:
                        # Kongs match the pair position in the run
                        number = pair_number

                    adjusted_components.append({
                        "suit": suit,
                        "number": number,
                        "count": count,
                    })

                histogram = build_histogram(
                    adjusted_components, suit_mapping, number_base
                )
                ineligible = build_ineligible_histogram(
                    adjusted_components, suit_mapping, number_base
                )

                hist_key = tuple(histogram)
                if hist_key not in seen_histograms:
                    seen_histograms.add(hist_key)
                    variations.append({
                        "id": "",  # ID assigned after deduplication
                        "histogram": histogram,
                        "ineligible_histogram": ineligible,
                    })

    # Assign sequential IDs after deduplication
    for i, v in enumerate(variations, 1):
        v["id"] = f"{pattern_id}-SEQ{i}"

    return variations


# =============================================================================
# MAIN CONVERSION
# =============================================================================

def convert_legacy_to_unified(legacy_data: dict[str, Any],
                              year: int) -> dict[str, Any]:
    """
    Convert a legacy card data structure to unified format.

    Args:
        legacy_data: The loaded legacy JSON data
        year: The card year

    Returns:
        Unified format dict ready for JSON serialization
    """
    patterns = []

    def year_section_key(hand: dict[str, Any]) -> tuple[Any, ...]:
        """
        Group key for year sections that ignores fixed number values.

        This merges hands that represent alternate number choices (e.g. 2s vs 5s)
        while preserving suit/count structure and wildcards.
        """
        fixed_items: list[tuple[str, int]] = []
        wildcard_items: list[tuple[str, int, int]] = []
        other_items: list[tuple[str, int, int]] = []

        for comp in hand["components"]:
            suit = comp["suit"]
            number = comp["number"]
            count = comp["count"]

            if suit in ("Wind", "Dragon", "Flower"):
                other_items.append((suit, count))
            elif number >= 100:
                wildcard_items.append((suit, number, count))
            else:
                fixed_items.append((suit, count))

        return (
            tuple(sorted(fixed_items)),
            tuple(sorted(wildcard_items)),
            tuple(sorted(other_items)),
            hand.get("vsuit_count", 0),
            hand.get("concealed", False),
            hand.get("odd", False),
            hand.get("even", False),
        )

    def family_key_for_hand(hand: dict[str, Any], is_year_section: bool) -> tuple[Any, ...]:
        """
        Pattern family key for assigning pattern numbers (variants share a family).

        This ignores fixed number values but preserves how numbers are grouped across
        components, plus wildcard structure and special tiles.
        """
        if is_year_section:
            return year_section_key(hand)

        def normalize_suit(suit: str) -> str:
            if suit.startswith("VSUIT") and "_DRAGON" in suit:
                return "VSUIT_DRAGON"
            if suit.startswith("VSUIT"):
                return "VSUIT"
            return suit

        fixed_groups: dict[int, list[tuple[str, int]]] = {}
        wildcard_items: list[tuple[str, int, int]] = []
        other_items: list[tuple[str, int, int]] = []

        for comp in hand["components"]:
            suit = normalize_suit(comp["suit"])
            number = comp["number"]
            count = comp["count"]

            if suit in ("Wind", "Dragon", "Flower"):
                other_items.append((suit, count))
            elif number >= 100:
                wildcard_items.append((suit, number, count))
            else:
                fixed_groups.setdefault(number, []).append((suit, count))

        group_descs = [tuple(sorted(items)) for items in fixed_groups.values()]
        return (
            tuple(sorted(group_descs)),
            tuple(sorted(wildcard_items)),
            tuple(sorted(other_items)),
            hand.get("concealed", False),
            hand.get("odd", False),
            hand.get("even", False),
        )

    for section in legacy_data["sections"]:
        section_name = section["group_description"]
        unified_category = CATEGORY_MAP.get(section_name, section_name)
        is_year_section = section_name == str(year)

        # Track pattern numbering per description in this section
        section_hand_number = 0
        family_to_pattern_num: dict[tuple[Any, ...], int] = {}
        family_to_variant_count: dict[tuple[Any, ...], int] = {}

        groups: dict[tuple[Any, ...], dict[str, Any]] = {}

        for hand in section["hands"]:
            description = hand["description"]
            concealed = hand.get("concealed", False)

            # Clean up description (remove parenthetical notes)
            clean_desc = description
            if " (" in clean_desc:
                clean_desc = clean_desc[:clean_desc.index(" (")]

            if is_year_section:
                group_key = year_section_key(hand)
            else:
                group_key = (
                    clean_desc,
                    hand.get("vsuit_count", 0),
                    concealed,
                    hand.get("odd", False),
                    hand.get("even", False),
                )

            if group_key in groups:
                groups[group_key]["hands"].append(hand)
                continue

            # Assign pattern and variant numbers based on family structure
            family_key = family_key_for_hand(hand, is_year_section)
            if family_key not in family_to_pattern_num:
                section_hand_number += 1
                family_to_pattern_num[family_key] = section_hand_number
                family_to_variant_count[family_key] = 0

            family_to_variant_count[family_key] += 1
            pattern_num = family_to_pattern_num[family_key]
            variant_num = family_to_variant_count[family_key]

            groups[group_key] = {
                "pattern_num": pattern_num,
                "variant_num": variant_num,
                "description": clean_desc,
                "concealed": concealed,
                "hands": [hand],
            }

        for group in groups.values():
            pattern_num = group["pattern_num"]
            variant_num = group["variant_num"]
            clean_desc = group["description"]
            concealed = group["concealed"]

            # Generate pattern ID
            category_key = unified_category.replace(" ", "_")
            pattern_id = f"{year}-{category_key}-{pattern_num}-{variant_num}"

            # Get score
            score = get_score(unified_category, clean_desc, concealed)

            # Merge variations across all hands in this group
            merged_variations: list[dict[str, Any]] = []
            seen_histograms: set[tuple[int, ...]] = set()

            for hand in group["hands"]:
                variations = generate_variations(hand, unified_category, pattern_id)
                for var in variations:
                    hist_key = tuple(var["histogram"])
                    if hist_key in seen_histograms:
                        continue
                    seen_histograms.add(hist_key)
                    merged_variations.append({
                        "id": "",  # Assigned after merge
                        "histogram": var["histogram"],
                        "ineligible_histogram": var["ineligible_histogram"],
                    })

            for i, v in enumerate(merged_variations, 1):
                v["id"] = f"{pattern_id}-SEQ{i}"

            pattern = {
                "id": pattern_id,
                "category": unified_category,
                "description": clean_desc,
                "score": score,
                "concealed": concealed,
                "structure": [],  # Placeholder, not populated from legacy
                "variations": merged_variations,
            }

            patterns.append(pattern)

    # Build unified structure
    unified = {
        "meta": {
            "year": year,
            "version": "2.0-final-fixed",
            "generated_at": datetime.datetime.now().strftime("%Y-%m-%d"),
        },
        "patterns": patterns,
    }

    return unified


def main():
    parser = argparse.ArgumentParser(
        description="Convert legacy card JSON to unified format"
    )
    parser.add_argument(
        "input",
        help="Path to legacy card JSON file (e.g., card2025.json)"
    )
    parser.add_argument(
        "output",
        help="Path for output unified JSON file"
    )
    parser.add_argument(
        "--csv",
        help="Path to CSV file for score lookup (optional)",
        default=None
    )
    parser.add_argument(
        "--year",
        type=int,
        help="Override the card year (default: from input filename)",
        default=None
    )

    args = parser.parse_args()

    # Load scores from CSV if provided
    global SCORE_LOOKUP
    if args.csv:
        print(f"Loading scores from {args.csv}...")
        SCORE_LOOKUP = load_scores_from_csv(args.csv)
        print(f"  Loaded {len(SCORE_LOOKUP)} score entries")

    # Load legacy data
    print(f"Reading {args.input}...")
    with open(args.input) as f:
        legacy_data = json.load(f)

    # Determine year
    year = args.year or legacy_data.get("year", 2025)

    # Convert
    print(f"Converting year {year}...")
    unified = convert_legacy_to_unified(legacy_data, year)

    # Write output
    print(f"Writing {args.output}...")
    with open(args.output, "w") as f:
        json.dump(unified, f, indent=2)

    # Summary
    total_variations = sum(len(p["variations"]) for p in unified["patterns"])
    print(f"Success! Converted {len(unified['patterns'])} patterns "
          f"with {total_variations} variations")


if __name__ == "__main__":
    main()
