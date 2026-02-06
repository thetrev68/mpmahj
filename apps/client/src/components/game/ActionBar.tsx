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
  /** Whether the player has already submitted their pass */
  hasSubmittedPass?: boolean;
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
  hasSubmittedPass = false,
  onCommand,
  onSort,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);

  // Handle button click with debouncing
  const handleCommand = (command: GameCommand) => {
    if (isProcessing) return;

    setIsProcessing(true);
    onCommand(command);

    // Re-enable after short delay to prevent double-clicks
    setTimeout(() => setIsProcessing(false), 500);
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
              disabled={isProcessing}
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
      return (
        <div className="text-center text-gray-300 text-sm italic">
          Setting up game...
        </div>
      );
    }

    // Charleston Phase
    if (typeof phase === 'object' && 'Charleston' in phase) {
      const canPass = selectedTiles.length === 3 && !isProcessing && !hasSubmittedPass;

      return (
        <>
          <Button
            onClick={() =>
              handleCommand({
                PassTiles: {
                  player: mySeat,
                  tiles: selectedTiles,
                  blind_pass_count: null,
                },
              })
            }
            disabled={!canPass}
            className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
            data-testid="pass-tiles-button"
            aria-label="Pass selected tiles"
          >
            {hasSubmittedPass ? 'Tiles Passed' : 'Pass Tiles'}
          </Button>

          {hasSubmittedPass && (
            <div
              className="text-center text-gray-300 text-sm italic"
              aria-live="polite"
            >
              Waiting for other players...
            </div>
          )}
        </>
      );
    }

    // Playing Phase
    if (typeof phase === 'object' && 'Playing' in phase) {
      return (
        <div className="text-center text-gray-300 text-sm">
          Playing Phase
        </div>
      );
    }

    // Default: no actions
    return (
      <div className="text-center text-gray-400 text-sm">
        No actions available
      </div>
    );
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
