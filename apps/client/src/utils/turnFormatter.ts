import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';

/**
 * Format turn information with "YOUR TURN" highlight.
 *
 * Ported from mahjong_terminal/src/ui.rs:format_turn()
 */
export function formatTurn(phase: GamePhase, yourSeat: Seat | null): string {
  // Playing phase
  if (typeof phase === 'object' && 'Playing' in phase) {
    const stage = phase.Playing;
    const activePlayer = getActivePlayer(stage);

    // Direct player action (Drawing or Discarding)
    if (activePlayer && yourSeat && activePlayer === yourSeat) {
      return `${activePlayer} (YOUR TURN)`;
    }
    if (activePlayer) {
      return activePlayer;
    }

    // Call window
    if ('CallWindow' in stage && yourSeat) {
      if (stage.CallWindow.can_act.includes(yourSeat)) {
        return 'Call window (YOU CAN ACT)';
      }
      return 'Call window (waiting)';
    }

    return 'Call window';
  }

  // Charleston phase
  if (typeof phase === 'object' && 'Charleston' in phase && yourSeat) {
    return 'Select tiles to pass';
  }

  return '-';
}

/**
 * Get the active player from TurnStage.
 */
function getActivePlayer(stage: TurnStage): Seat | null {
  if ('Drawing' in stage) {
    return stage.Drawing.player;
  }
  if ('Discarding' in stage) {
    return stage.Discarding.player;
  }
  return null;
}

/**
 * Check if it's your turn for styling purposes.
 */
export function isYourTurn(phase: GamePhase, yourSeat: Seat | null): boolean {
  if (!yourSeat || typeof phase !== 'object' || !('Playing' in phase)) {
    return false;
  }

  const stage = phase.Playing;
  const activePlayer = getActivePlayer(stage);
  return activePlayer === yourSeat;
}

/**
 * Check if you can act in a call window.
 */
export function canActInCallWindow(phase: GamePhase, yourSeat: Seat | null): boolean {
  if (!yourSeat || typeof phase !== 'object' || !('Playing' in phase)) {
    return false;
  }

  const stage = phase.Playing;
  if ('CallWindow' in stage) {
    return stage.CallWindow.can_act.includes(yourSeat);
  }

  return false;
}
