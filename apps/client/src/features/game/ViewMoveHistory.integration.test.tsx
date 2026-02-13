import { act, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { GameBoard } from '@/components/game/GameBoard';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { fixtures } from '@/test/fixtures';
import { renderWithProviders } from '@/test/test-utils';

describe('US-024: View Move History (Integration)', () => {
  it('opens history panel, shows reverse-chronological entries, filters, and closes', async () => {
    const ws = createMockWebSocket();
    const { user } = renderWithProviders(
      <GameBoard initialState={fixtures.gameStates.playingDiscarding} ws={ws} />
    );

    await user.click(screen.getByTestId('history-button'));

    expect(screen.getByRole('dialog', { name: /game move history/i })).toBeInTheDocument();

    act(() => {
      ws.triggerMessage({
        kind: 'Event',
        payload: {
          event: {
            Public: {
              HistoryList: {
                entries: [
                  {
                    move_number: 23,
                    timestamp: '2026-02-10T12:00:00Z',
                    seat: 'West',
                    action: { DiscardTile: { tile: 11 } },
                    description: 'West discarded 3 Crack',
                  },
                  {
                    move_number: 24,
                    timestamp: '2026-02-10T12:01:00Z',
                    seat: 'South',
                    action: { DrawTile: { tile: 12, visible: false } },
                    description: 'South drew tile',
                  },
                  {
                    move_number: 25,
                    timestamp: '2026-02-10T12:02:00Z',
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

    const entries = screen.getAllByTestId(/history-entry-/);
    expect(entries[0]).toHaveAttribute('data-testid', 'history-entry-25');
    expect(screen.getByText(/South discarded 7 Dot/i)).toBeInTheDocument();

    await user.click(screen.getByLabelText(/Discard filter/i));
    expect(screen.getByText(/Showing 2 of 3 moves/i)).toBeInTheDocument();
    expect(screen.queryByText(/South drew tile/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Close history panel/i }));
    expect(screen.queryByText('Move History')).not.toBeInTheDocument();
  });

  it('toggles panel with H key and closes on Escape', async () => {
    const ws = createMockWebSocket();
    const { user } = renderWithProviders(
      <GameBoard initialState={fixtures.gameStates.playingDiscarding} ws={ws} />
    );

    await user.keyboard('h');
    expect(screen.getByRole('dialog', { name: /game move history/i })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByText('Move History')).not.toBeInTheDocument();
  });
});
