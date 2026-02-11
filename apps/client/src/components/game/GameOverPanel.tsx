/**
 * GameOverPanel Component
 *
 * Post-game options panel shown after GameOver event.
 * Lets players start a new game or return to lobby.
 *
 * Related: US-018 (AC-7)
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import type { GameResult } from '@/types/bindings/generated/GameResult';

export interface GameOverPanelProps {
  isOpen: boolean;
  result: GameResult;
  onNewGame: () => void;
  onReturnToLobby: () => void;
}

export const GameOverPanel: React.FC<GameOverPanelProps> = ({
  isOpen,
  result,
  onNewGame,
  onReturnToLobby,
}) => {
  if (!isOpen) return null;

  const { winner, winning_pattern } = result;
  const isDraw = winner === null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75"
      data-testid="game-over-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Game Over"
    >
      <div className="bg-gray-900 border border-gray-600 rounded-2xl shadow-2xl px-8 py-7 flex flex-col items-center gap-5 min-w-[300px] max-w-[440px]">
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
        </div>
      </div>
    </div>
  );
};

GameOverPanel.displayName = 'GameOverPanel';
