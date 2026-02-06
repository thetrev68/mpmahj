/**
 * Fixture Index
 *
 * Central import point for all test fixtures.
 * Import fixtures from this file for type safety and convenience.
 */

import type { GameState } from '@/components/game/GameBoard';

// Game State Fixtures
// JSON imports type string values as `string` not literals, so we cast to GameState
import setupRollingDice from './game-states/setup-rolling-dice.json';
import setupWallBroken from './game-states/setup-wall-broken.json';
import charlestonFirstRight from './game-states/charleston-first-right.json';
import charlestonFirstAcross from './game-states/charleston-first-across.json';
import charlestonFirstLeft from './game-states/charleston-first-left.json';
import playingDrawing from './game-states/playing-drawing.json';
import playingCallWindow from './game-states/playing-call-window.json';

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

/**
 * Game State Fixtures
 *
 * Complete game state snapshots for testing different phases.
 */
export const gameStates = {
  /** Setup phase - Rolling dice */
  setupRollingDice: setupRollingDice as unknown as GameState,
  /** Setup phase - Wall broken, tiles dealt */
  setupWallBroken: setupWallBroken as unknown as GameState,
  /** Charleston phase - First Right pass */
  charlestonFirstRight: charlestonFirstRight as unknown as GameState,
  /** Charleston phase - First Across pass */
  charlestonFirstAcross: charlestonFirstAcross as unknown as GameState,
  /** Charleston phase - First Left pass (blind pass available) */
  charlestonFirstLeft: charlestonFirstLeft as unknown as GameState,
  /** Playing phase - Drawing stage */
  playingDrawing: playingDrawing as unknown as GameState,
  /** Playing phase - Call window open */
  playingCallWindow: playingCallWindow as unknown as GameState,
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
} as const;

/**
 * All fixtures combined
 */
export const fixtures = {
  gameStates,
  hands,
  eventSequences,
} as const;
