/**
 * SetupPhase Component
 *
 * Manages the Setup phase UI, including dice rolling and wall breaking.
 * Handles setup-specific rendering and interactions.
 *
 * Phase 4 of GAMEBOARD_REFACTORING_PLAN.md
 *
 * Related: US-001 (Roll Dice & Break Wall)
 */

import React, { useState, useCallback, useEffect } from 'react';
import { DiceOverlay } from '../DiceOverlay';
import { ActionBar } from '../ActionBar';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { SetupStage } from '@/types/bindings/generated/SetupStage';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

/**
 * SetupPhase component props
 */
export interface SetupPhaseProps {
  /** Current game state from server */
  gameState: GameStateSnapshot;
  /** Current setup stage */
  stage: SetupStage;
  /** Function to send game commands */
  sendCommand: (command: GameCommand) => void;
  /** Dice roll value (from DiceRolled event) */
  diceRoll?: number | null;
  /** Whether to show dice overlay */
  showDiceOverlay?: boolean;
  /** Callback when dice overlay closes */
  onDiceOverlayClose?: () => void;
  /** Callback when Leave Game is confirmed */
  onLeaveConfirmed?: () => void;
}

/**
 * SetupPhase Component
 *
 * Renders setup-specific UI including:
 * - Dice overlay (when dice is rolled)
 * - Action bar (for roll dice button)
 * - Setup stage indicator
 *
 * @param props - Component props
 */
export const SetupPhase: React.FC<SetupPhaseProps> = ({
  gameState,
  stage,
  sendCommand,
  diceRoll = null,
  showDiceOverlay = false,
  onDiceOverlayClose,
  onLeaveConfirmed,
}) => {
  // Local state for dice overlay visibility
  const [isDiceOverlayOpen, setIsDiceOverlayOpen] = useState(false);

  // Sync dice overlay state with prop
  useEffect(() => {
    setIsDiceOverlayOpen(showDiceOverlay);
  }, [showDiceOverlay]);

  /**
   * Handle dice overlay close
   */
  const handleDiceOverlayClose = useCallback(() => {
    setIsDiceOverlayOpen(false);
    onDiceOverlayClose?.();
  }, [onDiceOverlayClose]);

  return (
    <>
      {/* Dice Overlay */}
      {diceRoll !== null && (
        <DiceOverlay
          isOpen={isDiceOverlayOpen}
          rollTotal={diceRoll}
          onComplete={handleDiceOverlayClose}
        />
      )}

      {/* Action Bar (shows Roll Dice button during RollingDice stage) */}
      <ActionBar
        phase={{ Setup: stage }}
        mySeat={gameState.your_seat}
        selectedTiles={[]}
        isProcessing={false}
        onCommand={sendCommand}
        onLeaveConfirmed={onLeaveConfirmed}
      />

      {/* Setup Stage Indicator (for debugging/testing) */}
      {import.meta.env.DEV && (
        <div
          data-testid="setup-phase-indicator"
          data-stage={stage}
          className="hidden"
          aria-hidden="true"
        />
      )}
    </>
  );
};

SetupPhase.displayName = 'SetupPhase';
