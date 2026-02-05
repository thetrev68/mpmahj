/**
 * Fixture Index
 *
 * Central import point for all test fixtures.
 * Import fixtures from this file for type safety and convenience.
 */

// Game State Fixtures
import charlestonFirstRight from './game-states/charleston-first-right.json';
import playingDrawing from './game-states/playing-drawing.json';
import playingCallWindow from './game-states/playing-call-window.json';

// Hand Fixtures
import charlestonStandardHand from './hands/charleston-standard-hand.json';
import winningHandConsecutive from './hands/winning-hand-consecutive.json';
import nearWinOneAway from './hands/near-win-one-away.json';
import withJokers from './hands/with-jokers.json';

// Event Sequence Fixtures
import charlestonPassSequence from './events/charleston-pass-sequence.json';
import callWindowSequence from './events/call-window-sequence.json';
import turnFlowSequence from './events/turn-flow-sequence.json';
import joinRoomSequence from './events/join-room-sequence.json';

// Room Fixtures
import roomList from './rooms/room-list.json';

/**
 * Game State Fixtures
 *
 * Complete game state snapshots for testing different phases.
 */
export const gameStates = {
  /** Charleston phase - First Right pass */
  charlestonFirstRight,
  /** Playing phase - Drawing stage */
  playingDrawing,
  /** Playing phase - Call window open */
  playingCallWindow,
} as const;

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
  /** Charleston pass to the right */
  charlestonPassSequence,
  /** Call window with priority resolution */
  callWindowSequence,
  /** Standard turn draw and discard */
  turnFlowSequence,
  /** Join room event flow */
  joinRoomSequence,
} as const;

/**
 * Room Fixtures
 *
 * Sample room data for testing lobby and room list.
 */
export const rooms = {
  /** Sample list of available rooms */
  roomList,
} as const;

/**
 * All fixtures combined
 */
export const fixtures = {
  gameStates,
  hands,
  eventSequences,
  rooms,
} as const;
