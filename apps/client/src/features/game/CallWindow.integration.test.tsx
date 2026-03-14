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
const JOKER = 42 as Tile;

describe('Call Window Integration', () => {
  let mockWs: ReturnType<typeof createMockWebSocket>;

  beforeEach(() => {
    mockWs = createMockWebSocket();
  });

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

  const getLastCommand = () => {
    const lastCall = mockWs.send.mock.calls[mockWs.send.mock.calls.length - 1];
    if (!lastCall) return null;
    const envelope = JSON.parse(lastCall[0] as string);
    return envelope.payload.command;
  };

  const openCallWindow = () => {
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
  };

  it('AC-1/AC-2/AC-7: uses staging and Proceed instead of the modal button grid', async () => {
    const initialState = {
      ...gameStates.playingCallWindow,
      your_hand: [...gameStates.playingCallWindow.your_hand, DOT_7, DOT_7],
    };
    render(<GameBoard initialState={initialState} ws={mockWs} />);

    openCallWindow();

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /call window/i })).not.toBeInTheDocument();
      expect(screen.getByTestId(`staging-incoming-tile-call-window-${DOT_7}`)).toBeInTheDocument();
      expect(screen.getByTestId('proceed-button')).toBeEnabled();
      expect(screen.getByTestId('declare-mahjong-button')).toBeInTheDocument();
    });
  });

  it('AC-4: Proceed with no staged claim sends Pass', async () => {
    const user = userEvent.setup();
    render(<GameBoard initialState={gameStates.playingCallWindow} ws={mockWs} />);

    openCallWindow();

    await user.click(await screen.findByTestId('proceed-button'));

    expect(getLastCommand()).toEqual({
      Pass: { player: SOUTH },
    });

    await waitFor(() => {
      expect(
        screen.queryByTestId(`staging-incoming-tile-call-window-${DOT_7}`)
      ).not.toBeInTheDocument();
    });
  });

  it('AC-5: Proceed with a valid staged Pung sends the inferred meld intent', async () => {
    const user = userEvent.setup();
    const initialState = {
      ...gameStates.playingCallWindow,
      your_hand: [...gameStates.playingCallWindow.your_hand, DOT_7, DOT_7],
    };
    render(<GameBoard initialState={initialState} ws={mockWs} />);

    openCallWindow();

    await user.click(await screen.findByTestId('tile-24-24-0'));
    await user.click(screen.getByTestId('tile-24-24-1'));

    expect(screen.getByTestId('action-bar-claim-candidate-label')).toHaveTextContent('Pung ready');
    expect(screen.queryByTestId('staging-claim-candidate-label')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('proceed-button'));

    expect(getLastCommand()).toMatchObject({
      DeclareCallIntent: {
        player: SOUTH,
        intent: {
          Meld: {
            meld_type: 'Pung',
            tiles: [DOT_7, DOT_7, DOT_7],
            called_tile: DOT_7,
          },
        },
      },
    });
  });

  it('AC-5/EC-1: staged jokers still infer the correct claim deterministically', async () => {
    const user = userEvent.setup();
    const initialState = {
      ...gameStates.playingCallWindow,
      your_hand: [...gameStates.playingCallWindow.your_hand, DOT_7, DOT_7, JOKER],
    };
    render(<GameBoard initialState={initialState} ws={mockWs} />);

    openCallWindow();

    await user.click(await screen.findByTestId('tile-24-24-0'));
    await user.click(screen.getByTestId('tile-24-24-1'));
    await user.click(screen.getByTestId('tile-42-42-0'));

    expect(screen.getByTestId('action-bar-claim-candidate-label')).toHaveTextContent('Kong ready');
    expect(screen.queryByTestId('staging-claim-candidate-label')).not.toBeInTheDocument();

    await user.click(screen.getByTestId('proceed-button'));

    expect(getLastCommand()).toMatchObject({
      DeclareCallIntent: {
        player: SOUTH,
        intent: {
          Meld: {
            meld_type: 'Kong',
            tiles: [DOT_7, DOT_7, DOT_7, JOKER],
            called_tile: DOT_7,
          },
        },
      },
    });
  });

  it('AC-6/AC-8: invalid staged claims show feedback and keep Proceed enabled', async () => {
    const user = userEvent.setup();
    const initialState = {
      ...gameStates.playingCallWindow,
      your_hand: [1, 10, 11, 12, 19, 20, 21, 28, 29, 32, 42, 24, 24],
    };
    render(<GameBoard initialState={initialState} ws={mockWs} />);

    openCallWindow();

    await user.click(await screen.findByTestId('tile-1-1-0'));

    expect(screen.getByTestId('action-bar-claim-candidate-label')).toHaveTextContent(
      'Invalid claim'
    );
    expect(screen.queryByTestId('staging-claim-candidate-label')).not.toBeInTheDocument();
    expect(screen.getByTestId('proceed-button')).toBeEnabled();

    await user.click(screen.getByTestId('proceed-button'));

    expect(getLastCommand()).toBeNull();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Claims require 2 to 5 staged tiles from your rack.'
    );
  });

  it('EC-4: called-discard Mahjong remains a separate action', async () => {
    const user = userEvent.setup();
    render(<GameBoard initialState={gameStates.playingCallWindow} ws={mockWs} />);

    openCallWindow();

    await user.click(await screen.findByTestId('declare-mahjong-button'));

    expect(getLastCommand()).toMatchObject({
      DeclareCallIntent: {
        player: SOUTH,
        intent: 'Mahjong',
      },
    });
  });

  it('EC-2: staged claim selection clears when the claim window closes', async () => {
    const user = userEvent.setup();
    const initialState = {
      ...gameStates.playingCallWindow,
      your_hand: [...gameStates.playingCallWindow.your_hand, DOT_7, DOT_7],
    };
    render(<GameBoard initialState={initialState} ws={mockWs} />);

    openCallWindow();

    await user.click(await screen.findByTestId('tile-24-24-0'));
    expect(screen.getByTestId('staging-outgoing-tile-24-0')).toBeInTheDocument();

    simulatePublicEvent('CallWindowClosed');

    await waitFor(() => {
      expect(screen.queryByTestId('staging-outgoing-tile-24-0')).not.toBeInTheDocument();
      expect(
        screen.queryByTestId(`staging-incoming-tile-call-window-${DOT_7}`)
      ).not.toBeInTheDocument();
    });
  });
});
