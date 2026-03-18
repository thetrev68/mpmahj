import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GameBoard } from '@/components/game/GameBoard';
import { fixtures, gameStates } from '@/test/fixtures';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { renderWithProviders } from '@/test/test-utils';

const hintPayload = {
  recommended_discard: 10,
  discard_reason: 'Keeps more pattern options open',
  best_patterns: [
    {
      pattern_id: 'p1',
      variation_id: 'v1',
      pattern_name: 'Consecutive Run',
      probability: 0.62,
      score: 30,
      distance: 3,
    },
  ],
  tiles_needed_for_win: [],
  distance_to_win: 3,
  hot_hand: false,
  call_opportunities: [],
  defensive_hints: [],
  charleston_pass_recommendations: [],
  tile_scores: { 10: 2.2, 11: 1.4 },
  utility_scores: { 10: 0.8, 12: 0.3 },
};

const charlestonHintPayload = {
  ...hintPayload,
  recommended_discard: null,
  discard_reason: null,
  charleston_pass_recommendations: [10, 11, 12],
};

describe('US-055: Right Rail Hint Flow (Integration)', () => {
  it('renders no AI hint content in setup', () => {
    renderWithProviders(<GameBoard initialState={gameStates.setupWallBroken} />);

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
          command: { RequestHint: { player: 'South', verbosity: 'Intermediate' } },
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
    expect(screen.queryByTestId('toggle-hint-panel-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('close-hint-panel')).not.toBeInTheDocument();
  });

  it('requests and renders a Charleston hint through the same right rail flow', async () => {
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
          command: { RequestHint: { player: 'South', verbosity: 'Intermediate' } },
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
