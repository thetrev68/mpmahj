/**
 * @module HistoricalViewBanner
 *
 * Fixed top banner shown when a user is browsing a previous game state via history replay.
 * Indicates read-only mode and offers navigation: return to present or resume from this move.
 * Pairs with {@link src/components/game/TimelineScrubber.tsx} and {@link src/components/game/HistoryPanel.tsx}.
 *
 * @see {@link src/components/game/HistoryPanel.tsx} for history browsing UI
 * @see {@link src/components/game/TimelineScrubber.tsx} for move timeline slider
 */

import { Button } from '@/components/ui/button';

/**
 * Props for the HistoricalViewBanner component.
 *
 * @interface HistoricalViewBannerProps
 * @property {number} moveNumber - Current viewed move (1-indexed).
 * @property {string} moveDescription - Human-readable move summary (e.g., "East discards 1 Bamboo").
 * @property {boolean} isGameOver - Whether the viewed move is after game-over. Changes button label.
 * @property {boolean} canResume - Whether resume from this move is allowed (game still in progress).
 * @property {() => void} onReturnToPresent - Navigate back to live game state.
 * @property {() => void} onResumeFromHere - Resume game from this move state (replay feature).
 */
export interface HistoricalViewBannerProps {
  moveNumber: number;
  moveDescription: string;
  isGameOver: boolean;
  canResume: boolean;
  onReturnToPresent: () => void;
  onResumeFromHere: () => void;
}

export function HistoricalViewBanner({
  moveNumber,
  moveDescription,
  isGameOver,
  canResume,
  onReturnToPresent,
  onResumeFromHere,
}: HistoricalViewBannerProps) {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-30 border-b border-blue-300/40 bg-blue-900/95 px-4 py-3 text-white"
      role="banner"
      aria-label="Historical view mode"
      data-testid="historical-view-banner"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <p className="text-sm font-semibold">
          VIEWING HISTORY - Move #{moveNumber} (Read-Only): {moveDescription}
        </p>
        <div className="flex items-center gap-2">
          {canResume && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onResumeFromHere}
              data-testid="resume-from-here-button"
            >
              Resume from Here
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onReturnToPresent}
            data-testid="return-to-present-button"
          >
            {isGameOver ? 'Return to Final State' : 'Return to Current'}
          </Button>
        </div>
      </div>
    </div>
  );
}
