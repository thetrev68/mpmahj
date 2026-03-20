import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GameBoard } from '@/components/game/GameBoard';
import { fixtures } from '@/test/fixtures';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { renderWithProviders } from '@/test/test-utils';

const { baseHint: hintPayload, charlestonHint: charlestonHintPayload } = fixtures.hintData;

describe('US-055: Right Rail Hint Flow (Integration)', () => {
  it('renders no AI hint content in setup', () => {
    renderWithProviders(<GameBoard initialState={fixtures.gameStates.setupWallBroken} />);

    expect(document.getElementById('right-rail-hint-slot')).toBeEmptyDOMElement();
    expect(screen.queryByTestId('right-rail-hint-section')).not.toBeInTheDocument();
  });

  it('requests and renders a hint through the right rail', async () => {
    const ws = createMockWebSocket();
    const { user } = renderWithProviders(
      <GameBoard initialState={fixtures.gameStates.playingDiscarding} ws={ws} />
    );

    await waitFor(() => expect(screen.getByTestId('right-rail-hint-section')).toBeInTheDocument());
    await user.click(screen.getByTestId('get-hint-button'));

    expect(screen.getByTestId('hint-request-dialog')).toBeInTheDocument();

    await user.click(screen.getByTestId('request-analysis-button'));

    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({
        kind: 'Command',
        payload: {
          command: { RequestHint: { player: 'South' } },
        },
      })
    );

    expect(screen.getByTestId('hint-loading-inline')).toBeInTheDocument();
    expect(screen.queryByTestId('hint-loading-overlay')).not.toBeInTheDocument();

    act(() => {
      ws.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Analysis: {
              HintUpdate: {
                hint: hintPayload,
              },
            },
          },
        },
      });
    });

    await waitFor(() => expect(screen.getByTestId('hint-panel')).toBeInTheDocument());
    expect(screen.getByTestId('right-rail-hint-section')).toContainElement(
      screen.getByTestId('hint-panel')
    );
    expect(screen.getByTestId('hint-panel')).not.toHaveClass('fixed');
    expect(screen.getByTestId('hint-best-patterns')).toBeInTheDocument();
    expect(screen.getByText('Consecutive Run')).toBeInTheDocument();
    expect(screen.queryByTestId('toggle-hint-panel-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('close-hint-panel')).not.toBeInTheDocument();
  });

  it('requests and renders a Charleston hint with both pass recommendations and pattern guidance', async () => {
    const ws = createMockWebSocket();
    const { user } = renderWithProviders(
      <GameBoard initialState={fixtures.gameStates.charlestonFirstRight} ws={ws} />
    );

    await waitFor(() => expect(screen.getByTestId('right-rail-hint-section')).toBeInTheDocument());
    await user.click(screen.getByTestId('get-hint-button'));

    expect(screen.getByTestId('hint-request-dialog')).toBeInTheDocument();

    await user.click(screen.getByTestId('request-analysis-button'));

    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({
        kind: 'Command',
        payload: {
          command: { RequestHint: { player: 'South' } },
        },
      })
    );

    act(() => {
      ws.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Analysis: {
              HintUpdate: {
                hint: charlestonHintPayload,
              },
            },
          },
        },
      });
    });

    await waitFor(() => expect(screen.getByTestId('hint-panel')).toBeInTheDocument());
    expect(screen.getByTestId('hint-charleston-pass-recommendations')).toBeInTheDocument();
    expect(screen.queryByText(/recommended discard/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('hint-best-patterns')).toBeInTheDocument();
    expect(screen.getByText('Consecutive Run')).toBeInTheDocument();
  });

  it('preserves a loaded hint in historical view but blocks new requests', async () => {
    const ws = createMockWebSocket();
    const { user } = renderWithProviders(
      <GameBoard initialState={fixtures.gameStates.playingDiscarding} ws={ws} />
    );

    await waitFor(() => expect(screen.getByTestId('get-hint-button')).toBeInTheDocument());
    await user.click(screen.getByTestId('get-hint-button'));
    await user.click(screen.getByTestId('request-analysis-button'));

    act(() => {
      ws.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Analysis: {
              HintUpdate: {
                hint: hintPayload,
              },
            },
          },
        },
      });
      ws.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Public: {
              StateRestored: {
                move_number: 5,
                description: 'Move 5: reviewing a prior discard',
                mode: { Viewing: { at_move: 5 } },
              },
            },
          },
        },
      });
    });

    await waitFor(() => expect(screen.getByTestId('historical-view-banner')).toBeInTheDocument());
    expect(screen.getByTestId('hint-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('get-hint-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('get-new-hint-button')).not.toBeInTheDocument();
  });

  it('does not flash the old fixed hint panel after a snapshot remount', async () => {
    const ws = createMockWebSocket();
    const { user } = renderWithProviders(
      <GameBoard initialState={fixtures.gameStates.playingDiscarding} ws={ws} />
    );

    await waitFor(() => expect(screen.getByTestId('get-hint-button')).toBeInTheDocument());
    await user.click(screen.getByTestId('get-hint-button'));
    await user.click(screen.getByTestId('request-analysis-button'));

    act(() => {
      ws.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Analysis: {
              HintUpdate: {
                hint: hintPayload,
              },
            },
          },
        },
      });
    });

    await waitFor(() => expect(screen.getByTestId('hint-panel')).toBeInTheDocument());

    act(() => {
      ws.triggerMessage({
        kind: 'StateSnapshot',
        payload: {
          snapshot: fixtures.gameStates.playingDiscarding,
        },
      });
    });

    await waitFor(() => expect(screen.getByTestId('right-rail')).toBeInTheDocument());
    expect(screen.queryByTestId('hint-loading-overlay')).not.toBeInTheDocument();
    expect(screen.queryByTestId('toggle-hint-panel-button')).not.toBeInTheDocument();
    if (screen.queryByTestId('hint-panel')) {
      expect(screen.getByTestId('hint-panel')).not.toHaveClass('fixed');
    }
  });

  it('keeps the loaded hint coherent when transitioning from Charleston into Playing', async () => {
    const ws = createMockWebSocket();
    const { user } = renderWithProviders(
      <GameBoard initialState={fixtures.gameStates.charlestonFirstRight} ws={ws} />
    );

    await waitFor(() => expect(screen.getByTestId('get-hint-button')).toBeInTheDocument());
    await user.click(screen.getByTestId('get-hint-button'));
    await user.click(screen.getByTestId('request-analysis-button'));

    act(() => {
      ws.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Analysis: {
              HintUpdate: {
                hint: charlestonHintPayload,
              },
            },
          },
        },
      });
    });

    await waitFor(() =>
      expect(screen.getByTestId('hint-charleston-pass-recommendations')).toBeInTheDocument()
    );

    act(() => {
      ws.triggerMessage({
        kind: 'StateSnapshot',
        payload: {
          snapshot: fixtures.gameStates.playingDiscarding,
        },
      });
    });

    await waitFor(() => expect(screen.getByTestId('right-rail-hint-section')).toBeInTheDocument());
    expect(screen.getByTestId('hint-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('get-hint-button')).not.toBeInTheDocument();
  });
});
