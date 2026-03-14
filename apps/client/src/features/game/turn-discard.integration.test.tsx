/**
 * Integration Test: Turn Discard Flow (US-010)
 *
 * Tests the complete turn discard workflow:
 * 1. Player is in Discarding stage (14 tiles)
 * 2. Player selects a tile to discard
 * 3. Player clicks "Discard" button
 * 4. DiscardTile command is sent
 * 5. Server responds with TileDiscarded event
 * 6. Tile is removed from hand (13 tiles)
 * 7. Tile appears in discard pool
 *
 * Related: US-010 - Discarding a Tile
 */

import { describe, expect, test, vi, beforeEach } from 'vitest';
import { act, renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { GameBoard } from '@/components/game/GameBoard';
import { gameStates } from '@/test/fixtures';
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

describe('Turn Discard Integration (US-010 Phase 1C)', () => {
  let mockWs: MockWebSocket;

  beforeEach(() => {
    mockWs = createMockWebSocket();
  });

  test('complete discard flow: select tile → discard → TileDiscarded event → hand updated', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.playingDiscarding} ws={mockWs} />
    );

    // Step 1: Verify we're in Discarding stage with 14 tiles
    expect(screen.getByTestId('gameplay-status-bar')).toHaveTextContent(
      /Your turn — Select a tile to discard/
    );
    expect(screen.getByTestId('player-rack')).toHaveAttribute('aria-label', 'Your rack: 14 tiles');
    expect(screen.queryByTestId('wall-north')).not.toBeInTheDocument();
    expect(screen.queryByTestId('wall-south')).not.toBeInTheDocument();
    expect(screen.queryByTestId('wall-east')).not.toBeInTheDocument();
    expect(screen.queryByTestId('wall-west')).not.toBeInTheDocument();

    // Step 2: Select a tile to discard (tile value 5)
    // Find any tile with value 5 in the hand
    const tileToDiscard = screen.getByTestId(/tile-5-/);
    await user.click(tileToDiscard);
    expect(tileToDiscard).toHaveClass('tile-selected');

    // Step 3: Verify Discard button is enabled
    expect(screen.getByTestId('proceed-button')).toBeInTheDocument();
    expect(screen.getByTestId('proceed-button')).toBeEnabled();

    // Step 4: Click Discard button
    await user.click(screen.getByTestId('proceed-button'));

    // Step 5: Verify DiscardTile command was sent
    const expectedCommand: GameCommand = {
      DiscardTile: { player: 'South', tile: 5 },
    };
    expect(mockWs._sendMock).toHaveBeenCalled();
    const sentCommand = JSON.parse(mockWs._sendMock.mock.calls[0][0]);
    expect(sentCommand.payload.command).toEqual(expectedCommand);

    // Step 6: Simulate server response with TileDiscarded event
    act(() => {
      mockWs.simulateMessage({
        kind: 'Event',
        payload: {
          event: {
            Public: {
              TileDiscarded: {
                player: 'South',
                tile: 5,
              },
            },
          },
        },
      });
    });

    // Step 7: Verify tile was removed from hand (14 → 13)
    await waitFor(() => {
      expect(screen.getByTestId('player-rack')).toHaveAttribute(
        'aria-label',
        'Your rack: 13 tiles'
      );
    });

    // Step 8: Verify tile appears in discard pool
    await waitFor(() => {
      expect(screen.getByTestId('discard-pool')).toBeInTheDocument();
      // The discarded tile should be visible in the pool
      const discardPoolTiles = screen.getAllByTestId(/^discard-pool-tile-/);
      // Initial discard pile had 3 tiles, now should have 4
      expect(discardPoolTiles.length).toBe(4);
    });

    // Step 9: Simulate call window opening and verify call affordances still work
    act(() => {
      mockWs.simulateMessage({
        kind: 'Event',
        payload: {
          event: {
            Public: {
              CallWindowOpened: {
                tile: 24,
                discarded_by: 'North',
                can_call: ['South'],
                timer: 10,
                started_at_ms: Date.now(),
                timer_mode: 'Standard',
              },
            },
          },
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('proceed-button')).toBeInTheDocument();
      expect(screen.getByTestId('declare-mahjong-button')).toBeInTheDocument();
      expect(screen.getByTestId('staging-incoming-tile-call-window-24')).toBeInTheDocument();
    });
  });

  test('discard button disabled when no tile selected', () => {
    renderWithProviders(<GameBoard initialState={gameStates.playingDiscarding} ws={mockWs} />);

    expect(screen.getByTestId('proceed-button')).toBeDisabled();
  });

  test('hand becomes non-interactive after sending discard command', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.playingDiscarding} ws={mockWs} />
    );

    // Select and discard a tile
    await user.click(screen.getByTestId(/tile-5-/));
    await user.click(screen.getByTestId('proceed-button'));

    // Try to select another tile - should not work (hand is disabled during processing)
    const anotherTile = screen.getByTestId(/tile-1-/);
    await user.click(anotherTile);

    // Verify only one command was sent (not two)
    expect(mockWs._sendMock).toHaveBeenCalledTimes(1);
  });
});
