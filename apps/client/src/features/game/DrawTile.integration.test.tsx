/**
 * DrawTile Integration Test
 *
 * Tests the automatic tile drawing flow (US-009).
 */

import { render, screen, act } from '@testing-library/react';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { GameBoard } from '@/components/game/GameBoard';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { fixtures } from '@/test/fixtures';
import { TILE_INDICES } from '@/lib/utils/tileUtils';

describe('US-009: Drawing a Tile (Integration)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('triggers automatic DrawTile command when it is my turn and stage is Drawing', async () => {
    const mockWs = createMockWebSocket();
    const initialState = fixtures.gameStates.playingDrawing; // me = South, turn = South

    render(<GameBoard initialState={initialState} ws={mockWs} />);

    // Fast-forward 500ms for the auto-draw delay
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Verify command was sent
    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({
        kind: 'Command',
        payload: {
          command: { DrawTile: { player: 'South' } },
        },
      })
    );

    // Verify status message
    expect(screen.getByTestId('playing-status')).toHaveTextContent(/your turn - drawing tile/i);
  });

  it('updates hand and wall when TileDrawnPrivate is received', async () => {
    const mockWs = createMockWebSocket();
    const initialState = fixtures.gameStates.playingDrawing; // 45 tiles remaining, 13 in hand

    render(<GameBoard initialState={initialState} ws={mockWs} />);

    // Simulate TileDrawnPrivate
    act(() => {
      mockWs.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Private: {
              TileDrawnPrivate: {
                tile: TILE_INDICES.DOT_START + 4, // DOT_5
                remaining_tiles: 44,
              },
            },
          },
        },
      });
      vi.advanceTimersByTime(0); // Flush microtasks
    });

    // Wall counter should update
    expect(screen.getByTestId('wall-counter-value')).toHaveTextContent('44');

    // Hand should now have 14 tiles
    expect(screen.getByLabelText(/Your hand: 14 tiles/i)).toBeInTheDocument();
  });

  it('updates wall counter when TileDrawnPublic is received for another player', async () => {
    const mockWs = createMockWebSocket();
    const initialState = fixtures.gameStates.playingDrawing;

    render(<GameBoard initialState={initialState} ws={mockWs} />);

    // Simulate TileDrawnPublic
    act(() => {
      mockWs.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Public: {
              TileDrawnPublic: {
                remaining_tiles: 44,
              },
            },
          },
        },
      });
      vi.advanceTimersByTime(0);
    });

    expect(screen.getByTestId('wall-counter-value')).toHaveTextContent('44');
  });
});
