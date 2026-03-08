/**
 * Fixture Index
 *
 * Central import point for all test fixtures.
 * Import fixtures from this file for type safety and convenience.
 */

import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import { isSeat } from '@/hooks/gameSocketTypes';

// Game State Fixtures
import setupRollingDiceRaw from './game-states/setup-rolling-dice.json';
import setupWallBrokenRaw from './game-states/setup-wall-broken.json';
import charlestonFirstRightRaw from './game-states/charleston-first-right.json';
import charlestonFirstAcrossRaw from './game-states/charleston-first-across.json';
import charlestonFirstLeftRaw from './game-states/charleston-first-left.json';
import charlestonVotingRaw from './game-states/charleston-voting.json';
import charlestonSecondLeftRaw from './game-states/charleston-second-left.json';
import charlestonSecondAcrossRaw from './game-states/charleston-second-across.json';
import charlestonSecondRightRaw from './game-states/charleston-second-right.json';
import charlestonCourtesyAcrossRaw from './game-states/charleston-courtesy-across.json';
import playingDrawingRaw from './game-states/playing-drawing.json';
import playingDiscardingRaw from './game-states/playing-discarding.json';
import playingCallWindowRaw from './game-states/playing-call-window.json';
import midGameCharlestonRaw from './game-states/mid-game-charleston.json';

// Hand Fixtures
import charlestonStandardHand from './hands/charleston-standard-hand.json';
import winningHandConsecutive from './hands/winning-hand-consecutive.json';
import nearWinOneAway from './hands/near-win-one-away.json';
import withJokers from './hands/with-jokers.json';

// Event Sequence Fixtures
import diceRollSequence from './events/dice-roll-sequence.json';
import charlestonPassSequence from './events/charleston-pass-sequence.json';
import charlestonAcrossPassSequence from './events/charleston-across-pass-sequence.json';
import callWindowSequence from './events/call-window-sequence.json';
import turnFlowSequence from './events/turn-flow-sequence.json';
import joinRoomSequence from './events/join-room-sequence.json';
import reconnectFlowSequence from './events/reconnect-flow.json';

// ─── Builder types ─────────────────────────────────────────────────────────────

/**
 * JSON-serialisable version of GameStateSnapshot.
 *
 * JSON cannot represent bigint, so wall_seed is stored as a number in fixture
 * files. This type makes the mismatch explicit at the fixture boundary rather
 * than hiding it behind an unsafe `as unknown as GameStateSnapshot` cast.
 */
export type RawGameStateSnapshot = Omit<GameStateSnapshot, 'wall_seed'> & {
  readonly wall_seed: number;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isTileArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every(isNumber);
}

function isDiscardInfo(value: unknown): boolean {
  return isObject(value) && isNumber(value.tile) && isSeat(value.discarded_by);
}

function isPublicPlayerInfo(value: unknown): boolean {
  return (
    isObject(value) &&
    isSeat(value.seat) &&
    isString(value.player_id) &&
    isBoolean(value.is_bot) &&
    isString(value.status) &&
    isNumber(value.tile_count) &&
    Array.isArray(value.exposed_melds)
  );
}

function isRuleset(value: unknown): boolean {
  return (
    isObject(value) &&
    isNumber(value.card_year) &&
    isString(value.timer_mode) &&
    isBoolean(value.blank_exchange_enabled) &&
    isNumber(value.call_window_seconds) &&
    isNumber(value.charleston_timer_seconds)
  );
}

function isHouseRules(value: unknown): boolean {
  return isObject(value) && isRuleset(value.ruleset) && isBoolean(value.analysis_enabled);
}

function isGamePhase(value: unknown): boolean {
  if (value === 'WaitingForPlayers') {
    return true;
  }

  if (!isObject(value)) {
    return false;
  }

  const keys = Object.keys(value);
  if (keys.length !== 1) {
    return false;
  }

  const phaseKey = keys[0];
  const phaseValue = value[phaseKey];

  switch (phaseKey) {
    case 'Setup':
    case 'Charleston':
      return isString(phaseValue);
    case 'Playing':
    case 'Scoring':
    case 'GameOver':
      return isObject(phaseValue);
    default:
      return false;
  }
}

function isSeatToTilesRecord(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }

  return Object.entries(value).every(([key, tiles]) => isSeat(key) && isTileArray(tiles));
}

function isRawGameStateSnapshot(value: unknown): value is RawGameStateSnapshot {
  if (!isObject(value)) {
    return false;
  }

  if (
    !isString(value.game_id) ||
    !isGamePhase(value.phase) ||
    !isSeat(value.current_turn) ||
    !isSeat(value.dealer) ||
    !isNumber(value.round_number) ||
    !isNumber(value.turn_number) ||
    !isNumber(value.remaining_tiles) ||
    !Array.isArray(value.discard_pile) ||
    !value.discard_pile.every(isDiscardInfo) ||
    !Array.isArray(value.players) ||
    !value.players.every(isPublicPlayerInfo) ||
    !isHouseRules(value.house_rules) ||
    !(value.charleston_state === null || isObject(value.charleston_state)) ||
    !isSeat(value.your_seat) ||
    !isTileArray(value.your_hand) ||
    !isNumber(value.wall_seed) ||
    !isNumber(value.wall_draw_index) ||
    !isNumber(value.wall_break_point) ||
    !isNumber(value.wall_tiles_remaining)
  ) {
    return false;
  }

  if ('all_player_hands' in value && value.all_player_hands !== undefined) {
    return isSeatToTilesRecord(value.all_player_hands);
  }

  return true;
}

/**
 * Build a typed GameStateSnapshot from raw JSON fixture data.
 *
 * Converts wall_seed from the JSON number representation to the bigint required
 * by the generated binding type. The returned value satisfies GameStateSnapshot
 * at construction time — no further casts are needed at call sites.
 */
export function buildGameStateSnapshot(raw: unknown): GameStateSnapshot {
  if (!isRawGameStateSnapshot(raw)) {
    throw new Error('Invalid game state fixture snapshot shape');
  }

  return { ...raw, wall_seed: BigInt(raw.wall_seed) };
}

/**
 * Build a minimal GameStateSnapshot for unit tests that exercise state updater
 * functions. Merges the provided overrides onto the playing-drawing base fixture
 * so every required field is always present.
 *
 * Prefer the named `gameStates.*` fixtures for integration tests. Use this
 * helper only when a test needs to control a specific subset of fields.
 */
export function buildMinimalSnapshot(overrides: Partial<GameStateSnapshot>): GameStateSnapshot {
  return {
    ...buildGameStateSnapshot(playingDrawingRaw),
    ...overrides,
  };
}

/**
 * Game State Fixtures
 *
 * Complete game state snapshots for testing different phases.
 */
export const gameStates = {
  /** Setup phase - Rolling dice */
  setupRollingDice: buildGameStateSnapshot(setupRollingDiceRaw),
  /** Setup phase - Wall broken, tiles dealt */
  setupWallBroken: buildGameStateSnapshot(setupWallBrokenRaw),
  /** Charleston phase - First Right pass */
  charlestonFirstRight: buildGameStateSnapshot(charlestonFirstRightRaw),
  /** Charleston phase - First Across pass */
  charlestonFirstAcross: buildGameStateSnapshot(charlestonFirstAcrossRaw),
  /** Charleston phase - First Left pass (blind pass available) */
  charlestonFirstLeft: buildGameStateSnapshot(charlestonFirstLeftRaw),
  /** Charleston phase - Voting to continue */
  charlestonVoting: buildGameStateSnapshot(charlestonVotingRaw),
  /** Charleston phase - Second Left pass (blind pass available) */
  charlestonSecondLeft: buildGameStateSnapshot(charlestonSecondLeftRaw),
  /** Charleston phase - Second Across pass */
  charlestonSecondAcross: buildGameStateSnapshot(charlestonSecondAcrossRaw),
  /** Charleston phase - Second Right pass (blind pass available) */
  charlestonSecondRight: buildGameStateSnapshot(charlestonSecondRightRaw),
  /** Charleston phase - Courtesy pass negotiation (CourtesyAcross) */
  charlestonCourtesyAcross: buildGameStateSnapshot(charlestonCourtesyAcrossRaw),
  /** Playing phase - Drawing stage */
  playingDrawing: buildGameStateSnapshot(playingDrawingRaw),
  /** Playing phase - Discarding stage */
  playingDiscarding: buildGameStateSnapshot(playingDiscardingRaw),
  /** Playing phase - Call window open */
  playingCallWindow: buildGameStateSnapshot(playingCallWindowRaw),
  /** Mid-game Charleston snapshot used for reconnect tests */
  midGameCharleston: buildGameStateSnapshot(midGameCharlestonRaw),
};

/**
 * Hand Fixtures
 *
 * Sample player hands for testing tile selection, validation, etc.
 */
export const hands = {
  /** Standard mixed hand at Charleston start */
  charlestonStandardHand,
  /** Complete winning hand with consecutive run */
  winningHandConsecutive,
  /** One tile away from winning */
  nearWinOneAway,
  /** Hand with multiple jokers */
  withJokers,
} as const;

/**
 * Event Sequence Fixtures
 *
 * Sequences of events for testing game flows.
 */
export const eventSequences = {
  /** Dice roll and wall break sequence */
  diceRollSequence,
  /** Charleston pass to the right */
  charlestonPassSequence,
  /** Charleston pass across */
  charlestonAcrossPassSequence,
  /** Call window with priority resolution */
  callWindowSequence,
  /** Standard turn draw and discard */
  turnFlowSequence,
  /** Join room event flow */
  joinRoomSequence,
  /** Disconnect/reconnect recovery sequence */
  reconnectFlowSequence,
} as const;

/**
 * All fixtures combined
 */
export const fixtures = {
  gameStates,
  hands,
  eventSequences,
} as const;
