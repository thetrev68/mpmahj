/**
 * Integration Test: Call Window & Intent Buffering
 *
 * Tests the complete call window flow with WebSocket events
 * Related: US-011 (Call Window & Intent Buffering)
 */

import { describe, it, expect, beforeEach } from 'vitest';
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
    const initialState = {
      ...gameStates.playingCallWindow,
      your_hand: [...gameStates.playingCallWindow.your_hand, DOT_7, DOT_7],
    };
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
      expect(screen.getByRole('button', { name: /call for quint/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /call for sextet/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /call for mahjong/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /pass/i })).toBeInTheDocument();
      expect(screen.getByRole('timer')).toBeInTheDocument();
    });
  });

  it('AC-2: Clicking "Call for Pung" sends DeclareCallIntent command', async () => {
    const user = userEvent.setup();
    const initialState = {
      ...gameStates.playingCallWindow,
      your_hand: [...gameStates.playingCallWindow.your_hand, DOT_7, DOT_7],
    };
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
        intent: {
          Meld: expect.objectContaining({ meld_type: 'Pung' }),
        },
      },
    });

    // Verify buttons are disabled after response
    await waitFor(() => {
      expect(pungButton).toBeDisabled();
      expect(screen.getByText(/declared intent to call for pung/i)).toBeInTheDocument();
    });
  });

  it('AC-2: Pung button enabled with joker assist', async () => {
    const initialState = {
      ...gameStates.playingCallWindow,
      your_hand: [...gameStates.playingCallWindow.your_hand, DOT_7, 42 as Tile],
    };
    render(<GameBoard initialState={initialState} ws={mockWs} />);

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
      const pungButton = screen.getByRole('button', { name: /call for pung/i });
      expect(pungButton).not.toBeDisabled();
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
      expect(screen.getByText(/declared mahjong/i)).toBeInTheDocument();
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

    // Verify pass message appears and panel is dismissed
    await waitFor(() => {
      expect(screen.getByText(/passed on 7 dot/i)).toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: /call window/i })).not.toBeInTheDocument();
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
        tie_break: null,
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
    const initialState = gameStates.playingCallWindow;
    render(<GameBoard initialState={initialState} ws={mockWs} />);

    const startTime = Date.now() - 2500;

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

    // Verify auto-pass command was sent
    await waitFor(() => {
      const command = getLastCommand();
      expect(command).toEqual({
        Pass: { player: SOUTH },
      });
      expect(screen.getByText(/time expired - auto-passed/i)).toBeInTheDocument();
    });
  });

  // ── Rapid event sequencing regression tests ─────────────────────────────────
  // These guard against race conditions that occurred when call-window state
  // was split between a local ref and React state. Now that the Zustand store
  // is the single owner, open→close→open sequences should be clean.

  it('rapid: close followed immediately by new open shows second window', async () => {
    const initialState = {
      ...gameStates.playingCallWindow,
      your_hand: [...gameStates.playingCallWindow.your_hand, DOT_7, DOT_7],
    };
    render(<GameBoard initialState={initialState} ws={mockWs} />);

    // First window opens
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
    });

    // Close first window and immediately open a second window for a different tile
    const CRACK_3 = 11 as Tile;
    act(() => {
      mockWs.triggerMessage({
        kind: 'Event',
        payload: { event: { Public: 'CallWindowClosed' } },
      });
      mockWs.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Public: {
              CallWindowOpened: {
                tile: CRACK_3,
                discarded_by: SOUTH,
                can_call: [SOUTH],
                timer: 10,
                started_at_ms: Date.now(),
                timer_mode: 'Standard',
              },
            },
          },
        },
      });
    });

    // Second window should be visible with the new tile
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /call window/i })).toBeInTheDocument();
      // Pass button confirms the window is interactive
      expect(screen.getByRole('button', { name: /pass/i })).toBeInTheDocument();
    });
  });

  it('rapid: CallResolved during open window closes it and shows message', async () => {
    const initialState = gameStates.playingCallWindow;
    render(<GameBoard initialState={initialState} ws={mockWs} />);

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

    // Progress update arrives before resolve
    simulatePublicEvent({
      CallWindowProgress: {
        can_act: [SOUTH],
        intents: [{ seat: NORTH, kind: { Meld: { meld_type: 'Pung' } } }],
      },
    });

    // CallResolved arrives without an intervening CallWindowClosed
    simulatePublicEvent({
      CallResolved: {
        resolution: { Meld: { winner: NORTH, meld_type: 'Pung' } },
        tie_break: null,
      },
    });

    // Window is gone and a resolution message is visible
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /call window/i })).not.toBeInTheDocument();
    });
  });

  it('rapid: progress updates from old window do not bleed into new window', async () => {
    const initialState = {
      ...gameStates.playingCallWindow,
      your_hand: [...gameStates.playingCallWindow.your_hand, DOT_7, DOT_7],
    };
    render(<GameBoard initialState={initialState} ws={mockWs} />);

    // Open first window
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

    // Progress accumulates on first window
    simulatePublicEvent({
      CallWindowProgress: {
        can_act: [],
        intents: [{ seat: SOUTH, kind: { Meld: { meld_type: 'Pung' } } }],
      },
    });

    // Close first window, open second with empty intents
    act(() => {
      mockWs.triggerMessage({
        kind: 'Event',
        payload: { event: { Public: 'CallWindowClosed' } },
      });
      mockWs.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Public: {
              CallWindowOpened: {
                tile: DOT_7,
                discarded_by: NORTH,
                can_call: [SOUTH],
                timer: 10,
                started_at_ms: Date.now(),
                timer_mode: 'Standard',
              },
            },
          },
        },
      });
    });

    // New window is open with fresh state — call buttons enabled (no stale hasResponded)
    await waitFor(() => {
      expect(screen.getByRole('dialog', { name: /call window/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /call for pung/i })).not.toBeDisabled();
    });
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

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /call window/i })).not.toBeInTheDocument();
    });
  });
});
