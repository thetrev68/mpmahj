import pandas as pd
import json

def convert_csv_to_engine_json(csv_filename, output_filename):
    # Load the CSV
    df = pd.read_csv(csv_filename)
    
    runtime_hands = []

    # --- 1. Define the Index Mapping ---
    def get_tile_index(tile_str):
        if pd.isna(tile_str): return None
        # Normalize: strip whitespace and lowercase
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

    # --- 2. Iterate and Convert ---
    # Identify tile columns tile_1_id ... tile_14_id
    tile_columns = [f'tile_{i}_id' for i in range(1, 15)]

    for _, row in df.iterrows():
        # A. Build the Histogram (42 integers)
        counts = [0] * 42
        
        for col in tile_columns:
            if col in row:
                idx = get_tile_index(row[col])
                if idx is not None:
                    counts[idx] += 1
        
        # B. Generate Unique ID
        # Format: "2025-Line1-Var3-SEQ1"
        unique_id = f"{row['hand_key']}-SEQ{row['sequence']}"

        # C. Handle Boolean safely
        # Pandas might read 'FALSE' as a string or bool depending on the version
        is_concealed = str(row['hand_conceiled']).strip().upper() == 'TRUE'

        hand_obj = {
            "id": unique_id,
            "score": int(row['hand_points']),
            "concealed": is_concealed,
            "required_counts": counts
        }
        
        runtime_hands.append(hand_obj)

    # --- 3. Save to JSON ---
    with open(output_filename, 'w') as f:
        json.dump(runtime_hands, f, indent=2)
    
    print(f"Success! Converted {len(runtime_hands)} unique hands to {output_filename}")

if __name__ == "__main__":
    convert_csv_to_engine_json('NMJL 2025 Card - Playable.csv', 'runtime_card.json')