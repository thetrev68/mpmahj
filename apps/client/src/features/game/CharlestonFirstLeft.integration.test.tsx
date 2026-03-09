/**
 * Integration Tests for VR-010: Charleston First Left blind incoming behavior
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

describe('VR-010: Charleston First Left blind incoming behavior', () => {
  let mockWs: ReturnType<typeof createMockWebSocket>;

  const getTileByValue = (value: number) => screen.getAllByTestId(new RegExp(`^tile-${value}-`))[0];
  const getRackTileCount = () => {
    const label = screen.getByTestId('player-rack').getAttribute('aria-label');
    const match = label?.match(/Your rack: (\d+) tiles/);
    return match ? Number(match[1]) : NaN;
  };
  const stageBlindIncoming = async (tiles: number[]) => {
    const stagedEvent: PrivateEvent = {
      IncomingTilesStaged: {
        player: 'South',
        tiles,
        from: null,
        context: 'Charleston',
      },
    };

    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({ kind: 'Event', payload: { event: { Private: stagedEvent } } })
      );
    });
  };

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

    await stageBlindIncoming([3, 14]);

    expect(screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-0-3')).toHaveClass(
      'tile-face-down'
    );
    expect(screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-1-14')).toHaveClass(
      'tile-face-down'
    );
    expect(screen.getByTestId('staging-incoming-badge-incoming-FirstLeft-0-3')).toHaveTextContent(
      'BLIND'
    );
    expect(screen.getByTestId('staging-incoming-badge-incoming-FirstLeft-1-14')).toHaveTextContent(
      'BLIND'
    );
  });

  test('moves absorbed blind incoming tiles into the rack view', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.charlestonFirstLeft} ws={mockWs} />
    );

    expect(getRackTileCount()).toBe(gameStates.charlestonFirstLeft.players[1].tile_count);

    await stageBlindIncoming([3, 14, 20]);

    for (const tileId of [
      'staging-incoming-tile-incoming-FirstLeft-0-3',
      'staging-incoming-tile-incoming-FirstLeft-1-14',
      'staging-incoming-tile-incoming-FirstLeft-2-20',
    ]) {
      const incomingTile = screen.getByTestId(tileId);
      await user.click(incomingTile);
      await user.click(incomingTile);
    }

    expect(getRackTileCount()).toBe(gameStates.charlestonFirstLeft.players[1].tile_count + 3);
  });

  test('computes CommitCharlestonPass from selected hand tiles plus remaining staged incoming', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.charlestonFirstLeft} ws={mockWs} />
    );

    await stageBlindIncoming([3, 14]);

    const firstIncoming = screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-0-3');
    await user.click(firstIncoming);
    expect(firstIncoming).not.toHaveClass('tile-face-down');
    expect(screen.getByTestId('staging-incoming-badge-incoming-FirstLeft-0-3')).toHaveTextContent(
      'PEEK'
    );

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

  test('commits with forward_incoming_count 0 after absorbing all incoming tiles', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.charlestonFirstLeft} ws={mockWs} />
    );

    await stageBlindIncoming([3, 14, 20]);

    for (const tileId of [
      'staging-incoming-tile-incoming-FirstLeft-0-3',
      'staging-incoming-tile-incoming-FirstLeft-1-14',
      'staging-incoming-tile-incoming-FirstLeft-2-20',
    ]) {
      const incomingTile = screen.getByTestId(tileId);
      await user.click(incomingTile);
      await user.click(incomingTile);
    }

    await user.click(getTileByValue(10));
    await user.click(getTileByValue(13));
    await user.click(getTileByValue(17));
    expect(screen.getByTestId('staging-pass-button')).toBeEnabled();

    await user.click(screen.getByTestId('staging-pass-button'));

    const expectedCommand: GameCommand = {
      CommitCharlestonPass: {
        player: 'South',
        from_hand: [10, 13, 17],
        forward_incoming_count: 0,
      },
    };

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
    );
  });

  test('commits with forward_incoming_count 2 after absorbing one incoming tile', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.charlestonFirstLeft} ws={mockWs} />
    );

    await stageBlindIncoming([3, 14, 20]);

    const firstIncoming = screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-0-3');
    await user.click(firstIncoming);
    await user.click(firstIncoming);

    await user.click(getTileByValue(10));
    expect(screen.getByTestId('staging-pass-button')).toBeEnabled();

    await user.click(screen.getByTestId('staging-pass-button'));

    const expectedCommand: GameCommand = {
      CommitCharlestonPass: {
        player: 'South',
        from_hand: [10],
        forward_incoming_count: 2,
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

  test('preserves staged blind tiles when the phase advances to voting', async () => {
    renderWithProviders(<GameBoard initialState={gameStates.charlestonFirstLeft} ws={mockWs} />);

    await stageBlindIncoming([3, 14]);

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

    expect(screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-0-3')).toBeInTheDocument();
    expect(screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-1-14')).toBeInTheDocument();
    expect(screen.getByTestId('vote-panel')).toBeInTheDocument();
    expect(screen.getByTestId('staging-pass-button')).toBeDisabled();
  });
});
