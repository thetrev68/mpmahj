/**
 * @module GameOverPanel
 *
 * Post-game summary panel displayed after game ends. Shows winner/draw status and
 * options to start a new game or return to lobby. Includes optional "View Replay" button
 * (shown but disabled until replay infrastructure is implemented).
 *
 * Follows after `src/components/game/DrawScoringScreen.tsx` or
 * `src/components/game/ScoringScreen.tsx` depending on win/draw.
 *
 * @see `src/components/game/ScoringScreen.tsx` for mahjong scoring display
 * @see `src/components/game/DrawScoringScreen.tsx` for draw/forfeit scoring
 */

import type { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { GameResult } from '@/types/bindings/generated/GameResult';

/**
 * Props for the GameOverPanel component.
 *
 * @interface GameOverPanelProps
 * @property {boolean} isOpen - Whether the panel is visible.
 * @property {GameResult} result - Game result with winner and winning_pattern.
 *   @see `src/types/bindings/generated/GameResult.ts`
 * @property {() => void} onNewGame - Start a new game (typically returns to room setup).
 * @property {() => void} onReturnToLobby - Return to lobby/room list.
 * @property {() => void} [onViewReplay] - Optional replay viewer handler. Button shown but disabled if handler absent.
 */
interface GameOverPanelProps {
  isOpen: boolean;
  result: GameResult;
  onNewGame: () => void;
  onReturnToLobby: () => void;
  /** Optional: View replay handler. Button is shown but disabled until infrastructure exists. */
  onViewReplay?: () => void;
}

export const GameOverPanel: FC<GameOverPanelProps> = ({
  isOpen,
  result,
  onNewGame,
  onReturnToLobby,
  onViewReplay,
}) => {
  if (!isOpen) return null;

  const { winner, winning_pattern } = result;
  const isDraw = winner === null;

  return (
    <Dialog open>
      <DialogContent
        className="flex max-w-[440px] flex-col items-center gap-5 rounded-2xl border border-gray-600 bg-gray-900 px-8 py-7 shadow-2xl [&>button]:hidden"
        data-testid="game-over-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Game Over"
      >
        <h2 className="text-3xl font-bold text-white">Game Over</h2>

        {isDraw ? (
          <p className="text-gray-300 text-center">
            <span className="text-xl font-semibold text-yellow-300">Draw</span>
            <br />
            <span className="text-sm text-gray-400">The wall was exhausted with no winner.</span>
          </p>
        ) : (
          <p className="text-gray-300 text-center">
            <span className="text-xl font-semibold text-green-300">{winner}</span> wins
            {winning_pattern && (
              <>
                <br />
                <span className="text-sm text-gray-400">with {winning_pattern}</span>
              </>
            )}
          </p>
        )}

        <div className="flex flex-col gap-3 w-full mt-2">
          <Button
            onClick={onNewGame}
            className="w-full bg-green-600 hover:bg-green-500 text-white font-bold"
            aria-label="New Game"
          >
            New Game
          </Button>
          <Button
            onClick={onReturnToLobby}
            variant="outline"
            className="w-full"
            aria-label="Return to Lobby"
          >
            Return to Lobby
          </Button>
          <Button
            onClick={onViewReplay}
            variant="outline"
            className="w-full"
            aria-label="View Replay"
            disabled={!onViewReplay}
            data-testid="view-replay-button"
          >
            View Replay
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

GameOverPanel.displayName = 'GameOverPanel';
