/**
 * Integration Test: Joker Exchange - Single (US-014)
 *
 * Tests the complete single joker exchange workflow:
 * 1. Player is in Discarding stage
 * 2. Opponent has an exposed meld with a Joker (representing a tile player has)
 * 3. Player clicks "Exchange Joker" button
 * 4. Dialog shows the exchange opportunity
 * 5. Player confirms exchange
 * 6. ExchangeJoker command is sent
 * 7. Server responds with JokerExchanged event
 * 8. Joker is added to player's hand
 * 9. Player's tile is added to opponent's meld
 * 10. Player can still discard (still in Discarding stage)
 *
 * Related: US-014 - Exchanging Joker (Single)
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

// Game state: South's turn (Discarding), West has Pung with Joker representing 5 Dot
const gameStateWithJokerOpportunity: GameState = {
  game_id: 'test-game-joker-exchange-001',
  your_seat: 'South',
  your_hand: [0, 1, 2, 3, 4, 18, 18, 19, 19, 20, 20, 21, 22, 22], // Includes 22 (Dot5)
  phase: { Playing: { Discarding: { player: 'South' } } },
  current_turn: 'South',
  dealer: 'East',
  round_number: 1,
  turn_number: 20,
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
      tile_count: 13,
      exposed_melds: [],
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
  wall_draw_index: 80,
  wall_break_point: 10,
  wall_tiles_remaining: 45,
};

describe('Joker Exchange Single Integration (US-014)', () => {
  let mockWs: MockWebSocket;

  beforeEach(() => {
    mockWs = createMockWebSocket();
  });

  test('AC-1 to AC-5: complete single joker exchange flow', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStateWithJokerOpportunity} ws={mockWs} />
    );

    // AC-1: Verify we're in Discarding stage
    expect(screen.getByTestId('playing-status')).toHaveTextContent(
      /Your turn - Select a tile to discard/
    );

    // AC-1: Verify Exchange Joker button is visible
    expect(screen.getByTestId('exchange-joker-button')).toBeInTheDocument();
    expect(screen.getByTestId('exchange-joker-button')).toBeEnabled();

    // AC-2: Click Exchange Joker button to open dialog
    await user.click(screen.getByTestId('exchange-joker-button'));

    // AC-2: Verify dialog appears with the opportunity
    await waitFor(() => {
      expect(screen.getByTestId('joker-exchange-dialog')).toBeInTheDocument();
    });

    // Dialog should show the exchange opportunity (5 Dot ↔ Joker from West)
    expect(screen.getByTestId('joker-exchange-dialog-title')).toHaveTextContent('Exchange Joker');
    expect(screen.getByTestId('exchange-opportunity-0')).toHaveTextContent(/5 Dot.*Joker/);
    expect(screen.getByTestId('exchange-opportunity-0')).toHaveTextContent(/West's meld/);

    // AC-3: Click Confirm Exchange button
    await user.click(screen.getByTestId('exchange-confirm-button-0'));

    // AC-3: Verify ExchangeJoker command was sent
    await waitFor(() => {
      expect(mockWs._sendMock).toHaveBeenCalled();
    });
    const sentCommand = JSON.parse(mockWs._sendMock.mock.calls[0][0]);
    const expectedCommand: GameCommand = {
      ExchangeJoker: {
        player: 'South',
        target_seat: 'West',
        meld_index: 0,
        replacement: 22, // Dot5
      },
    };
    expect(sentCommand.payload.command).toEqual(expectedCommand);

    // AC-3: Verify dialog shows loading state
    expect(screen.getByTestId('exchange-confirm-button-0')).toHaveTextContent(/Exchanging/);

    // AC-4: Simulate server response with JokerExchanged event
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

    // AC-4: Verify dialog closes
    await waitFor(() => {
      expect(screen.queryByTestId('joker-exchange-dialog')).not.toBeInTheDocument();
    });

    // AC-5: Verify still in Discarding stage (can still discard)
    expect(screen.getByTestId('playing-status')).toHaveTextContent(
      /Your turn - Select a tile to discard/
    );
    expect(screen.getByTestId('staging-discard-button')).toBeInTheDocument();
  });

  test('AC-6: cannot exchange during Drawing stage', async () => {
    const drawingState: GameState = {
      ...gameStateWithJokerOpportunity,
      phase: { Playing: { Drawing: { player: 'South' } } },
      your_hand: [0, 1, 2, 3, 4, 13, 13, 14, 14, 15, 15, 16, 16], // 13 tiles
    };

    renderWithProviders(<GameBoard initialState={drawingState} ws={mockWs} />);

    // Exchange Joker button should not be visible during Drawing stage
    expect(screen.queryByTestId('exchange-joker-button')).not.toBeInTheDocument();
  });

  test('canceling dialog closes without sending command', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStateWithJokerOpportunity} ws={mockWs} />
    );

    // Open dialog
    await user.click(screen.getByTestId('exchange-joker-button'));

    await waitFor(() => {
      expect(screen.getByTestId('joker-exchange-dialog')).toBeInTheDocument();
    });

    // Click Cancel button
    await user.click(screen.getByTestId('joker-exchange-cancel-button'));

    // Dialog should close
    await waitFor(() => {
      expect(screen.queryByTestId('joker-exchange-dialog')).not.toBeInTheDocument();
    });

    // No command should have been sent
    expect(mockWs._sendMock).not.toHaveBeenCalled();
  });

  test('exchange button is disabled when no joker opportunities available', () => {
    const noJokerState: GameState = {
      ...gameStateWithJokerOpportunity,
      players: gameStateWithJokerOpportunity.players.map((p) =>
        p.seat === 'West' ? { ...p, exposed_melds: [] } : p
      ),
    };

    renderWithProviders(<GameBoard initialState={noJokerState} ws={mockWs} />);

    // Exchange Joker button remains visible but disabled when no opportunities
    expect(screen.getByTestId('exchange-joker-button')).toBeDisabled();
  });
});
