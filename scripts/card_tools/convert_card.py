import csv
import datetime
import json

try:
    import pandas as pd
except ImportError:  # pragma: no cover - optional dependency
    pd = None


def load_rows(csv_filename):
    if pd is not None:
        df = pd.read_csv(csv_filename)
        return df.to_dict(orient="records")

    with open(csv_filename, newline='') as fh:
        reader = csv.DictReader(fh)
        return list(reader)


def get_tile_index(tile_str):
    if tile_str is None:
        return None

    t = str(tile_str).strip().lower()
    if not t:
        return None

    # Specials
    if t == 'flower':
        return 34
    if 'green' in t:
        return 31
    if 'red' in t:
        return 32
    if 'white' in t or 'soap' in t:
        return 33

    # Winds
    if t == 'east':
        return 27
    if t == 'south':
        return 28
    if t == 'west':
        return 29
    if t == 'north':
        return 30

    # Numeric Suits (e.g., "1B", "5C", "9D")
    if len(t) >= 2 and t[0].isdigit():
        val = int(t[0])
        suit = t[1].upper()

        if suit == 'B':
            return val - 1       # 0 - 8  (Bam)
        if suit == 'C':
            return val - 1 + 9   # 9 - 17 (Crak)
        if suit == 'D':
            return val - 1 + 18  # 18 - 26 (Dot)

    return None


def convert_csv_to_unified_json(csv_filename, output_filename):
    print(f"Reading {csv_filename}...")
    rows = load_rows(csv_filename)

    # Sort by hand_key and sequence to ensure order
    rows.sort(key=lambda r: (str(r.get('hand_key', '')), int(r.get('sequence', 0))))

    patterns = []
    current_key = None
    current_pattern = None

    for row in rows:
        hand_key = str(row.get('hand_key', '')).strip()
        if not hand_key:
            continue

        if hand_key != current_key:
            if current_pattern is not None:
                patterns.append(current_pattern)

            current_key = hand_key
            pattern = {
                "id": hand_key,
                "category": str(row.get('section', '')).strip(),
                "description": str(row.get('hand_pattern', '')).strip(),
                "score": int(row.get('hand_points', 0)),
                "concealed": str(row.get('hand_conceiled', '')).strip().upper() == 'TRUE',
                "structure": [],  # Placeholder, not populated from CSV
                "variations": [],
            }
            current_pattern = pattern

        total_histogram = [0] * 42

        # First pass: Build total histogram
        for i in range(1, 15):
            tile_col = f'tile_{i}_id'
            tile_value = row.get(tile_col)
            if tile_value is None or str(tile_value).strip() == '':
                continue

            idx = get_tile_index(tile_value)
            if idx is None:
                continue

            total_histogram[idx] += 1

        # Second pass: Build ineligible histogram
        # NMJL rules: Singles (count=1) and pairs (count=2) can NEVER use jokers.
        # Flowers can NEVER use jokers regardless of count.
        # Pungs/Kongs/Quints (count>=3) follow the CSV joker flag.
        ineligible_histogram = [0] * 42

        for i in range(1, 15):
            tile_col = f'tile_{i}_id'
            joker_col = f'tile_{i}_joker'
            tile_value = row.get(tile_col)
            if tile_value is None or str(tile_value).strip() == '':
                continue

            idx = get_tile_index(tile_value)
            if idx is None:
                continue

            tile_lower = str(tile_value).strip().lower()
            joker_flag = str(row.get(joker_col, '')).strip().lower()
            tile_count = total_histogram[idx]

            # Flowers are always ineligible for jokers
            # Singles (count=1) and pairs (count=2) are always ineligible
            # Groups of 3+ follow the CSV joker flag
            if tile_lower == 'flower' or tile_count <= 2 or joker_flag == 'no':
                ineligible_histogram[idx] += 1

        var_id = f"{hand_key}-SEQ{row.get('sequence')}"

        current_pattern["variations"].append({
            "id": var_id,
            "histogram": total_histogram,
            "ineligible_histogram": ineligible_histogram,
        })

    if current_pattern is not None:
        patterns.append(current_pattern)

    unified_card = {
        "meta": {
            "year": 2025,
            "version": "2.0-final-fixed",
            "generated_at": datetime.datetime.now().strftime("%Y-%m-%d"),
        },
        "patterns": patterns,
    }

    with open(output_filename, 'w') as fh:
        json.dump(unified_card, fh, indent=2)

    variation_count = sum(len(p["variations"]) for p in patterns)
    print(
        f"Success! Converted {len(patterns)} patterns with {variation_count} variations to {output_filename}"
    )


if __name__ == "__main__":
    convert_csv_to_unified_json(
        'scripts/card_tools/NMJL_2025_Card_Playable.csv',
        'data/cards/unified_card2025.json',
    )
