# TileSelectionPanel

## Purpose

Charleston tile selection UI for choosing exactly 3 tiles to pass. Provides selection feedback, rules guidance, and confirm action.

## User Stories

- US-002: Charleston pass action

## Props

```typescript
interface TileSelectionPanelProps {
  handTiles: Tile[]; // player hand tiles (sorted)
  selectedIndices: number[]; // indices into handTiles
  maxSelection: number; // usually 3
  isBlindPass?: boolean; // true when selecting 1–2 tiles for blind pass
  isLocked?: boolean; // disable interaction when waiting/timeout
  onToggleIndex: (index: number) => void;
  onConfirm: (payload: { tiles: Tile[]; blindPassCount?: number | null }) => void;
  onClear?: () => void;
}
```text

## Behavior

- Allows selecting up to `maxSelection` tiles from `handTiles`.
- If `isBlindPass` is true, allow 1–2 tiles and display “Blind Pass” label.
- Confirm button enabled only when selection count is valid for current mode.
- If `isLocked` is true, selection is disabled and panel shows “Waiting”.
- `onClear` resets selection (optional).

## Visual Requirements

### Layout

```text
┌───────────────────────────────────────────┐
│ Select 3 tiles to pass   [Clear]          │
│ [tile][tile][tile][tile][tile]...         │
│ Selected: 2 / 3          [Confirm Pass]   │
└───────────────────────────────────────────┘
```text

- Top row: instruction text + optional Clear button
- Middle: tile row/grid (interactive)
- Bottom: selection count + confirm button

### Selection States

- **Selected tile**: Raised/outlined, check icon overlay
- **Unselected tile**: Normal
- **Disabled**: Grayed out, no hover

### Accessibility

- Each tile has aria-pressed for selection state.
- Confirm button has aria-disabled when invalid.

## Related Components

- **Used by**: `<GameBoard>` and/or `<ActionBar>`
- **Uses**: `<Tile>` for rendering tiles
- **Uses**: shadcn/ui `<Button>`, `<Badge>`, `<Card>`

## Implementation Notes

- Selection should use hand indices to avoid duplicate ambiguity.
- Do not allow jokers if backend forbids them (Joker is tile index 35).
```
