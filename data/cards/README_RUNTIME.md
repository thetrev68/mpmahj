# Runtime Card: The "Engine-Ready" Format

## Overview

The `runtime_card.json` file is a high-performance, pre-compiled database of every valid Mahjong hand. Unlike human-readable rulebooks, this format is designed for **O(1) mathematical operations**.

It flattens abstract rules (like "Any 3 Consecutive Numbers") into thousands of concrete, unique target hands.

---

## 1. JSON Schema

The file is a JSON Array of `Hand` objects.

```json
[
  {
    "id": "2025-Line1-Var3-SEQ1",
    "score": 25,
    "concealed": false,
    "required_counts": [0, 2, 0, ..., 4]
  }
]

```

### Fields

| Field                 | Type         | Description                                                                                                        |
| --------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------ |
| **`id`**              | `String`     | Unique key combining the **Rule ID** and the **Variation Sequence**. Format: `"{HandKey}-SEQ{VariantNumber}"`.     |
| **`score`**           | `Integer`    | The point value of the hand (e.g., 25, 50).                                                                        |
| **`concealed`**       | `Boolean`    | `true` if the hand must be concealed (no exposures allowed).                                                       |
| **`required_counts`** | `Array<Int>` | **The Histogram.** A fixed-size array of **42 integers** representing the exact count of every tile needed to win. |

---

## 2. The Decoder Ring (Index Map)

The `required_counts` array maps specific array indices to specific tiles. The engine does not know "Bam" or "Green Dragon"—it only knows "Index 0" or "Index 31".

### Suits (0 - 26)

| Index Range | Suit      | Mapping                              |
| ----------- | --------- | ------------------------------------ |
| **0 - 8**   | **Bams**  | `0`=1Bam, `1`=2Bam ... `8`=9Bam      |
| **9 - 17**  | **Craks** | `9`=1Crak, `10`=2Crak ... `17`=9Crak |
| **18 - 26** | **Dots**  | `18`=1Dot, `19`=2Dot ... `26`=9Dot   |

### Winds (27 - 30)

| Index  | Tile  |
| ------ | ----- |
| **27** | East  |
| **28** | South |
| **29** | West  |
| **30** | North |

### Dragons (31 - 33)

| Index  | Tile         | Note                                                                  |
| ------ | ------------ | --------------------------------------------------------------------- |
| **31** | Green Dragon | Associated with **Bam** suits in rules.                               |
| **32** | Red Dragon   | Associated with **Crak** suits in rules.                              |
| **33** | White Dragon | Also known as **Soap**. Used as '0' in numeric patterns (e.g., 2025). |

### Specials (34+)

| Index     | Tile      |
| --------- | --------- |
| **34**    | Flower    |
| **35-41** | _Padding_ |

---

## 3. How to Read a Histogram

**Example Hand:** `FFFF 2025 222 222` (Bam/Crak/Dot mix)

**Tiles Needed:**

- 4 Flowers
- 1 White Dragon (Soap/0)
- 2x 2-Bams, 1x 5-Bam
- 3x 2-Craks
- 3x 2-Dots

**The Array:**

```javascript
Index:  0  1  2  3  4  5 ... 10 ... 19 ... 33  34
Value: [0, 2, 0, 0, 1, 0 ...  3 ...  3 ...  1,  4, ...]

```

- **Index 1 (2-Bam):** Value `2`
- **Index 4 (5-Bam):** Value `1`
- **Index 10 (2-Crak):** Value `3`
- **Index 19 (2-Dot):** Value `3`
- **Index 33 (Soap):** Value `1`
- **Index 34 (Flower):** Value `4`

## 4. Why This Format?

This structure allows the engine to calculate the "Distance to Win" for 1,000+ hands in microseconds using simple vector subtraction:

$$ \text{Missing Tiles} = \text{Max}(0, \text{TargetArray}[i] - \text{YourHandArray}[i]) $$
