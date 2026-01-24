import type { Event } from '@/types/bindings/generated/Event';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { PrivateEvent } from '@/types/bindings/generated/PrivateEvent';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';
import { tileToCode } from './tileFormatter';

export type EventCategory = 'game' | 'turn' | 'charleston' | 'call' | 'mahjong' | 'error' | 'info';

export interface FormattedEvent {
  message: string;
  category: EventCategory;
}

/**
 * Format Event to human-readable string with category.
 */
export function formatEvent(event: Event): FormattedEvent {
  if ('Public' in event) return formatPublicEvent(event.Public);
  if ('Private' in event) return formatPrivateEvent(event.Private);
  if ('Analysis' in event) return { message: 'Analysis event (hidden)', category: 'info' };

  return { message: 'Unknown event', category: 'info' };
}

function formatPublicEvent(event: PublicEvent): FormattedEvent {
  // Handle string literal events first
  if (typeof event === 'string') {
    switch (event) {
      case 'GameStarting':
        return { message: 'Game starting', category: 'game' };
      case 'CharlestonComplete':
        return { message: 'Charleston complete', category: 'charleston' };
      case 'CourtesyPassComplete':
        return { message: 'Courtesy pass complete', category: 'charleston' };
      case 'CallWindowClosed':
        return { message: 'Call window closed', category: 'call' };
      default:
        return { message: event, category: 'info' };
    }
  }

  // Handle object events
  // Game flow
  if ('GameCreated' in event) {
    return { message: 'Game created', category: 'game' };
  }
  if ('PlayerJoined' in event) {
    const { player, is_bot } = event.PlayerJoined;
    const botTag = is_bot ? ' (Bot)' : '';
    return { message: `${player} joined${botTag}`, category: 'game' };
  }
  if ('PhaseChanged' in event) {
    return { message: `Phase: ${formatPhaseShort(event.PhaseChanged.phase)}`, category: 'game' };
  }

  // Setup
  if ('DiceRolled' in event) {
    return { message: `Dice rolled: ${event.DiceRolled.roll}`, category: 'game' };
  }
  if ('WallBroken' in event) {
    return { message: 'Wall broken', category: 'game' };
  }

  // Charleston
  if ('CharlestonPhaseChanged' in event) {
    const stage = formatCharlestonStageShort(event.CharlestonPhaseChanged.stage);
    return { message: `Charleston: ${stage}`, category: 'charleston' };
  }
  if ('PlayerReadyForPass' in event) {
    return { message: `${event.PlayerReadyForPass.player} ready to pass`, category: 'charleston' };
  }
  if ('TilesPassing' in event) {
    return { message: `Tiles passing ${event.TilesPassing.direction}`, category: 'charleston' };
  }
  if ('PlayerVoted' in event) {
    return { message: `${event.PlayerVoted.player} voted`, category: 'charleston' };
  }
  if ('VoteResult' in event) {
    return { message: `Vote result: ${event.VoteResult.result}`, category: 'charleston' };
  }

  // Turn
  if ('TurnChanged' in event) {
    const { player, stage } = event.TurnChanged;
    const stageStr = formatTurnStageShort(stage);
    return { message: `${player}'s turn (${stageStr})`, category: 'turn' };
  }
  if ('TileDrawnPublic' in event) {
    return { message: 'Tile drawn', category: 'turn' };
  }
  if ('TileDiscarded' in event) {
    const { player, tile } = event.TileDiscarded;
    return { message: `${player} discarded ${tileToCode(tile)}`, category: 'turn' };
  }

  // Call window
  if ('CallWindowOpened' in event) {
    const { tile, discarded_by } = event.CallWindowOpened;
    return { message: `Call window: ${tileToCode(tile)} (${discarded_by})`, category: 'call' };
  }
  if ('CallResolved' in event) {
    const { resolution } = event.CallResolved;
    return { message: `Call resolved: ${JSON.stringify(resolution)}`, category: 'call' };
  }
  if ('TileCalled' in event) {
    const { player, meld, called_tile } = event.TileCalled;
    return {
      message: `${player} called ${meld.meld_type} on ${tileToCode(called_tile)}`,
      category: 'call',
    };
  }
  if ('JokerExchanged' in event) {
    const { player, target_seat, replacement } = event.JokerExchanged;
    return {
      message: `${player} exchanged joker (${target_seat}'s meld) → ${tileToCode(replacement)}`,
      category: 'call',
    };
  }

  // Mahjong
  if ('MahjongDeclared' in event) {
    return { message: `${event.MahjongDeclared.player} declared Mahjong!`, category: 'mahjong' };
  }
  if ('HandValidated' in event) {
    const { player, valid, pattern } = event.HandValidated;
    if (valid) {
      return {
        message: `${player}'s hand valid${pattern ? `: ${pattern}` : ''}`,
        category: 'mahjong',
      };
    }
    return { message: `${player}'s hand invalid`, category: 'error' };
  }
  if ('GameOver' in event) {
    const { winner } = event.GameOver;
    return {
      message: winner ? `Game Over: ${winner} wins!` : 'Game Over (draw)',
      category: 'mahjong',
    };
  }

  // Errors
  if ('CommandRejected' in event) {
    const { player, reason } = event.CommandRejected;
    return { message: `${player}: ${reason}`, category: 'error' };
  }
  if ('HandDeclaredDead' in event) {
    const { player, reason } = event.HandDeclaredDead;
    return { message: `${player}'s hand dead: ${reason}`, category: 'error' };
  }

  // Other
  if ('WallExhausted' in event) {
    return { message: 'Wall exhausted', category: 'game' };
  }

  return { message: JSON.stringify(event).slice(0, 60), category: 'info' };
}

function formatPrivateEvent(event: PrivateEvent): FormattedEvent {
  if ('TilesDealt' in event) {
    return { message: `Received ${event.TilesDealt.your_tiles.length} tiles`, category: 'game' };
  }
  if ('TilesPassed' in event) {
    return { message: `Passed ${event.TilesPassed.tiles.length} tiles`, category: 'charleston' };
  }
  if ('TilesReceived' in event) {
    const { tiles, from } = event.TilesReceived;
    const fromStr = from ? ` from ${from}` : '';
    return { message: `Received ${tiles.length} tiles${fromStr}`, category: 'charleston' };
  }
  if ('TileDrawnPrivate' in event) {
    return { message: `Drew ${tileToCode(event.TileDrawnPrivate.tile)}`, category: 'turn' };
  }
  if ('ReplacementDrawn' in event) {
    const { tile, reason } = event.ReplacementDrawn;
    return { message: `Replacement: ${tileToCode(tile)} (${reason})`, category: 'turn' };
  }

  return { message: 'Private event', category: 'info' };
}

// Helper formatters
function formatPhaseShort(phase: GamePhase): string {
  if (typeof phase === 'string') return phase;
  if (typeof phase === 'object' && phase !== null) {
    if ('Setup' in phase) return 'Setup';
    if ('Charleston' in phase) return 'Charleston';
    if ('Playing' in phase) return 'Playing';
    if ('Scoring' in phase) return 'Scoring';
    if ('GameOver' in phase) return 'Game Over';
  }
  return 'Unknown';
}

function formatCharlestonStageShort(stage: string): string {
  const map: Record<string, string> = {
    FirstRight: 'Pass Right (1st)',
    FirstAcross: 'Pass Across (1st)',
    FirstLeft: 'Pass Left (1st)',
    VotingToContinue: 'Voting',
    SecondLeft: 'Pass Left (2nd)',
    SecondAcross: 'Pass Across (2nd)',
    SecondRight: 'Pass Right (2nd)',
    CourtesyAcross: 'Courtesy Pass',
    Complete: 'Complete',
  };
  return map[stage] || stage;
}

function formatTurnStageShort(stage: TurnStage): string {
  if (typeof stage === 'object' && stage !== null) {
    if ('Drawing' in stage) return 'Drawing';
    if ('Discarding' in stage) return 'Discarding';
    if ('CallWindow' in stage) return 'Call Window';
    if ('AwaitingMahjong' in stage) return 'Awaiting Mahjong';
  }
  return 'Unknown';
}
