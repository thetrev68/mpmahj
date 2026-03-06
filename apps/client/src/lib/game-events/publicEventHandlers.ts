import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { CallIntentSummary } from '@/types/bindings/generated/CallIntentSummary';
import type { EventHandlerResult } from './types';
import { EMPTY_RESULT } from './types';

import {
  handleDiceRolled,
  handlePhaseChanged,
  handleStateRestored,
  handleWallBroken,
} from './publicEventHandlers.setup';
import {
  handleBlindPassPerformed,
  handleCharlestonPhaseChanged,
  handleCharlestonTimerStarted,
  handleCourtesyPassComplete,
  handleIOUDetected,
  handleIOUResolved,
  handlePlayerReadyForPass,
  handlePlayerStagedTile,
  handlePlayerVoted,
  handleTilesPassing,
  handleVoteResult,
} from './publicEventHandlers.charleston';
import {
  handleCallResolved,
  handleCallWindowClosed,
  handleCallWindowOpened,
  handleCallWindowProgress,
  handleJokerExchanged,
  handleMeldUpgraded,
  handleTileCalled,
  handleTileDiscarded,
  handleTileDrawnPublic,
  handleTurnChanged,
} from './publicEventHandlers.playing';
import {
  handleAwaitingMahjongValidation,
  handleGameAbandoned,
  handleGameOver,
  handleHandDeclaredDead,
  handleHandValidated,
  handleHeavenlyHand,
  handleMahjongDeclared,
  handlePlayerForfeited,
  handlePlayerSkipped,
  handleWallExhausted,
} from './publicEventHandlers.endgame';

export {
  handleDiceRolled,
  handleWallBroken,
  handlePhaseChanged,
  handleStateRestored,
  handleCharlestonPhaseChanged,
  handleCharlestonTimerStarted,
  handlePlayerReadyForPass,
  handlePlayerStagedTile,
  handleTilesPassing,
  handleBlindPassPerformed,
  handlePlayerVoted,
  handleVoteResult,
  handleCourtesyPassComplete,
  handleTurnChanged,
  handleTileDrawnPublic,
  handleTileDiscarded,
  handleCallWindowOpened,
  handleCallWindowProgress,
  handleCallResolved,
  handleCallWindowClosed,
  handleTileCalled,
  handleJokerExchanged,
  handleMeldUpgraded,
  handleWallExhausted,
};

/**
 * Context passed to public event handlers.
 * @property gameState - Current server game state (read-only)
 * @property yourSeat - Current player's seat
 * @property callIntents - Active call intents in current call window
 * @property discardedBy - Player who discarded the most recent tile
 */
export interface PublicEventDispatchContext {
  /** Current server snapshot — read-only input; handlers must not mutate it. */
  gameState: GameStateSnapshot | null;
  yourSeat: Seat | null;
  callIntents: CallIntentSummary[];
  discardedBy: Seat | null;
}

/**
 * Main public event dispatcher.
 * Routes PublicEvent variants to appropriate handler functions and returns
 * declarative state updates, UI actions, and side effects.
 * @param event - Public event from server
 * @param context - Dispatch context with game state and player information
 * @returns Result containing state updates, UI actions, and side effects
 */
export function handlePublicEvent(
  event: PublicEvent,
  context: PublicEventDispatchContext
): EventHandlerResult {
  if (event === 'CallWindowClosed') return handleCallWindowClosed();
  if (event === 'CourtesyPassComplete') return handleCourtesyPassComplete();

  if (typeof event !== 'object' || event === null) {
    return EMPTY_RESULT;
  }

  if ('DiceRolled' in event) return handleDiceRolled(event);
  if ('WallBroken' in event) return handleWallBroken(event);
  if ('PhaseChanged' in event) return handlePhaseChanged(event);
  if ('CharlestonPhaseChanged' in event) return handleCharlestonPhaseChanged(event);
  if ('CharlestonTimerStarted' in event) return handleCharlestonTimerStarted(event);
  if ('PlayerReadyForPass' in event) return handlePlayerReadyForPass(event, context.gameState);
  if ('PlayerStagedTile' in event) return handlePlayerStagedTile(event);
  if ('TilesPassing' in event) return handleTilesPassing(event);
  if ('BlindPassPerformed' in event) return handleBlindPassPerformed(event, context.gameState);
  if ('PlayerVoted' in event)
    return handlePlayerVoted(event, context.gameState, context.yourSeat ?? null);
  if ('VoteResult' in event) return handleVoteResult(event);
  if ('StateRestored' in event) return handleStateRestored(event);
  if ('TurnChanged' in event) return handleTurnChanged(event);
  if ('TileDrawnPublic' in event) return handleTileDrawnPublic(event);
  if ('TileDiscarded' in event) return handleTileDiscarded(event);
  if ('CallWindowOpened' in event) {
    const yourSeat = context.yourSeat ?? 'East';
    return handleCallWindowOpened(event, { yourSeat });
  }
  if ('CallWindowProgress' in event) return handleCallWindowProgress(event);
  if ('CallResolved' in event) {
    const discardedBy = context.discardedBy ?? 'East';
    return handleCallResolved(event, {
      callIntents: context.callIntents,
      discardedBy,
    });
  }
  if ('IOUDetected' in event) return handleIOUDetected(event);
  if ('IOUResolved' in event) return handleIOUResolved(event);
  if ('TileCalled' in event) {
    if (context.yourSeat) {
      return handleTileCalled(event, { yourSeat: context.yourSeat });
    }
    return EMPTY_RESULT;
  }
  if ('WallExhausted' in event) return handleWallExhausted(event);
  if ('GameAbandoned' in event) return handleGameAbandoned(event);
  if ('JokerExchanged' in event) {
    return handleJokerExchanged(event, { yourSeat: context.yourSeat ?? 'East' });
  }
  if ('MeldUpgraded' in event) {
    return handleMeldUpgraded(event, { yourSeat: context.yourSeat ?? 'East' });
  }
  if ('AwaitingMahjongValidation' in event) {
    return handleAwaitingMahjongValidation(event, { yourSeat: context.yourSeat ?? 'East' });
  }
  if ('MahjongDeclared' in event) return handleMahjongDeclared(event);
  if ('HandValidated' in event) return handleHandValidated(event);
  if ('HandDeclaredDead' in event) return handleHandDeclaredDead(event);
  if ('PlayerSkipped' in event) return handlePlayerSkipped(event);
  if ('PlayerForfeited' in event) return handlePlayerForfeited(event);
  if ('GameOver' in event) return handleGameOver(event);
  if ('HeavenlyHand' in event) return handleHeavenlyHand(event);

  return EMPTY_RESULT;
}
