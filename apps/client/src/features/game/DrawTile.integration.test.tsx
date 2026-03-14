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
    expect(screen.getByTestId('gameplay-status-bar')).toHaveTextContent(/your turn — drawing/i);
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
    // Drawn tile appears in incoming staging lane (AC-1 staging-first: tile is NOT yet in rack)
    const drawnTileIndex = TILE_INDICES.DOT_START + 4;
    expect(screen.getByTestId(`staging-incoming-tile-${drawnTileIndex}-0`)).toBeInTheDocument();
    expect(screen.queryByTestId('wall-east')).not.toBeInTheDocument();

    // Rack shows 13 tiles while drawn tile is pending absorption from staging
    expect(screen.getByLabelText(/Your rack: 13 tiles/i)).toBeInTheDocument();

    // After staging auto-clears (1500ms timer), tile moves into rack (14 tiles total)
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(screen.getByLabelText(/Your rack: 14 tiles/i)).toBeInTheDocument();
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
                player: 'South',
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

  it('shows wall low warning when tiles remaining <= 20', async () => {
    const mockWs = createMockWebSocket();
    const initialState = {
      ...fixtures.gameStates.playingDrawing,
      wall_tiles_remaining: 20,
    };

    render(<GameBoard initialState={initialState} ws={mockWs} />);

    expect(screen.getByTestId('wall-low-warning')).toBeInTheDocument();
    expect(screen.getByTestId('wall-low-warning')).toHaveTextContent(/wall low.*20 tiles/i);
  });

  it('does not show wall low warning when tiles > 20', async () => {
    const mockWs = createMockWebSocket();
    const initialState = {
      ...fixtures.gameStates.playingDrawing,
      wall_tiles_remaining: 21,
    };

    render(<GameBoard initialState={initialState} ws={mockWs} />);

    expect(screen.queryByTestId('wall-low-warning')).not.toBeInTheDocument();
  });

  it('shows wall exhausted warning and message when WallExhausted event received', async () => {
    const mockWs = createMockWebSocket();
    const initialState = fixtures.gameStates.playingDrawing;

    render(<GameBoard initialState={initialState} ws={mockWs} />);

    // Simulate WallExhausted event
    act(() => {
      mockWs.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Public: {
              WallExhausted: {
                remaining_tiles: 0,
              },
            },
          },
        },
      });
      vi.advanceTimersByTime(0);
    });

    expect(screen.getByTestId('wall-counter-value')).toHaveTextContent('0');
    expect(screen.getByTestId('wall-exhausted-warning')).toBeInTheDocument();
    // US-021: WallExhausted now shows draw overlay instead of inline error message
    expect(screen.getByTestId('draw-overlay')).toBeInTheDocument();
  });

  it('highlights only the active rack when in Playing phase', async () => {
    const mockWs = createMockWebSocket();
    const initialState = fixtures.gameStates.playingDrawing; // South's turn

    render(<GameBoard initialState={initialState} ws={mockWs} />);

    expect(screen.getByTestId('player-rack')).toHaveClass('ring-2', 'ring-green-400');
    expect(screen.getByTestId('opponent-rack-east')).not.toHaveClass('ring-green-400');
    expect(screen.getByTestId('opponent-rack-west')).not.toHaveClass('ring-green-400');
    expect(screen.getByTestId('opponent-rack-north')).not.toHaveClass('ring-green-400');
    expect(document.querySelectorAll('.ring-green-400')).toHaveLength(1);
  });

  it('retries DrawTile command on network failure', async () => {
    const mockWs = createMockWebSocket();
    const initialState = fixtures.gameStates.playingDrawing;

    render(<GameBoard initialState={initialState} ws={mockWs} />);

    // Initial auto-draw
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockWs.send).toHaveBeenCalledTimes(1);

    // Simulate no response from server (no TileDrawnPrivate event)
    // Wait 5 seconds for retry timeout
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Should retry the command
    expect(mockWs.send).toHaveBeenCalledTimes(2);
    expect(screen.getByText(/failed to draw tile.*retrying.*1\/3/i)).toBeInTheDocument();
  });

  it('stops retrying after 3 attempts', async () => {
    const mockWs = createMockWebSocket();
    const initialState = fixtures.gameStates.playingDrawing;

    render(<GameBoard initialState={initialState} ws={mockWs} />);

    // Initial auto-draw
    act(() => {
      vi.advanceTimersByTime(500);
    });

    // Retry 1
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Retry 2
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    // Retry 3
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockWs.send).toHaveBeenCalledTimes(4); // 1 initial + 3 retries
    expect(screen.getByText(/failed to draw tile.*refresh/i)).toBeInTheDocument();

    // Should not retry again
    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(mockWs.send).toHaveBeenCalledTimes(4); // No additional calls
  });

  it('clears retry state when TileDrawnPrivate is received', async () => {
    const mockWs = createMockWebSocket();
    const initialState = fixtures.gameStates.playingDrawing;

    render(<GameBoard initialState={initialState} ws={mockWs} />);

    // Initial auto-draw
    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(mockWs.send).toHaveBeenCalledTimes(1);

    // Wait a bit but not enough to trigger retry
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    // Receive successful response before retry fires (retry is at 5000ms)
    act(() => {
      mockWs.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Private: {
              TileDrawnPrivate: {
                tile: TILE_INDICES.JOKER,
                remaining_tiles: 44,
              },
            },
          },
        },
      });
    });

    // Now advance past what would have been retry time (500 + 2000 + 10000 = 12500ms total)
    act(() => {
      vi.advanceTimersByTime(10000);
    });

    // Should not retry after successful response
    expect(mockWs.send).toHaveBeenCalledTimes(1);
  });
});
