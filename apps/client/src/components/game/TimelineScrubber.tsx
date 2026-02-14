/**
 * @module TimelineScrubber
 *
 * Horizontal timeline slider + prev/next buttons for scrubbing through game moves during replay.
 * Shows current move and total moves; previous/next buttons are disabled at boundaries.
 * Clamps all move values to valid range [1, totalMoves].
 *
 * Pairs with {@link src/components/game/HistoryPanel.tsx} (for detailed move list)
 * and {@link src/components/game/HistoricalViewBanner.tsx} (for context banner).
 *
 * @see {@link src/components/game/HistoricalViewBanner.tsx} for historical view context
 */

import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';

/**
 * Props for the TimelineScrubber component.
 *
 * @interface TimelineScrubberProps
 * @property {number} currentMove - Current selected move (1-indexed). Auto-clamped to [1, totalMoves].
 * @property {number} totalMoves - Total number of moves in game history.
 * @property {(moveNumber: number) => void} onMoveChange - Callback fired on slider or button changes.
 *   Receives clamped move number.
 */
export interface TimelineScrubberProps {
  currentMove: number;
  totalMoves: number;
  onMoveChange: (moveNumber: number) => void;
}

/**
 * Clamps a move number to the valid range [1, totalMoves].
 *
 * @internal
 * @param {number} move - Move number to clamp
 * @param {number} totalMoves - Maximum valid move
 * @returns {number} Clamped move number
 */
function clampMove(move: number, totalMoves: number): number {
  if (move < 1) return 1;
  if (move > totalMoves) return totalMoves;
  return move;
}

export function TimelineScrubber({ currentMove, totalMoves, onMoveChange }: TimelineScrubberProps) {
  const boundedCurrent = clampMove(currentMove, totalMoves);

  return (
    <div
      className="fixed top-14 left-1/2 z-30 w-[min(760px,92vw)] -translate-x-1/2 rounded-md border border-blue-300/30 bg-slate-900/95 px-3 py-2 text-slate-100"
      data-testid="timeline-scrubber"
    >
      <div className="mb-2 flex items-center justify-between text-xs">
        <span>Move #1</span>
        <span>
          Move #{boundedCurrent} / #{totalMoves}
        </span>
        <span>Move #{totalMoves}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onMoveChange(clampMove(boundedCurrent - 1, totalMoves))}
          disabled={boundedCurrent <= 1}
          aria-label="Previous move"
        >
          Prev
        </Button>
        <Slider
          min={1}
          max={Math.max(1, totalMoves)}
          step={1}
          value={[boundedCurrent]}
          onValueChange={(value) => onMoveChange(value[0] ?? 1)}
          className="w-full"
          aria-label="Timeline scrubber"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={() => onMoveChange(clampMove(boundedCurrent + 1, totalMoves))}
          disabled={boundedCurrent >= totalMoves}
          aria-label="Next move"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
