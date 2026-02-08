/**
 * Integration Test: Call Window & Intent Buffering
 *
 * Tests the complete call window flow with WebSocket events
 * Related: US-011 (Call Window & Intent Buffering)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { GameBoard } from '@/components/game/GameBoard';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { gameStates } from '@/test/fixtures';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';

const DOT_7 = 24 as Tile;
const SOUTH: Seat = 'South';
const NORTH: Seat = 'North';

describe('Call Window Integration', () => {
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

  /**
   * Helper to get the last sent command
   */
  const getLastCommand = () => {
    const lastCall = mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1];
    if (!lastCall) return null;
    const envelope = JSON.parse(lastCall[0] as string);
    return envelope.payload.command;
  };

  it('AC-1: Call window opens when tile discarded and I am eligible', async () => {
    const initialState = gameStates.playingCallWindow;
    render(<GameBoard initialState={initialState} ws={mockWs} />);

    // Simulate CallWindowOpened event
    simulatePublicEvent({
      CallWindowOpened: {
        tile: DOT_7,
        discarded_by: NORTH,
        can_call: [SOUTH],
        timer: 10,
        started_at_ms: Date.now(),
        timer_mode: 'Standard',
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /call window/i })).toBeInTheDocument();
      expect(screen.getByText(/north discarded/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /call for pung/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /call for kong/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /call for mahjong/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /pass/i })).toBeInTheDocument();
      expect(screen.getByRole('timer')).toBeInTheDocument();
    });
  });

  it('AC-2: Clicking "Call for Pung" sends DeclareCallIntent command', async () => {
    const user = userEvent.setup();
    const initialState = gameStates.playingCallWindow;
    render(<GameBoard initialState={initialState} ws={mockWs} />);

    // Open call window
    simulatePublicEvent({
      CallWindowOpened: {
        tile: DOT_7,
        discarded_by: NORTH,
        can_call: [SOUTH],
        timer: 10,
        started_at_ms: Date.now(),
        timer_mode: 'Standard',
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Click "Call for Pung"
    const pungButton = screen.getByRole('button', { name: /call for pung/i });
    await user.click(pungButton);

    // Verify command was sent
    const command = getLastCommand();
    expect(command).toMatchObject({
      DeclareCallIntent: {
        player: SOUTH,
        intent: expect.objectContaining({ Meld: expect.any(Object) }),
      },
    });

    // Verify buttons are disabled after response
    await waitFor(() => {
      expect(pungButton).toBeDisabled();
      expect(screen.getByText(/waiting for others/i)).toBeInTheDocument();
    });
  });

  it('AC-3: Clicking "Call for Mahjong" sends Mahjong intent', async () => {
    const user = userEvent.setup();
    const initialState = gameStates.playingCallWindow;
    render(<GameBoard initialState={initialState} ws={mockWs} />);

    // Open call window
    simulatePublicEvent({
      CallWindowOpened: {
        tile: DOT_7,
        discarded_by: NORTH,
        can_call: [SOUTH],
        timer: 10,
        started_at_ms: Date.now(),
        timer_mode: 'Standard',
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Click "Call for Mahjong"
    const mahjongButton = screen.getByRole('button', { name: /call for mahjong/i });
    await user.click(mahjongButton);

    // Verify command was sent
    const command = getLastCommand();
    expect(command).toMatchObject({
      DeclareCallIntent: {
        player: SOUTH,
        intent: 'Mahjong',
      },
    });

    // Verify waiting message appears
    await waitFor(() => {
      expect(screen.getByText(/waiting for others/i)).toBeInTheDocument();
    });
  });

  it('AC-4: Clicking "Pass" sends Pass command', async () => {
    const user = userEvent.setup();
    const initialState = gameStates.playingCallWindow;
    render(<GameBoard initialState={initialState} ws={mockWs} />);

    // Open call window
    simulatePublicEvent({
      CallWindowOpened: {
        tile: DOT_7,
        discarded_by: NORTH,
        can_call: [SOUTH],
        timer: 10,
        started_at_ms: Date.now(),
        timer_mode: 'Standard',
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Click "Pass"
    const passButton = screen.getByRole('button', { name: /pass/i });
    await user.click(passButton);

    // Verify Pass command was sent
    const command = getLastCommand();
    expect(command).toEqual({
      Pass: { player: SOUTH },
    });

    // Verify waiting message appears
    await waitFor(() => {
      expect(screen.getByText(/waiting for others/i)).toBeInTheDocument();
    });
  });

  it('AC-6: Call resolved with Mahjong winner displays message and closes window', async () => {
    const initialState = gameStates.playingCallWindow;
    render(<GameBoard initialState={initialState} ws={mockWs} />);

    // Open call window
    simulatePublicEvent({
      CallWindowOpened: {
        tile: DOT_7,
        discarded_by: NORTH,
        can_call: [SOUTH],
        timer: 10,
        started_at_ms: Date.now(),
        timer_mode: 'Standard',
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Resolve call - South wins with Mahjong
    simulatePublicEvent({
      CallResolved: {
        resolution: { Mahjong: SOUTH },
      },
    });

    // Verify message appears
    await waitFor(() => {
      expect(screen.getByText(/south wins call for mahjong/i)).toBeInTheDocument();
    });

    // Verify call window is closed
    expect(screen.queryByRole('dialog', { name: /call window/i })).not.toBeInTheDocument();
  });

  it('AC-8: CallWindowClosed event closes the window', async () => {
    const initialState = gameStates.playingCallWindow;
    render(<GameBoard initialState={initialState} ws={mockWs} />);

    // Open call window
    simulatePublicEvent({
      CallWindowOpened: {
        tile: DOT_7,
        discarded_by: NORTH,
        can_call: [SOUTH],
        timer: 10,
        started_at_ms: Date.now(),
        timer_mode: 'Standard',
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Close call window
    simulatePublicEvent('CallWindowClosed');

    // Verify call window is closed
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /call window/i })).not.toBeInTheDocument();
    });
  });

  it('AC-9: Auto-pass when timer expires', async () => {
    vi.useFakeTimers();
    const initialState = gameStates.playingCallWindow;
    render(<GameBoard initialState={initialState} ws={mockWs} />);

    const startTime = Date.now();

    // Open call window with 2 second timer
    simulatePublicEvent({
      CallWindowOpened: {
        tile: DOT_7,
        discarded_by: NORTH,
        can_call: [SOUTH],
        timer: 2,
        started_at_ms: startTime,
        timer_mode: 'Standard',
      },
    });

    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    // Fast-forward past timer expiry
    act(() => {
      vi.advanceTimersByTime(2500);
    });

    // Verify auto-pass command was sent
    await waitFor(() => {
      const command = getLastCommand();
      expect(command).toEqual({
        Pass: { player: SOUTH },
      });
      expect(screen.getByText(/time expired - auto-passed/i)).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it('AC-10: Call window not shown if not eligible', async () => {
    const initialState = gameStates.playingCallWindow;
    render(<GameBoard initialState={initialState} ws={mockWs} />);

    // Open call window but South is not in can_call list
    simulatePublicEvent({
      CallWindowOpened: {
        tile: DOT_7,
        discarded_by: NORTH,
        can_call: ['West', 'East'], // South not included
        timer: 10,
        started_at_ms: Date.now(),
        timer_mode: 'Standard',
      },
    });

    // Wait a bit to ensure no window appears
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    // Verify call window is NOT shown
    expect(screen.queryByRole('dialog', { name: /call window/i })).not.toBeInTheDocument();
  });
});
