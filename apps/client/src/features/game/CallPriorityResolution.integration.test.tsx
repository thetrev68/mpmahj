/**
 * Integration Test: Call Priority Resolution
 *
 * Tests the complete call priority resolution flow with multiple callers
 * Related: US-012 (Call Priority Resolution)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameBoard } from '@/components/game/GameBoard';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { gameStates } from '@/test/fixtures';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';

const DOT_5 = 22 as Tile;
const EAST: Seat = 'East';
const SOUTH: Seat = 'South';
const WEST: Seat = 'West';
const NORTH: Seat = 'North';

describe('Call Priority Resolution Integration', () => {
  let mockWs: ReturnType<typeof createMockWebSocket>;

  beforeEach(() => {
    mockWs = createMockWebSocket();
  });

  /**
   * Helper to simulate a public event
   */
  const simulatePublicEvent = (event: unknown) => {
    act(() => {
      mockWs.triggerMessage({
        kind: 'Event',
        payload: {
          event: { Public: event },
        },
      });
    });
  };

  it('AC-2: Shows "Mahjong beats Pung" when Mahjong wins over Pung', async () => {
    const initialState = gameStates.playingCallWindow;
    render(<GameBoard initialState={initialState} ws={mockWs} />);

    // Step 1: CallWindowOpened
    simulatePublicEvent({
      CallWindowOpened: {
        tile: DOT_5,
        discarded_by: NORTH,
        can_call: [SOUTH, WEST],
        timer: 10,
        started_at_ms: Date.now(),
        timer_mode: 'Standard',
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /call window/i })).toBeInTheDocument();
    });

    // Step 2: CallWindowProgress - multiple intents
    simulatePublicEvent({
      CallWindowProgress: {
        can_act: [],
        intents: [
          { seat: SOUTH, kind: 'Mahjong' },
          { seat: WEST, kind: { Meld: { meld_type: 'Pung' } } },
        ],
      },
    });

    // Wait for progress to be processed
    await waitFor(() => {
      expect(screen.getByText(/South.*Mahjong/i)).toBeInTheDocument();
    });

    // Step 3: CallResolved - Mahjong wins
    simulatePublicEvent({
      CallResolved: {
        resolution: { Mahjong: SOUTH },
        tie_break: null,
      },
    });

    // Verify resolution overlay shows
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /call resolved/i })).toBeInTheDocument();
      expect(screen.getByText(/South wins: Mahjong beats Pung/i)).toBeInTheDocument();
      expect(screen.getByText(/Priority Rules:/i)).toBeInTheDocument();
    });

    // Verify all callers are listed
    expect(screen.getByText(/South: Mahjong/i)).toBeInTheDocument();
    expect(screen.getByText(/West: Pung/i)).toBeInTheDocument();
  });

  it('AC-3: Shows "Closest to discarder" when meld tie-break occurs', async () => {
    const initialState = gameStates.playingCallWindow;
    render(<GameBoard initialState={initialState} ws={mockWs} />);

    // Step 1: CallWindowOpened
    simulatePublicEvent({
      CallWindowOpened: {
        tile: DOT_5,
        discarded_by: EAST,
        can_call: [SOUTH, WEST],
        timer: 10,
        started_at_ms: Date.now(),
        timer_mode: 'Standard',
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /call window/i })).toBeInTheDocument();
    });

    // Step 2: CallWindowProgress - both want Pung
    simulatePublicEvent({
      CallWindowProgress: {
        can_act: [],
        intents: [
          { seat: SOUTH, kind: { Meld: { meld_type: 'Pung' } } },
          { seat: WEST, kind: { Meld: { meld_type: 'Pung' } } },
        ],
      },
    });

    // Wait for progress to be processed
    await waitFor(() => {
      expect(screen.getByText(/South.*Pung/i)).toBeInTheDocument();
    });

    // Step 3: CallResolved - South wins (closer to East)
    simulatePublicEvent({
      CallResolved: {
        resolution: {
          Meld: { seat: SOUTH, meld: { Pung: [DOT_5, DOT_5, DOT_5] } },
        },
        tie_break: {
          SeatOrder: {
            discarded_by: EAST,
            contenders: [SOUTH, WEST],
          },
        },
      },
    });

    // Verify resolution overlay shows tie-break explanation
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /call resolved/i })).toBeInTheDocument();
      expect(screen.getByText(/South wins: Closest to discarder/i)).toBeInTheDocument();
      expect(screen.getByText(/Tie-Break:/i)).toBeInTheDocument();
      expect(screen.getByText(/Tied contenders: South, West/i)).toBeInTheDocument();
    });
  });

  it('AC-4: Shows "Both Mahjong, X is closer" when multiple Mahjong calls', async () => {
    const initialState = gameStates.playingCallWindow;
    render(<GameBoard initialState={initialState} ws={mockWs} />);

    // Step 1: CallWindowOpened
    simulatePublicEvent({
      CallWindowOpened: {
        tile: DOT_5,
        discarded_by: EAST,
        can_call: [SOUTH, NORTH],
        timer: 10,
        started_at_ms: Date.now(),
        timer_mode: 'Standard',
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /call window/i })).toBeInTheDocument();
    });

    // Step 2: CallWindowProgress - both want Mahjong
    simulatePublicEvent({
      CallWindowProgress: {
        can_act: [],
        intents: [
          { seat: SOUTH, kind: 'Mahjong' },
          { seat: NORTH, kind: 'Mahjong' },
        ],
      },
    });

    // Wait for progress to be processed
    await waitFor(() => {
      expect(screen.getByText(/South.*Mahjong/i)).toBeInTheDocument();
    });

    // Step 3: CallResolved - South wins (closer to East)
    simulatePublicEvent({
      CallResolved: {
        resolution: { Mahjong: SOUTH },
        tie_break: {
          SeatOrder: {
            discarded_by: EAST,
            contenders: [SOUTH, NORTH],
          },
        },
      },
    });

    // Verify resolution overlay shows Mahjong tie-break
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /call resolved/i })).toBeInTheDocument();
      expect(screen.getByText(/South wins: Both Mahjong, South is closer/i)).toBeInTheDocument();
      expect(screen.getByText(/Tied contenders: South, North/i)).toBeInTheDocument();
    });
  });

  it('User can dismiss the overlay by clicking Continue', async () => {
    const user = userEvent.setup();
    const initialState = gameStates.playingCallWindow;
    render(<GameBoard initialState={initialState} ws={mockWs} />);

    // Open call window
    simulatePublicEvent({
      CallWindowOpened: {
        tile: DOT_5,
        discarded_by: NORTH,
        can_call: [SOUTH, WEST],
        timer: 10,
        started_at_ms: Date.now(),
        timer_mode: 'Standard',
      },
    });

    // Progress with intents
    simulatePublicEvent({
      CallWindowProgress: {
        can_act: [],
        intents: [
          { seat: SOUTH, kind: 'Mahjong' },
          { seat: WEST, kind: { Meld: { meld_type: 'Pung' } } },
        ],
      },
    });

    // Wait for progress to be processed
    await waitFor(() => {
      expect(screen.getByText(/South.*Mahjong/i)).toBeInTheDocument();
    });

    // Resolve
    simulatePublicEvent({
      CallResolved: {
        resolution: { Mahjong: SOUTH },
        tie_break: null,
      },
    });

    // Wait for overlay
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /call resolved/i })).toBeInTheDocument();
    });

    // Click Continue button
    const continueButton = screen.getByRole('button', { name: /continue/i });
    await user.click(continueButton);

    // Verify overlay is dismissed
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /call resolved/i })).not.toBeInTheDocument();
    });
  });

  it('Does not show overlay for NoCall resolution', async () => {
    const initialState = gameStates.playingCallWindow;
    render(<GameBoard initialState={initialState} ws={mockWs} />);

    // Open call window
    simulatePublicEvent({
      CallWindowOpened: {
        tile: DOT_5,
        discarded_by: NORTH,
        can_call: [SOUTH],
        timer: 10,
        started_at_ms: Date.now(),
        timer_mode: 'Standard',
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /call window/i })).toBeInTheDocument();
    });

    // Resolve with NoCall
    simulatePublicEvent({
      CallResolved: {
        resolution: 'NoCall',
        tie_break: null,
      },
    });

    // Verify simple message shown, no overlay
    await waitFor(() => {
      expect(screen.getByText(/no one called the tile/i)).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: /call resolved/i })).not.toBeInTheDocument();
    });
  });

  it('Handles three-way Mahjong tie correctly', async () => {
    const initialState = gameStates.playingCallWindow;
    render(<GameBoard initialState={initialState} ws={mockWs} />);

    // Open call window
    simulatePublicEvent({
      CallWindowOpened: {
        tile: DOT_5,
        discarded_by: EAST,
        can_call: [SOUTH, WEST, NORTH],
        timer: 10,
        started_at_ms: Date.now(),
        timer_mode: 'Standard',
      },
    });

    // Progress with three Mahjong intents
    simulatePublicEvent({
      CallWindowProgress: {
        can_act: [],
        intents: [
          { seat: SOUTH, kind: 'Mahjong' },
          { seat: WEST, kind: 'Mahjong' },
          { seat: NORTH, kind: 'Mahjong' },
        ],
      },
    });

    // Wait for progress to be processed
    await waitFor(() => {
      expect(screen.getByText(/South.*Mahjong/i)).toBeInTheDocument();
    });

    // Resolve - South wins
    simulatePublicEvent({
      CallResolved: {
        resolution: { Mahjong: SOUTH },
        tie_break: {
          SeatOrder: {
            discarded_by: EAST,
            contenders: [SOUTH, WEST, NORTH],
          },
        },
      },
    });

    // Verify overlay shows all three contenders
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /call resolved/i })).toBeInTheDocument();
      expect(screen.getByText(/Multiple Mahjong calls, South is closer/i)).toBeInTheDocument();
      expect(screen.getByText(/Tied contenders: South, West, North/i)).toBeInTheDocument();
    });
  });
});
