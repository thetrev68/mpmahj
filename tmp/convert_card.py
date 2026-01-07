import pandas as pd
import json
import datetime

def convert_csv_to_unified_json(csv_filename, output_filename):
    print(f"Reading {csv_filename}...")
    df = pd.read_csv(csv_filename)
    
    # Sort by hand_key and sequence to ensure order
    df = df.sort_values(by=['hand_key', 'sequence'])

    # --- 1. Define the Index Mapping ---
    def get_tile_index(tile_str):
        if pd.isna(tile_str): return None
        t = str(tile_str).strip().lower()
        
        # Specials
        if t == 'flower': return 34
        if 'green' in t:  return 31
        if 'red' in t:    return 32
        if 'white' in t or 'soap' in t: return 33
        
        # Winds
        if t == 'east':  return 27
        if t == 'south': return 28
        if t == 'west':  return 29
        if t == 'north': return 30
        
        # Numeric Suits (e.g., "1B", "5C", "9D")
        if len(t) >= 2 and t[0].isdigit():
            val = int(t[0])
            suit = t[1].upper()
            
            if suit == 'B': return val - 1       # 0 - 8  (Bam)
            if suit == 'C': return val - 1 + 9   # 9 - 17 (Crak)
            if suit == 'D': return val - 1 + 18  # 18 - 26 (Dot)
            
        return None

    # --- 2. Group by Pattern ---
    patterns = []
    
    # Group by hand_key to form Patterns
    for hand_key, group in df.groupby('hand_key', sort=False):
        first_row = group.iloc[0]
        
        # Pattern Metadata
        pattern = {
            "id": str(hand_key),
            "category": str(first_row['section']),
            "description": str(first_row['hand_criteria']),
            "score": int(first_row['hand_points']),
            "concealed": str(first_row['hand_conceiled']).strip().upper() == 'TRUE',
            "structure": [], # Placeholder, not populated from CSV
            "variations": []
        }
        
        # Variations
        for _, row in group.iterrows():
            total_histogram = [0] * 42
            ineligible_histogram = [0] * 42
            
            # Iterate 1..14 tile slots
            for i in range(1, 15):
                tile_col = f'tile_{i}_id'
                joker_col = f'tile_{i}_joker'
                
                if tile_col in row and not pd.isna(row[tile_col]):
                    idx = get_tile_index(row[tile_col])
                    if idx is not None:
                        # Add to total histogram
                        total_histogram[idx] += 1
                        
                        # Check joker eligibility
                        # If "no", add to ineligible histogram
                        if str(row[joker_col]).strip().lower() == 'no':
                            ineligible_histogram[idx] += 1
            
            # Construct Variation ID
            var_id = f"{hand_key}-SEQ{row['sequence']}"
            
            variation = {
                "id": var_id,
                "histogram": total_histogram,
                "ineligible_histogram": ineligible_histogram
            }
            pattern["variations"].append(variation)
            
        patterns.append(pattern)

    # --- 3. Build Unified Card Object ---
    unified_card = {
        "meta": {
            "year": 2025,
            "version": "2.0-final-fixed",
            "generated_at": datetime.datetime.now().strftime("%Y-%m-%d")
        },
        "patterns": patterns
    }

    # --- 4. Save to JSON ---
    with open(output_filename, 'w') as f:
        json.dump(unified_card, f, indent=2)
    
    print(f"Success! Converted {len(patterns)} patterns with {sum(len(p['variations']) for p in patterns)} variations to {output_filename}")

if __name__ == "__main__":
    convert_csv_to_unified_json('tmp/NMJL 2025 Card - Playable.csv', 'data/cards/unified_card2025.json')
