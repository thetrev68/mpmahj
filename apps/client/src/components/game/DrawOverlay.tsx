/**
 * DrawOverlay Component (US-021)
 *
 * Announces a wall-game draw or game abandonment.
 * Shown before the scoring/game-over screen when no player wins.
 */

import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface DrawOverlayProps {
  /** Whether the overlay is visible */
  show: boolean;
  /** Human-readable draw reason (e.g. "Wall exhausted" or "All players dead hands") */
  reason: string;
  /** Tiles remaining in the wall (0 for wall exhaustion; may differ for abandonment) */
  remainingTiles?: number;
  /** Called when the player acknowledges the overlay */
  onAcknowledge: () => void;
}

/**
 * DrawOverlay
 *
 * Displays a neutral (non-celebratory, non-penalty) announcement that the game
 * ended without a winner, with a brief explanation and a Continue button.
 *
 * @example
 * ```tsx
 * <DrawOverlay
 *   show={showDrawOverlay}
 *   reason="Wall exhausted"
 *   remainingTiles={0}
 *   onAcknowledge={() => setShowDrawOverlay(false)}
 * />
 * ```
 */
export function DrawOverlay({ show, reason, remainingTiles = 0, onAcknowledge }: DrawOverlayProps) {
  if (!show) return null;

  const isAbandoned = reason.toLowerCase().includes('dead');
  const title = isAbandoned ? 'GAME ABANDONED' : 'WALL GAME - No Winner';
  const subtitle = isAbandoned ? 'All Players Dead Hands' : 'No Winner';

  const srText = isAbandoned
    ? `Game abandoned. All players have dead hands. No winner. Scores unchanged.`
    : `Wall exhausted. ${remainingTiles} tiles remaining. Game ends in a draw. No winner.`;

  return (
    <Dialog open>
      <DialogContent
        className="flex max-w-[480px] flex-col items-center gap-6 rounded-2xl border-2 border-blue-400 bg-gray-900 px-10 py-8 shadow-2xl [&>button]:hidden"
        data-testid="draw-overlay"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <p className="sr-only">{srText}</p>
        {/* Title */}
        <h2
          className="text-3xl font-bold text-blue-300 text-center tracking-wide"
          data-testid="draw-overlay-title"
        >
          {title}
        </h2>

        {/* Subtitle */}
        <p className="text-xl text-gray-200 font-semibold">{subtitle}</p>

        {/* Reason box */}
        <div className="w-full bg-gray-800 rounded-lg px-6 py-4 text-center space-y-2">
          <p className="text-gray-400 text-sm uppercase tracking-wider">Reason</p>
          <p className="text-gray-100 font-medium">{reason}</p>
          {!isAbandoned && (
            <p className="text-gray-400 text-sm">Remaining Tiles: {remainingTiles}</p>
          )}
        </div>

        {/* Message */}
        <div className="text-center space-y-1">
          <p className="text-gray-300 text-sm">
            Wall exhausted with no winner. Game ends in a draw.
          </p>
          <p className="text-gray-300 text-sm">Scores remain unchanged.</p>
        </div>

        {/* Continue button */}
        <Button
          className="mt-2 h-auto bg-blue-700 px-10 py-3 text-lg font-bold text-white hover:bg-blue-600"
          onClick={onAcknowledge}
          data-testid="draw-overlay-continue"
          aria-label="Continue to final scores"
        >
          Continue
        </Button>
      </DialogContent>
    </Dialog>
  );
}
