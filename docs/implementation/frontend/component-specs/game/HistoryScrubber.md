# HistoryScrubber

## Purpose

Navigation controls for jumping through game history. Provides scrubber bar, play/pause, and step controls for reviewing past moves.

## User Stories

- US-025: Jump to specific move in history
- US-026: Replay game moves with controls

## Props

```typescript
interface HistoryScrubberProps {
  /** Total number of moves in history */
  totalMoves: number;

  /** Current move number (0 = start, totalMoves = present) */
  currentMove: number;

  /** Callback when user seeks to a move */
  onSeek: (moveNumber: number) => void;

  /** Callback to return to present */
  onReturnToPresent: () => void;

  /** Auto-play state */
  isPlaying?: boolean;

  /** Auto-play speed (moves per second) */
  playbackSpeed?: number;
}
```

## Behavior

### Scrubber Bar

- Slider from 0 (game start) to totalMoves (present)
- Drag to scrub through history
- Click anywhere on bar to jump
- Marks at decision points (optional)

### Playback Controls

- **Play/Pause:** Auto-advance through moves at playbackSpeed
- **Step Back:** Jump to previous move
- **Step Forward:** Jump to next move
- **Return to Present:** Jump to current game state

### Visual Feedback

- Disable "forward" if at present
- Disable "play" if at present
- Show "You are viewing history" banner when not at present

## Visual Requirements

```text
┌────────────────────────────────────────────┐
│ ⚠️ Viewing History - Move 42/156           │
│                                            │
│ [◀◀] [▶] [▶▶]  ├───●─────────────┤  [Now] │
│                Move 42                     │
│                                            │
│ Speed: [1x ▼]                              │
└────────────────────────────────────────────┘
```

## Related Components

- **Used by**: Replay viewer, `<MoveHistoryList>`
- **Uses**: shadcn/ui `<Slider>`, `<Button>`, `<Select>`
- **Integrates with**: Backend commands `JumpToMove`, `ReturnToPresent`

## Implementation Notes

### Jump to Move

```typescript
const handleSeek = async (moveNumber: number) => {
  await sendCommand({
    JumpToMove: { player: currentSeat, target_move: moveNumber },
  });
};
```

### Auto-Play

```typescript
useEffect(() => {
  if (!isPlaying || currentMove >= totalMoves) return;

  const interval = setInterval(() => {
    onSeek(currentMove + 1);
  }, 1000 / playbackSpeed);

  return () => clearInterval(interval);
}, [isPlaying, currentMove, playbackSpeed, totalMoves]);
```

### Return to Present

```typescript
const handleReturnToPresent = async () => {
  await sendCommand({ ReturnToPresent: { player: currentSeat } });
};
```

## Accessibility

- Slider: `aria-label="History scrubber"`
- Buttons: Proper labels ("Previous move", "Next move", "Return to present")
- Keyboard: Arrow keys step through moves, Home/End jump to start/present

## Example Usage

```tsx
<HistoryScrubber
  totalMoves={156}
  currentMove={42}
  onSeek={handleSeek}
  onReturnToPresent={handleReturnToPresent}
  playbackSpeed={1}
/>
```

## Edge Cases

1. **At present:** Disable play/forward controls
2. **At start:** Disable step back
3. **Rapid seeking:** Debounce to prevent command spam
4. **Playback at end:** Auto-pause

---

**Estimated Complexity**: Simple (~80 lines)
**Dependencies**: shadcn/ui Slider, Button, Select
**Phase**: Phase 6 - Polish & Advanced (Optional)
