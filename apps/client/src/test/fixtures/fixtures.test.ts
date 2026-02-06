import { gameStates, hands, eventSequences, fixtures } from './index';
import type { GameState } from '@/components/game/GameBoard';

/**
 * Verify all fixtures load correctly and have expected structure
 */
describe('Test Fixtures', () => {
  describe('Game States', () => {
    test('charleston-first-right loads correctly', () => {
      const state = gameStates.charlestonFirstRight;

      expect(state.game_id).toBe('test-game-charleston-001');
      expect(state.phase).toEqual({ Charleston: 'FirstRight' });
      expect(state.your_seat).toBe('South');
      expect(state.your_hand).toHaveLength(13);
      expect(state.players).toHaveLength(4);
    });

    test('playing-drawing loads correctly', () => {
      const state = gameStates.playingDrawing;
      // Extra JSON fields not on GameState accessed via record cast
      const raw = state as GameState & Record<string, unknown>;

      expect(state.game_id).toBe('test-game-playing-001');
      expect(state.phase).toEqual({ Playing: 'Drawing' });
      expect(raw.current_turn).toBe('South');
      expect(raw.discard_pile).toHaveLength(3);
    });

    test('playing-call-window loads correctly', () => {
      const state = gameStates.playingCallWindow;
      const raw = state as GameState & Record<string, unknown>;

      expect(state.game_id).toBe('test-game-call-window-001');
      expect(state.phase).toHaveProperty('Playing');
      expect(raw.discard_pile).toHaveLength(4);
      expect(state.your_hand).toContain(0); // Has matching tiles for potential call
    });
  });

  describe('Hands', () => {
    test('charleston-standard-hand has 13 tiles', () => {
      const hand = hands.charlestonStandardHand;

      expect(hand.tiles).toHaveLength(13);
      expect(hand.tile_count).toBe(13);
      expect(hand.name).toBe('Standard Charleston Hand');
    });

    test('winning-hand-consecutive is complete', () => {
      const hand = hands.winningHandConsecutive;

      expect(hand.tiles).toHaveLength(14);
      expect(hand.is_winning).toBe(true);
      expect(hand.tile_count).toBe(14);
    });

    test('near-win-one-away needs exactly 1 tile', () => {
      const hand = hands.nearWinOneAway;

      expect(hand.tiles).toHaveLength(13);
      expect(hand.is_winning).toBe(false);
      expect(hand.deficiency_count).toBe(1);
      expect(hand.needed_tiles).toEqual([8]); // Bam 9
    });

    test('with-jokers has 3 jokers', () => {
      const hand = hands.withJokers;

      expect(hand.joker_count).toBe(3);
      const jokers = hand.tiles.filter((t) => t === 35);
      expect(jokers).toHaveLength(3);
    });
  });

  describe('Event Sequences', () => {
    test('charleston-pass-sequence has correct flow', () => {
      const sequence = eventSequences.charlestonPassSequence;

      expect(sequence.scenario).toBe('Charleston First Right Standard Pass');
      expect(sequence.events).toHaveLength(5);
      expect(sequence.events[0]).toHaveProperty('Public');
      expect(sequence.events[2]).toHaveProperty('Private');
    });

    test('call-window-sequence shows priority resolution', () => {
      const sequence = eventSequences.callWindowSequence;

      expect(sequence.scenario).toBe('Call Window with Multiple Intents');
      expect(sequence.events).toHaveLength(6);

      // Check that Mahjong wins over Pung
      const resolved = sequence.events.find((e) => 'Public' in e && 'CallResolved' in e.Public);
      expect(resolved).toBeDefined();
    });

    test('turn-flow-sequence shows complete turn', () => {
      const sequence = eventSequences.turnFlowSequence;

      expect(sequence.scenario).toBe('Standard Turn Flow - Draw and Discard');
      expect(sequence.events).toHaveLength(6);

      // First event should be TurnStarted
      expect(sequence.events[0]).toHaveProperty('Public');
    });
  });

  describe('Fixture Index', () => {
    test('exports all fixture categories', () => {
      expect(fixtures).toHaveProperty('gameStates');
      expect(fixtures).toHaveProperty('hands');
      expect(fixtures).toHaveProperty('eventSequences');
    });

    test('all game states are accessible', () => {
      expect(fixtures.gameStates.charlestonFirstRight).toBeDefined();
      expect(fixtures.gameStates.playingDrawing).toBeDefined();
      expect(fixtures.gameStates.playingCallWindow).toBeDefined();
    });

    test('all hands are accessible', () => {
      expect(fixtures.hands.charlestonStandardHand).toBeDefined();
      expect(fixtures.hands.winningHandConsecutive).toBeDefined();
      expect(fixtures.hands.nearWinOneAway).toBeDefined();
      expect(fixtures.hands.withJokers).toBeDefined();
    });

    test('all event sequences are accessible', () => {
      expect(fixtures.eventSequences.charlestonPassSequence).toBeDefined();
      expect(fixtures.eventSequences.callWindowSequence).toBeDefined();
      expect(fixtures.eventSequences.turnFlowSequence).toBeDefined();
    });
  });
});
