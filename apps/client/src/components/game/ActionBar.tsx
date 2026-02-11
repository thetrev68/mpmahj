/**
 * ActionBar Component
 *
 * Bottom action panel that displays context-aware buttons for game actions.
 * Changes based on server-driven phase and turn state.
 *
 * Related: US-001 (Roll Dice), US-002 (Charleston), US-009 (Discard), US-011 (Call Window)
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import { cn } from '@/lib/utils';

export interface ActionBarProps {
  /** Current game phase from server */
  phase: GamePhase;
  /** Player's seat */
  mySeat: Seat;
  /** Currently selected tiles (tile values) */
  selectedTiles?: Tile[];
  /** External processing state (e.g., discard in-flight) */
  isProcessing?: boolean;
  /** Number of tiles to pass blindly (0-3, only for blind pass stages) */
  blindPassCount?: number;
  /** Whether the player has already submitted their pass */
  hasSubmittedPass?: boolean;
  /** Whether a Mahjong declaration is available this turn */
  canDeclareMahjong?: boolean;
  /** Called when the player clicks "Declare Mahjong" */
  onDeclareMahjong?: () => void;
  /** Whether a Joker exchange is available this turn (US-014/015) */
  canExchangeJoker?: boolean;
  /** Called when the player clicks "Exchange Joker" */
  onExchangeJoker?: () => void;
  /** Callback when command is issued */
  onCommand: (command: GameCommand) => void;
  /** Optional sort handler (UI-only) */
  onSort?: () => void;
}

/**
 * ActionBar displays context-aware action buttons based on game phase
 */
export const ActionBar: React.FC<ActionBarProps> = ({
  phase,
  mySeat,
  selectedTiles = [],
  isProcessing = false,
  blindPassCount,
  hasSubmittedPass = false,
  canDeclareMahjong = false,
  onDeclareMahjong,
  canExchangeJoker = false,
  onExchangeJoker,
  onCommand,
  onSort,
}) => {
  const [localProcessing, setLocalProcessing] = useState(false);
  const isBusy = localProcessing || isProcessing;

  // Handle button click with debouncing
  const handleCommand = (command: GameCommand) => {
    if (isBusy) return;

    setLocalProcessing(true);
    onCommand(command);

    // Re-enable after short delay to prevent double-clicks
    setTimeout(() => setLocalProcessing(false), 500);
  };

  // Determine which buttons to show based on phase
  const renderActions = () => {
    // Setup Phase - RollingDice
    if (typeof phase === 'object' && 'Setup' in phase) {
      const setupStage = phase.Setup;

      if (setupStage === 'RollingDice') {
        // Only East can roll dice
        if (mySeat === 'East') {
          return (
            <Button
              onClick={() => handleCommand({ RollDice: { player: mySeat } })}
              disabled={isBusy}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
              data-testid="roll-dice-button"
              aria-label="Roll dice to start game"
            >
              Roll Dice
            </Button>
          );
        } else {
          return (
            <div
              className="text-center text-gray-300 text-sm italic"
              data-testid="waiting-message"
              aria-live="polite"
            >
              Waiting for East to roll dice...
            </div>
          );
        }
      }

      // Other setup stages - show waiting message
      return <div className="text-center text-gray-300 text-sm italic">Setting up game...</div>;
    }

    // Charleston Phase
    if (typeof phase === 'object' && 'Charleston' in phase) {
      const blind = blindPassCount ?? 0;
      const totalSelected = selectedTiles.length + blind;
      const canPass = totalSelected === 3 && !isBusy && !hasSubmittedPass;
      const blindPassValue = blindPassCount != null && blindPassCount > 0 ? blindPassCount : null;

      return (
        <>
          <Button
            onClick={() =>
              handleCommand({
                PassTiles: {
                  player: mySeat,
                  tiles: selectedTiles,
                  blind_pass_count: blindPassValue,
                },
              })
            }
            disabled={!canPass}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
            data-testid="pass-tiles-button"
            aria-label="Pass selected tiles"
          >
            {isBusy || hasSubmittedPass ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                {hasSubmittedPass ? 'Tiles Passed' : 'Passing...'}
              </span>
            ) : (
              'Pass Tiles'
            )}
          </Button>

          {hasSubmittedPass && (
            <div className="text-center text-gray-300 text-sm italic" aria-live="polite">
              Waiting for other players...
            </div>
          )}
        </>
      );
    }

    // Playing Phase
    if (typeof phase === 'object' && 'Playing' in phase) {
      const stage = phase.Playing;

      if (typeof stage === 'object') {
        if ('Drawing' in stage) {
          const isMe = stage.Drawing.player === mySeat;
          return (
            <div className="text-center text-gray-300 text-sm" data-testid="playing-status">
              {isMe ? 'Your turn - Drawing tile...' : `${stage.Drawing.player}'s turn - Drawing`}
            </div>
          );
        }

        if ('Discarding' in stage) {
          const isMe = stage.Discarding.player === mySeat;

          if (isMe) {
            // Show Discard button when it's my turn
            const canDiscard = selectedTiles.length === 1 && !isBusy;

            return (
              <>
                <div className="text-center text-gray-300 text-sm" data-testid="playing-status">
                  Your turn - Select a tile to discard
                </div>
                <Button
                  onClick={() =>
                    handleCommand({
                      DiscardTile: {
                        player: mySeat,
                        tile: selectedTiles[0],
                      },
                    })
                  }
                  disabled={!canDiscard}
                  className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
                  data-testid="discard-button"
                  aria-label="Discard selected tile"
                >
                  {isBusy ? (
                    <span className="inline-flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Discarding...
                    </span>
                  ) : (
                    'Discard'
                  )}
                </Button>
                {canDeclareMahjong && (
                  <Button
                    onClick={onDeclareMahjong}
                    disabled={isBusy}
                    className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-black font-bold motion-safe:animate-pulse"
                    data-testid="declare-mahjong-button"
                    aria-label="Declare Mahjong"
                  >
                    Declare Mahjong
                  </Button>
                )}
                {canExchangeJoker && (
                  <Button
                    onClick={onExchangeJoker}
                    disabled={isBusy}
                    className="w-full bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
                    data-testid="exchange-joker-button"
                    aria-label="Exchange Joker"
                  >
                    Exchange Joker
                  </Button>
                )}
              </>
            );
          }

          return (
            <div className="text-center text-gray-300 text-sm" data-testid="playing-status">
              {stage.Discarding.player}'s turn - Discarding
            </div>
          );
        }
      }

      return <div className="text-center text-gray-300 text-sm">Playing Phase</div>;
    }

    // Default: no actions
    return <div className="text-center text-gray-400 text-sm">No actions available</div>;
  };

  return (
    <div
      className={cn(
        'fixed right-[16%] top-1/2 -translate-y-1/2',
        'bg-black/85 rounded-lg shadow-lg',
        'px-4 py-3',
        'min-w-[180px]'
      )}
      data-testid="action-bar"
      role="toolbar"
      aria-label="Game actions"
    >
      <div className="flex flex-col gap-2.5">
        {renderActions()}

        {/* Sort button (if provided) */}
        {onSort && (
          <Button
            onClick={onSort}
            variant="outline"
            size="sm"
            className="w-full"
            data-testid="sort-button"
            aria-label="Sort hand"
          >
            Sort Hand
          </Button>
        )}
      </div>
    </div>
  );
};

ActionBar.displayName = 'ActionBar';
