import { act, screen, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GameBoard } from '@/components/game/GameBoard';
import { fixtures } from '@/test/fixtures';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { renderWithProviders } from '@/test/test-utils';

describe('US-025: Jump to Historical Move (Integration)', () => {
  it('jumps to history in solo mode and supports keyboard navigation + return', async () => {
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
                ],
              },
            },
          },
        },
      });
    });

    await user.click(screen.getByTestId('history-entry-2'));
    await user.click(screen.getByText(/Jump to Move #2/i, { selector: 'button' }));

    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({
        kind: 'Command',
        payload: {
          command: { JumpToMove: { player: 'South', move_number: 2 } },
        },
      })
    );

    act(() => {
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

    expect(screen.getByTestId('historical-view-banner')).toBeInTheDocument();
    expect(screen.getByTestId('action-bar-read-only')).toHaveTextContent(
      /Historical View - No actions available/i
    );
    expect(screen.getByTestId('discard-pool')).toHaveClass(
      'top-1/4',
      'w-full',
      'max-w-[678px]',
      'grid',
      'grid-cols-[repeat(20,32px)]',
      'gap-0.5',
      'p-2'
    );
    expect(screen.getByTestId('discard-pool')).not.toHaveClass(
      'top-1/2',
      '-translate-y-1/2',
      'overflow-auto'
    );
    expect(screen.getByTestId('discard-pool-tile-0')).not.toHaveAttribute('style');

    await user.keyboard('{ArrowLeft}');
    await waitFor(() =>
      expect(ws.send).toHaveBeenCalledWith(
        JSON.stringify({
          kind: 'Command',
          payload: {
            command: { JumpToMove: { player: 'South', move_number: 1 } },
          },
        })
      )
    );

    await user.keyboard('{Escape}');
    expect(ws.send).toHaveBeenCalledWith(
      JSON.stringify({
        kind: 'Command',
        payload: {
          command: { ReturnToPresent: { player: 'South' } },
        },
      })
    );
  });

  it('blocks jump in active multiplayer games', async () => {
    const ws = createMockWebSocket();
    const { user } = renderWithProviders(
      <GameBoard initialState={fixtures.gameStates.playingDiscarding} ws={ws} />
    );

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
                    move_number: 8,
                    timestamp: '2026-02-10T12:00:00Z',
                    seat: 'South',
                    action: { DiscardTile: { tile: 24 } },
                    description: 'South discarded 7 Dot',
                  },
                ],
              },
            },
          },
        },
      });
    });

    await user.click(screen.getByTestId('history-entry-8'));
    await user.click(screen.getByText(/Jump to Move #8/i, { selector: 'button' }));

    expect(screen.getByTestId('history-warning')).toHaveTextContent(
      /Cannot jump to history in active multiplayer game/i
    );
    expect(ws.send).not.toHaveBeenCalledWith(
      JSON.stringify({
        kind: 'Command',
        payload: {
          command: { JumpToMove: { player: 'South', move_number: 8 } },
        },
      })
    );
  });
});
