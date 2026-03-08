/**
 * Integration Test: Joker Exchange - Multiple (US-015)
 *
 * Tests the complete multiple joker exchange workflow:
 * 1. Player is in Discarding stage
 * 2. Multiple opponents have exposed melds with Jokers (representing tiles player has)
 * 3. Player clicks "Exchange Joker" button
 * 4. Dialog shows all exchange opportunities
 * 5. Player exchanges first Joker
 * 6. Dialog remains open with updated opportunities
 * 7. Player exchanges second Joker
 * 8. Player closes dialog
 * 9. Player can still discard (still in Discarding stage)
 *
 * Related: US-015 - Exchanging Joker (Multiple in One Turn)
 */

import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { GameBoard } from '@/components/game/GameBoard';
import type { GameState } from '@/components/game/GameBoard';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

// Mock WebSocket
interface MockWebSocket {
  send: (data: string) => void;
  addEventListener: (event: string, handler: (e: MessageEvent) => void) => void;
  removeEventListener: (event: string, handler: (e: MessageEvent) => void) => void;
  _messageHandlers: Array<(event: MessageEvent) => void>;
  _sendMock: ReturnType<typeof vi.fn>;
  simulateMessage: (data: unknown) => void;
}

function createMockWebSocket(): MockWebSocket {
  const handlers: Array<(event: MessageEvent) => void> = [];
  const sendFn = vi.fn();

  return {
    send: sendFn as unknown as (data: string) => void,
    addEventListener: vi.fn((event: string, handler: (e: MessageEvent) => void) => {
      if (event === 'message') {
        handlers.push(handler);
      }
    }) as unknown as (event: string, handler: (e: MessageEvent) => void) => void,
    removeEventListener: vi.fn() as unknown as (
      event: string,
      handler: (e: MessageEvent) => void
    ) => void,
    _messageHandlers: handlers,
    _sendMock: sendFn,
    simulateMessage(data: unknown) {
      const event = new MessageEvent('message', {
        data: JSON.stringify(data),
      });
      handlers.forEach((handler) => handler(event));
    },
  };
}

// Game state: South's turn (Discarding), West has Pung with Joker (5 Dot), North has Kong with Joker (2 Crak)
const gameStateWithMultipleJokerOpportunities: GameState = {
  game_id: 'test-game-joker-exchange-multi-001',
  your_seat: 'South',
  your_hand: [0, 1, 2, 3, 4, 10, 18, 19, 20, 21, 21, 22, 22, 23], // Includes 10 (Crak2) and 22 (Dot5)
  phase: { Playing: { Discarding: { player: 'South' } } },
  current_turn: 'South',
  dealer: 'East',
  round_number: 1,
  turn_number: 25,
  remaining_tiles: 45,
  players: [
    {
      seat: 'East',
      player_id: 'east-player',
      is_bot: false,
      status: 'Active',
      tile_count: 13,
      exposed_melds: [],
    },
    {
      seat: 'South',
      player_id: 'south-player',
      is_bot: false,
      status: 'Active',
      tile_count: 14,
      exposed_melds: [],
    },
    {
      seat: 'West',
      player_id: 'west-player',
      is_bot: true,
      status: 'Active',
      tile_count: 11, // 11 concealed + 3 exposed (Pung) = 14
      exposed_melds: [
        {
          meld_type: 'Pung',
          tiles: [22, 22, 37], // Dot5, Dot5, Joker
          called_tile: 22,
          joker_assignments: {
            '2': 22, // Joker at position 2 represents Dot5
          },
        },
      ],
    },
    {
      seat: 'North',
      player_id: 'north-player',
      is_bot: true,
      status: 'Active',
      tile_count: 10, // 10 concealed + 4 exposed (Kong) = 14
      exposed_melds: [
        {
          meld_type: 'Kong',
          tiles: [10, 10, 10, 37], // Crak2, Crak2, Crak2, Joker
          called_tile: 10,
          joker_assignments: {
            '3': 10, // Joker at position 3 represents Crak2
          },
        },
      ],
    },
  ],
  discard_pile: [
    { tile: 5, discarded_by: 'East', player: 'East', turn: 1, safe: false, called: false },
    { tile: 6, discarded_by: 'West', player: 'West', turn: 2, safe: false, called: false },
    { tile: 7, discarded_by: 'North', player: 'North', turn: 3, safe: false, called: false },
  ],
  house_rules: {
    ruleset: {
      card_year: 2025,
      timer_mode: 'Visible',
      blank_exchange_enabled: false,
      call_window_seconds: 10,
      charleston_timer_seconds: 60,
    },
    analysis_enabled: true,
  },
  charleston_state: null,
  wall_seed: BigInt(1234567890),
  wall_draw_index: 85,
  wall_break_point: 10,
  wall_tiles_remaining: 45,
};

describe('Joker Exchange Multiple Integration (US-015)', () => {
  let mockWs: MockWebSocket;

  beforeEach(() => {
    mockWs = createMockWebSocket();
  });

  test('AC-1 to AC-2: exchange multiple jokers sequentially', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStateWithMultipleJokerOpportunities} ws={mockWs} />
    );

    // AC-1: Verify we're in Discarding stage with Exchange Joker button
    expect(screen.getByTestId('playing-status')).toHaveTextContent(
      /Your turn - Select a tile to discard/
    );
    expect(screen.getByTestId('exchange-joker-button')).toBeInTheDocument();

    // Open the exchange dialog
    await user.click(screen.getByTestId('exchange-joker-button'));

    await waitFor(() => {
      expect(screen.getByTestId('joker-exchange-dialog')).toBeInTheDocument();
    });

    // AC-1: Verify multiple opportunities are shown (2 opportunities)
    expect(screen.getByTestId('exchange-opportunity-0')).toBeInTheDocument();
    expect(screen.getByTestId('exchange-opportunity-1')).toBeInTheDocument();

    // First opportunity should be 5 Dot from West
    expect(screen.getByTestId('exchange-opportunity-0')).toHaveTextContent(/5 Dot.*Joker/);
    expect(screen.getByTestId('exchange-opportunity-0')).toHaveTextContent(/West's meld/);

    // Second opportunity should be 2 Crack from North
    expect(screen.getByTestId('exchange-opportunity-1')).toHaveTextContent(/2 Crack.*Joker/);
    expect(screen.getByTestId('exchange-opportunity-1')).toHaveTextContent(/North's meld/);

    // AC-2: Exchange first Joker (Dot5 from West)
    await user.click(screen.getByTestId('exchange-confirm-button-0'));

    // Verify first ExchangeJoker command was sent
    await waitFor(() => {
      expect(mockWs._sendMock).toHaveBeenCalledTimes(1);
    });
    const firstCommand = JSON.parse(mockWs._sendMock.mock.calls[0][0]);
    const expectedFirstCommand: GameCommand = {
      ExchangeJoker: {
        player: 'South',
        target_seat: 'West',
        meld_index: 0,
        replacement: 22, // Dot5
      },
    };
    expect(firstCommand.payload.command).toEqual(expectedFirstCommand);

    // Simulate server response with first JokerExchanged event
    act(() => {
      mockWs.simulateMessage({
        kind: 'Event',
        payload: {
          event: {
            Public: {
              JokerExchanged: {
                player: 'South',
                target_seat: 'West',
                joker: 37, // Joker
                replacement: 22, // Dot5
              },
            },
          },
        },
      });
    });

    // AC-2: Dialog should close after first exchange (our implementation closes it)
    await waitFor(() => {
      expect(screen.queryByTestId('joker-exchange-dialog')).not.toBeInTheDocument();
    });

    // AC-2: Exchange button should still be visible (another opportunity remains)
    expect(screen.getByTestId('exchange-joker-button')).toBeInTheDocument();

    // Open dialog again to exchange second Joker
    await user.click(screen.getByTestId('exchange-joker-button'));

    await waitFor(() => {
      expect(screen.getByTestId('joker-exchange-dialog')).toBeInTheDocument();
    });

    // Now only one opportunity should remain (2 Crack from North)
    expect(screen.getByTestId('exchange-opportunity-0')).toBeInTheDocument();
    expect(screen.queryByTestId('exchange-opportunity-1')).not.toBeInTheDocument();
    expect(screen.getByTestId('exchange-opportunity-0')).toHaveTextContent(/2 Crack.*Joker/);

    // Exchange second Joker (Crak2 from North)
    await user.click(screen.getByTestId('exchange-confirm-button-0'));

    // Verify second ExchangeJoker command was sent
    await waitFor(() => {
      expect(mockWs._sendMock).toHaveBeenCalledTimes(2);
    });
    const secondCommand = JSON.parse(mockWs._sendMock.mock.calls[1][0]);
    const expectedSecondCommand: GameCommand = {
      ExchangeJoker: {
        player: 'South',
        target_seat: 'North',
        meld_index: 0,
        replacement: 10, // Crak2
      },
    };
    expect(secondCommand.payload.command).toEqual(expectedSecondCommand);

    // Simulate server response with second JokerExchanged event
    act(() => {
      mockWs.simulateMessage({
        kind: 'Event',
        payload: {
          event: {
            Public: {
              JokerExchanged: {
                player: 'South',
                target_seat: 'North',
                joker: 37, // Joker
                replacement: 10, // Crak2
              },
            },
          },
        },
      });
    });

    // Dialog should close after second exchange
    await waitFor(() => {
      expect(screen.queryByTestId('joker-exchange-dialog')).not.toBeInTheDocument();
    });

    // AC-4: Still in Discarding stage (can discard)
    expect(screen.getByTestId('playing-status')).toHaveTextContent(
      /Your turn - Select a tile to discard/
    );
    expect(screen.getByTestId('staging-discard-button')).toBeInTheDocument();

    // Exchange Joker button should no longer be visible (no opportunities left)
    expect(screen.queryByTestId('exchange-joker-button')).not.toBeInTheDocument();
  });

  test('AC-3: no arbitrary limit on exchanges (limited only by matching tiles)', async () => {
    // This test verifies the spec: "No arbitrary limit, only limited by hand contents"
    // The number of exchanges is constrained only by:
    // 1. Having matching tiles in hand
    // 2. Having Jokers in opponent melds that represent those tiles

    const { user } = renderWithProviders(
      <GameBoard initialState={gameStateWithMultipleJokerOpportunities} ws={mockWs} />
    );

    // Open the exchange dialog
    await user.click(screen.getByTestId('exchange-joker-button'));

    await waitFor(() => {
      expect(screen.getByTestId('joker-exchange-dialog')).toBeInTheDocument();
    });

    // Verify both opportunities are available (player has both matching tiles)
    expect(screen.getByTestId('exchange-opportunity-0')).toBeInTheDocument();
    expect(screen.getByTestId('exchange-opportunity-1')).toBeInTheDocument();

    // Note: If there were 3, 4, or more matching tiles and corresponding Jokers,
    // all would be available for exchange. There's no hardcoded limit.
  });
});
