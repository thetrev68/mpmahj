# ExposedMelds

## Purpose

Displays a player's exposed melds (Pungs, Kongs, Quints) with visual indicators for which tile was called. Shows meld type and arranges tiles horizontally.

## User Stories

- US-013: Exposed melds display after calling
- US-014: Joker exchange in exposed melds
- US-019: End of hand - review exposed melds

## Props

```typescript
interface ExposedMeldsProps {
  /** Array of melds for this player */
  melds: Meld[];

  /** Display options */
  compact?: boolean; // Smaller tiles for opponents
  orientation?: 'horizontal' | 'vertical'; // Default: horizontal
}

// Use Meld from bindings: { meld_type, tiles, called_tile, joker_assignments }
```

## Behavior

### Meld Display

- Each meld is a horizontal group of tiles
- Melds displayed left-to-right in exposure order
- Called tile rotated 90° to indicate it was claimed (`called_tile`)
- Spacing between melds (16px gap)

### Meld Types

- **Pung**: 3 identical tiles (e.g., 3× 5 Bam (4))
- **Kong**: 4 identical tiles (e.g., 4× Red Dragon (32))
- **Quint**: 5 identical tiles (e.g., 5× Joker (35) - rare)

### Called Tile Indicator

If `calledTileIndex` is set:

- Rotate that tile 90° clockwise
- Slight visual offset (2px lower)
- Shows which tile came from another player's discard

### Empty State

- Show placeholder: "No exposed melds"
- Or render nothing if `melds.length === 0`

## Visual Requirements

### Layout

```text
┌──────────────────────────────────────────┐
│ [Pung: tile tile ⟲tile]  [Kong: ...]    │
│ ↑ called tile rotated                    │
└──────────────────────────────────────────┘
```

### Tile Sizing

- **Standard**: Medium tiles (45×60px)
- **Compact**: Small tiles (32×42px)

### Meld Spacing

- Between tiles in meld: 2px
- Between melds: 16px
- Between melds and hand: 24px

## Related Components

- **Uses**: `<Tile>` or `<TileGroup>`
- **Used by**: `<PlayerRack>`

## Implementation Notes

### Meld Rendering

```typescript
function renderMeld(meld: Meld) {
  return (
    <div className="meld-group flex gap-0.5">
      {meld.tiles.map((tile, idx) => (
        <Tile
          key={idx}
          tile={tile}
          rotated={meld.called_tile === tile}
          size={compact ? 'small' : 'medium'}
        />
      ))}
    </div>
  );
}
```

### Server Integration

Melds created via backend events:

```typescript
// PublicEvent::TileCalled provides meld data
```

## Accessibility

- Container: `role="list"` `aria-label="Exposed melds"`
- Each meld: `role="listitem"` `aria-label="{type} of {tile name}"`
- Called tile: `aria-label="{tile name}, called from discard"`

## Example Usage

```tsx
// Current player's exposed melds
<ExposedMelds
  melds={myMelds}
  compact={false}
  orientation="horizontal"
/>

// Opponent's exposed melds (compact)
<ExposedMelds
  melds={opponentMelds}
  compact={true}
/>
```

## Edge Cases

1. **No melds**: Render empty state or nothing
2. **Many melds (4+)**: Wrap to multiple rows if needed
3. **Joker in meld**: Clearly visible, can be exchanged (US-014)
4. **Kong upgrade**: Pung → Kong transition (smooth animation)

---

**Estimated Complexity**: Simple (~80-100 lines)
**Dependencies**: `<Tile>`
**Phase**: Phase 1 - MVP Core (Critical)
