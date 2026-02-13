import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GameBoard } from '@/components/game/GameBoard';
import { fixtures } from '@/test/fixtures';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { renderWithProviders } from '@/test/test-utils';

describe('US-026: Resume from History Point (Integration)', () => {
  it('resumes from a historical move and exits read-only mode', async () => {
    const ws = createMockWebSocket();
    const soloState = {
      ...fixtures.gameStates.playingDiscarding,
      players: fixtures.gameStates.playingDiscarding.players.map((player) =>
        player.seat === 'South' ? player : { ...player, is_bot: true }
      ),
    };
    const { user } = renderWithProviders(<GameBoard initialState={soloState} ws={ws} />);

    await user.click(screen.getByTestId('history-button'));
    act(() => {
      ws.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Public: {
              HistoryList: {
                entries: [
                  {
                    move_number: 1,
                    timestamp: '2026-02-10T12:00:00Z',
                    seat: 'South',
                    action: { DrawTile: { tile: 12, visible: false } },
                    description: 'South drew tile',
                  },
                  {
                    move_number: 2,
                    timestamp: '2026-02-10T12:01:00Z',
                    seat: 'South',
                    action: { DiscardTile: { tile: 24 } },
                    description: 'South discarded 7 Dot',
                  },
                  {
                    move_number: 3,
                    timestamp: '2026-02-10T12:02:00Z',
                    seat: 'West',
                    action: { DrawTile: { tile: 17, visible: false } },
                    description: 'West drew tile',
                  },
                ],
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
                move_number: 2,
                description: 'Move 2: South discarded 7 Dot',
                mode: { Viewing: { at_move: 2 } },
              },
            },
          },
        },
      });
    });

    await user.click(screen.getByTestId('resume-from-here-button'));
    expect(screen.getByTestId('resume-confirmation-dialog')).toBeInTheDocument();
    expect(screen.getByText(/moves will be lost/i)).toBeInTheDocument();

    await user.click(screen.getByTestId('confirm-resume-button'));
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({
        kind: 'Command',
        payload: {
          command: { ResumeFromHistory: { player: 'South', move_number: 2 } },
        },
      })
    );

    act(() => {
      ws.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Public: {
              HistoryTruncated: {
                from_move: 3,
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
                move_number: 2,
                description: 'Resumed from move 2',
                mode: 'None',
              },
            },
          },
        },
      });
    });

    expect(screen.queryByTestId('historical-view-banner')).not.toBeInTheDocument();
    expect(screen.queryByTestId('action-bar-read-only')).not.toBeInTheDocument();
    expect(screen.getByTestId('history-warning')).toHaveTextContent(/future moves deleted/i);
  });

  it('does not show resume button in multiplayer games', async () => {
    const ws = createMockWebSocket();
    renderWithProviders(<GameBoard initialState={fixtures.gameStates.playingDiscarding} ws={ws} />);

    act(() => {
      ws.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Public: {
              StateRestored: {
                move_number: 2,
                description: 'Move 2',
                mode: { Viewing: { at_move: 2 } },
              },
            },
          },
        },
      });
    });

    expect(screen.getByTestId('historical-view-banner')).toBeInTheDocument();
    expect(screen.queryByTestId('resume-from-here-button')).not.toBeInTheDocument();
  });
});
