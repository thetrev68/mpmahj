/**
 * Integration Tests for VR-006: Charleston First Left staging strip
 *
 * Verifies blind Charleston uses the shared staging strip instead of the
 * removed BlindPassPanel controls.
 */

import { describe, expect, test, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { gameStates } from '@/test/fixtures';
import { GameBoard } from '@/components/game/GameBoard';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { PrivateEvent } from '@/types/bindings/generated/PrivateEvent';

describe('VR-006: Charleston First Left staging strip', () => {
  let mockWs: ReturnType<typeof createMockWebSocket>;

  const getTileByValue = (value: number) => screen.getAllByTestId(new RegExp(`^tile-${value}-`))[0];

  beforeEach(() => {
    mockWs = createMockWebSocket();
    vi.clearAllMocks();
  });

  test('renders the staging strip and not the legacy blind panel', () => {
    renderWithProviders(<GameBoard initialState={gameStates.charlestonFirstLeft} ws={mockWs} />);

    expect(screen.getByTestId('staging-strip')).toBeInTheDocument();
    expect(screen.queryByTestId('blind-pass-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('staging-pass-button')).toBeDisabled();
  });

  test('stages blind incoming tiles face-down when IncomingTilesStaged arrives', async () => {
    renderWithProviders(<GameBoard initialState={gameStates.charlestonFirstLeft} ws={mockWs} />);

    const stagedEvent: PrivateEvent = {
      IncomingTilesStaged: {
        player: 'South',
        tiles: [3, 14],
        from: null,
        context: 'Charleston',
      },
    };

    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({ kind: 'Event', payload: { event: { Private: stagedEvent } } })
      );
    });

    expect(screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-0-3')).toHaveClass(
      'tile-face-down'
    );
    expect(screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-1-14')).toHaveClass(
      'tile-face-down'
    );
  });

  test('computes CommitCharlestonPass from selected hand tiles plus remaining staged incoming', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.charlestonFirstLeft} ws={mockWs} />
    );

    const stagedEvent: PrivateEvent = {
      IncomingTilesStaged: {
        player: 'South',
        tiles: [3, 14],
        from: null,
        context: 'Charleston',
      },
    };

    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({ kind: 'Event', payload: { event: { Private: stagedEvent } } })
      );
    });

    const firstIncoming = screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-0-3');
    await user.click(firstIncoming);
    expect(firstIncoming).not.toHaveClass('tile-face-down');

    await user.click(firstIncoming);
    expect(
      screen.queryByTestId('staging-incoming-tile-incoming-FirstLeft-0-3')
    ).not.toBeInTheDocument();

    await user.click(getTileByValue(10));
    await user.click(getTileByValue(13));
    expect(screen.getByTestId('staging-pass-button')).toBeEnabled();

    await user.click(screen.getByTestId('staging-pass-button'));

    const expectedCommand: GameCommand = {
      CommitCharlestonPass: {
        player: 'South',
        from_hand: [10, 13],
        forward_incoming_count: 1,
      },
    };

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
    );
  });

  test('shows pass animation layer with Left direction', async () => {
    renderWithProviders(<GameBoard initialState={gameStates.charlestonFirstLeft} ws={mockWs} />);

    const tilesPassingEvent: PublicEvent = {
      TilesPassing: { direction: 'Left' },
    };
    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({ kind: 'Event', payload: { event: { Public: tilesPassingEvent } } })
      );
    });

    expect(screen.getByTestId('pass-animation-layer')).toBeInTheDocument();
    expect(screen.getByTestId('pass-animation-layer')).toHaveTextContent(/Passing Left/);
  });

  test('clears opponent staging tile backs when TilesPassing begins', async () => {
    renderWithProviders(<GameBoard initialState={gameStates.charlestonFirstLeft} ws={mockWs} />);

    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({
          kind: 'Event',
          payload: {
            event: { Public: { PlayerStagedTile: { player: 'North', count: 3 } } },
          },
        })
      );
    });

    expect(screen.getByTestId('opponent-staging-north').children).toHaveLength(3);

    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({
          kind: 'Event',
          payload: {
            event: { Public: { TilesPassing: { direction: 'Left' } } },
          },
        })
      );
    });

    await waitFor(() => {
      expect(screen.queryByTestId('opponent-staging-north')).not.toBeInTheDocument();
    });
  });

  test('resets staged blind tiles when the phase advances to voting', async () => {
    renderWithProviders(<GameBoard initialState={gameStates.charlestonFirstLeft} ws={mockWs} />);

    const stagedEvent: PrivateEvent = {
      IncomingTilesStaged: {
        player: 'South',
        tiles: [3, 14],
        from: null,
        context: 'Charleston',
      },
    };

    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({ kind: 'Event', payload: { event: { Private: stagedEvent } } })
      );
    });

    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({
          kind: 'Event',
          payload: {
            event: { Public: { CharlestonPhaseChanged: { stage: 'VotingToContinue' } } },
          },
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/vote/i);
    });

    expect(
      screen.queryByTestId('staging-incoming-tile-incoming-FirstLeft-0-3')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('vote-panel')).toBeInTheDocument();
    expect(screen.getByTestId('staging-pass-button')).toBeDisabled();
  });
});
