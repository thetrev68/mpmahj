import { describe, expect, test, beforeEach, vi } from 'vitest';
import { renderWithProviders, screen, waitFor, act } from '@/test/test-utils';
import { GameBoard } from '@/components/game/GameBoard';
import { gameStates } from '@/test/fixtures';
import { createMockWebSocket } from '@/test/mocks/websocket';

function getSentCommands(ws: ReturnType<typeof createMockWebSocket>) {
  return ws.send.mock.calls
    .map((call) => JSON.parse(call[0]) as { kind: string; payload?: { command?: unknown } })
    .filter((message) => message.kind === 'Command' && message.payload?.command)
    .map((message) => message.payload!.command);
}

describe('US-027/US-028 Hint Flow Integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('requests hint with persisted default verbosity and renders HintUpdate', async () => {
    const ws = createMockWebSocket();
    localStorage.setItem(
      'hint_settings',
      JSON.stringify({
        verbosity: 'Intermediate',
        sound_enabled: true,
        sound_type: 'Chime',
      })
    );

    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.playingDiscarding} ws={ws} />
    );

    await user.click(screen.getByTestId('get-hint-button'));
    expect(screen.getByTestId('hint-request-dialog')).toBeInTheDocument();

    await user.click(screen.getByTestId('request-analysis-button'));

    const commands = getSentCommands(ws);
    expect(commands).toContainEqual({
      RequestHint: {
        player: 'South',
        verbosity: 'Intermediate',
      },
    });
    expect(screen.getByTestId('hint-loading-overlay')).toBeInTheDocument();

    act(() => {
      ws.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Analysis: {
              HintUpdate: {
                hint: {
                  recommended_discard: 10,
                  discard_reason: 'Safer discard in current board state',
                  best_patterns: [],
                  tiles_needed_for_win: [],
                  distance_to_win: 3,
                  hot_hand: false,
                  call_opportunities: [],
                  defensive_hints: [],
                  charleston_pass_recommendations: [],
                  tile_scores: { 10: 1.9 },
                  utility_scores: { 10: 0.4 },
                },
              },
            },
          },
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByTestId('hint-panel')).toBeInTheDocument();
    });
    expect(screen.queryByTestId('hint-loading-overlay')).not.toBeInTheDocument();
    expect(screen.getByTestId('hint-tile-scores')).toBeInTheDocument();
    expect(screen.getByTestId('hint-utility-scores')).toBeInTheDocument();

    const recommendedTile = screen.getByTestId(/tile-10-10-/);
    expect(recommendedTile.className).toContain('tile-highlighted');
  });

  test('resets hint settings to defaults, persists locally, and sends SetHintVerbosity', async () => {
    const ws = createMockWebSocket();
    localStorage.setItem(
      'hint_settings',
      JSON.stringify({
        verbosity: 'Expert',
        sound_enabled: false,
        sound_type: 'Bell',
      })
    );
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.playingDiscarding} ws={ws} />
    );

    await user.click(screen.getByTestId('hint-settings-button'));
    await user.click(screen.getByTestId('hint-settings-reset-button'));

    await waitFor(() => {
      const persisted = JSON.parse(localStorage.getItem('hint_settings') ?? '{}') as {
        verbosity?: string;
      };
      expect(persisted.verbosity).toBe('Beginner');
    });

    const commands = getSentCommands(ws);
    expect(commands).toContainEqual({
      SetHintVerbosity: {
        player: 'South',
        verbosity: 'Beginner',
      },
    });
    confirmSpy.mockRestore();
  });
});
