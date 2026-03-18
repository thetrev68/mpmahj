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
    expect(screen.queryByTestId('staging-pass-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('proceed-button')).toBeDisabled();
    expect(screen.getByTestId('declare-mahjong-button')).toBeInTheDocument();
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

    await user.click(getTileByValue(10));

    for (const tileId of [
      'staging-incoming-tile-incoming-FirstLeft-0-3',
      'staging-incoming-tile-incoming-FirstLeft-1-14',
      'staging-incoming-tile-incoming-FirstLeft-2-20',
    ]) {
      await user.click(screen.getByTestId(tileId));
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
    expect(firstIncoming).toHaveClass('tile-face-down');

    await user.click(getTileByValue(10));
    await user.click(firstIncoming);
    expect(
      screen.queryByTestId('staging-incoming-tile-incoming-FirstLeft-0-3')
    ).not.toBeInTheDocument();

    await user.click(getTileByValue(13));
    expect(screen.getByTestId('proceed-button')).toBeEnabled();

    await user.click(screen.getByTestId('proceed-button'));

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

    await user.click(getTileByValue(10));

    for (const tileId of [
      'staging-incoming-tile-incoming-FirstLeft-0-3',
      'staging-incoming-tile-incoming-FirstLeft-1-14',
      'staging-incoming-tile-incoming-FirstLeft-2-20',
    ]) {
      await user.click(screen.getByTestId(tileId));
    }

    await user.click(getTileByValue(13));
    await user.click(getTileByValue(17));
    expect(screen.getByTestId('proceed-button')).toBeEnabled();

    await user.click(screen.getByTestId('proceed-button'));

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
    await user.click(getTileByValue(10));
    await user.click(firstIncoming);
    expect(screen.getByTestId('proceed-button')).toBeEnabled();

    await user.click(screen.getByTestId('proceed-button'));

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
    expect(screen.queryByTestId('staging-pass-button')).not.toBeInTheDocument();
  });

  test('EC-1: non-East player rack shows 13 tiles at the start of blind-pass selection', () => {
    renderWithProviders(<GameBoard initialState={gameStates.charlestonFirstLeft} ws={mockWs} />);

    // your_seat=South; South starts with 13 tiles (non-East invariant)
    expect(getRackTileCount()).toBe(13);
  });

  test('EC-1: East player rack shows 14 tiles at the start of blind-pass selection', () => {
    renderWithProviders(
      <GameBoard initialState={gameStates.charlestonFirstLeftEast} ws={mockWs} />
    );

    // your_seat=East; East starts with 14 tiles (East invariant)
    expect(getRackTileCount()).toBe(14);
  });

  test('does not reveal a blind incoming tile before any rack tile is staged', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.charlestonFirstLeft} ws={mockWs} />
    );

    await stageBlindIncoming([3]);

    const firstIncoming = screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-0-3');
    await user.click(firstIncoming);

    expect(screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-0-3')).toBeInTheDocument();
    expect(firstIncoming).toHaveClass('tile-face-down');
    expect(getRackTileCount()).toBe(gameStates.charlestonFirstLeft.players[1].tile_count);
  });

  test('AC-13: FirstAcross → FirstLeft: TilesReceived absorbs to rack before blind staging', async () => {
    // US-058 AC-1 + AC-13: the server emits TilesReceived (not IncomingTilesStaged) for
    // the FirstAcross exchange. Those tiles arrive directly into the rack, bringing it back
    // to full count. Only after the stage changes to FirstLeft does IncomingTilesStaged
    // arrive (from: null) to present the 3 blind candidates.
    renderWithProviders(<GameBoard initialState={gameStates.charlestonFirstAcross} ws={mockWs} />);

    const initialRackCount = gameStates.charlestonFirstAcross.players[1].tile_count;

    // Server delivers FirstAcross exchange as TilesReceived (ordinary pass).
    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({
          kind: 'Event',
          payload: {
            event: {
              Private: { TilesReceived: { player: 'South', tiles: [0, 1, 3], from: 'North' } },
            },
          },
        })
      );
    });

    // Rack absorbs 3 tiles directly.
    await waitFor(() => {
      expect(getRackTileCount()).toBe(initialRackCount + 3);
    });

    // Stage advances to FirstLeft.
    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({
          kind: 'Event',
          payload: { event: { Public: { CharlestonPhaseChanged: { stage: 'FirstLeft' } } } },
        })
      );
    });

    // Blind staging arrives (from: null = face-down).
    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({
          kind: 'Event',
          payload: {
            event: {
              Private: {
                IncomingTilesStaged: {
                  player: 'South',
                  tiles: [5, 6, 7],
                  from: null,
                  context: 'Charleston',
                },
              },
            },
          },
        })
      );
    });

    // Rack count is the server hand count. The 3 blind tiles are in staging, NOT rack.
    expect(getRackTileCount()).toBe(initialRackCount + 3);

    // Staging strip shows 3 blind face-down tiles only (AC-11: no 6-tile combined state).
    expect(screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-0-5')).toBeInTheDocument();
    expect(screen.getByTestId('staging-incoming-tile-incoming-FirstLeft-0-5')).toHaveClass(
      'tile-face-down'
    );
    const stagingSlots = screen
      .getByTestId('staging-strip')
      .querySelectorAll('[data-testid^="staging-incoming-tile-"]:not([data-testid*="-wrapper-"])');
    expect(stagingSlots.length).toBe(3);
  });
});
