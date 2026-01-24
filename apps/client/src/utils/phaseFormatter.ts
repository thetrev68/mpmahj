import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { SetupStage } from '@/types/bindings/generated/SetupStage';

/**
 * Format GamePhase for human-readable display.
 *
 * Ported from mahjong_terminal/src/ui.rs:format_phase()
 */
export function formatPhase(phase: GamePhase): string {
  // String literal phases
  if (phase === 'WaitingForPlayers') {
    return 'Waiting for players';
  }

  // Object phases
  if (typeof phase === 'object') {
    if ('Setup' in phase) {
      return formatSetupStage(phase.Setup);
    }
    if ('Charleston' in phase) {
      return formatCharlestonStage(phase.Charleston);
    }
    if ('Playing' in phase) {
      return formatTurnStage(phase.Playing);
    }
    if ('Scoring' in phase) {
      return 'Scoring';
    }
    if ('GameOver' in phase) {
      return 'Game Over';
    }
  }

  return 'Unknown';
}

/**
 * Format Setup stage.
 */
function formatSetupStage(stage: SetupStage): string {
  return `Setup: ${stage}`;
}

/**
 * Format Charleston stage.
 *
 * Ported from mahjong_terminal/src/ui.rs:format_charleston_stage()
 */
function formatCharlestonStage(stage: CharlestonStage): string {
  switch (stage) {
    case 'FirstRight':
      return 'Charleston: Pass Right (1st)';
    case 'FirstAcross':
      return 'Charleston: Pass Across (1st)';
    case 'FirstLeft':
      return 'Charleston: Pass Left (1st)';
    case 'VotingToContinue':
      return 'Charleston: Voting';
    case 'SecondLeft':
      return 'Charleston: Pass Left (2nd)';
    case 'SecondAcross':
      return 'Charleston: Pass Across (2nd)';
    case 'SecondRight':
      return 'Charleston: Pass Right (2nd)';
    case 'CourtesyAcross':
      return 'Charleston: Courtesy Pass';
    case 'Complete':
      return 'Charleston: Complete';
    default:
      return `Charleston: ${stage}`;
  }
}

/**
 * Format Turn stage during main gameplay.
 *
 * Ported from mahjong_terminal/src/ui.rs:format_turn_stage()
 */
function formatTurnStage(stage: TurnStage): string {
  if ('Drawing' in stage) {
    return `${stage.Drawing.player} drawing`;
  }
  if ('Discarding' in stage) {
    return `${stage.Discarding.player} discarding`;
  }
  if ('CallWindow' in stage) {
    return `Call window (${stage.CallWindow.discarded_by}'s discard)`;
  }
  if ('AwaitingMahjong' in stage) {
    return `${stage.AwaitingMahjong.caller} awaiting mahjong`;
  }
  return 'Unknown turn stage';
}
