/**
 * Integration Tests for VR-010: Charleston Second Right blind incoming behavior
 *
 * SecondRight is the second blind stage in Charleston (per NMJL rules).
 * Verifies that the shared staging strip — not a legacy panel — handles
 * blind pass staging here exactly as it does for FirstLeft.
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

describe('VR-010: Charleston Second Right blind incoming behavior', () => {
  let mockWs: ReturnType<typeof createMockWebSocket>;

  // Fixture: your_seat='South', your_hand=[2,5,8,11,14,15,20,23,24,27,29,33,42]
  // Tiles 0, 1, 3 are not in hand — safe to use as incoming staged tiles.
  // Tile 42 is the Joker and cannot be selected for passing.

  const getTileByValue = (value: number) => screen.getAllByTestId(new RegExp(`^tile-${value}-`))[0];
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

  test('renders staging strip and not the legacy blind panel', () => {
    renderWithProviders(<GameBoard initialState={gameStates.charlestonSecondRight} ws={mockWs} />);

    expect(screen.getByTestId('staging-strip')).toBeInTheDocument();
    expect(screen.queryByTestId('blind-pass-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('staging-pass-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('proceed-button')).toBeDisabled();
    expect(screen.getByTestId('declare-mahjong-button')).toBeInTheDocument();
  });

  test('stages blind incoming tiles face-down when IncomingTilesStaged arrives', async () => {
    renderWithProviders(<GameBoard initialState={gameStates.charlestonSecondRight} ws={mockWs} />);

    await stageBlindIncoming([0, 1]);

    // Tiles should appear face-down in the incoming lane with SecondRight stage IDs
    const tile0 = screen.getByTestId('staging-incoming-tile-incoming-SecondRight-0-0');
    const tile1 = screen.getByTestId('staging-incoming-tile-incoming-SecondRight-1-1');
    expect(tile0).toHaveClass('tile-face-down');
    expect(tile1).toHaveClass('tile-face-down');
    expect(screen.getByTestId('staging-incoming-badge-incoming-SecondRight-0-0')).toHaveTextContent(
      'BLIND'
    );
    expect(screen.getByTestId('staging-incoming-badge-incoming-SecondRight-1-1')).toHaveTextContent(
      'BLIND'
    );
  });

  test('computes CommitCharlestonPass from selected hand tiles plus remaining staged incoming', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.charlestonSecondRight} ws={mockWs} />
    );

    // Stage 2 blind incoming tiles
    await stageBlindIncoming([0, 1]);

    const firstIncoming = screen.getByTestId('staging-incoming-tile-incoming-SecondRight-0-0');
    await user.click(getTileByValue(11));
    await user.click(firstIncoming);
    expect(
      screen.queryByTestId('staging-incoming-tile-incoming-SecondRight-0-0')
    ).not.toBeInTheDocument();

    await user.click(getTileByValue(20));
    expect(screen.getByTestId('proceed-button')).toBeEnabled();

    await user.click(screen.getByTestId('proceed-button'));

    const expectedCommand: GameCommand = {
      CommitCharlestonPass: {
        player: 'South',
        from_hand: [11, 20],
        forward_incoming_count: 1,
      },
    };

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
    );
  });

  test('keeps submission on the action bar while the staging strip stays lane-only', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.charlestonSecondRight} ws={mockWs} />
    );

    await stageBlindIncoming([0, 1]);

    const firstIncoming = screen.getByTestId('staging-incoming-tile-incoming-SecondRight-0-0');
    await user.click(getTileByValue(11));
    await user.click(firstIncoming);
    await user.click(getTileByValue(20));

    expect(screen.queryByTestId('staging-pass-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('proceed-button')).toBeInTheDocument();
    expect(screen.getByTestId('proceed-button')).toBeEnabled();
  });

  test('commits with forward_incoming_count 0 after absorbing all incoming tiles', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.charlestonSecondRight} ws={mockWs} />
    );

    await stageBlindIncoming([0, 1, 3]);

    await user.click(getTileByValue(11));

    for (const tileId of [
      'staging-incoming-tile-incoming-SecondRight-0-0',
      'staging-incoming-tile-incoming-SecondRight-1-1',
      'staging-incoming-tile-incoming-SecondRight-2-3',
    ]) {
      await user.click(screen.getByTestId(tileId));
    }

    await user.click(getTileByValue(20));
    await user.click(getTileByValue(23));
    expect(screen.getByTestId('proceed-button')).toBeEnabled();

    await user.click(screen.getByTestId('proceed-button'));

    const expectedCommand: GameCommand = {
      CommitCharlestonPass: {
        player: 'South',
        from_hand: [11, 20, 23],
        forward_incoming_count: 0,
      },
    };

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
    );
  });

  test('commits with forward_incoming_count 2 after absorbing one incoming tile', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.charlestonSecondRight} ws={mockWs} />
    );

    await stageBlindIncoming([0, 1, 3]);

    const firstIncoming = screen.getByTestId('staging-incoming-tile-incoming-SecondRight-0-0');
    await user.click(getTileByValue(11));
    await user.click(firstIncoming);
    expect(screen.getByTestId('proceed-button')).toBeEnabled();

    await user.click(screen.getByTestId('proceed-button'));

    const expectedCommand: GameCommand = {
      CommitCharlestonPass: {
        player: 'South',
        from_hand: [11],
        forward_incoming_count: 2,
      },
    };

    expect(mockWs.send).toHaveBeenCalledWith(
      JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
    );
  });

  test('shows pass animation layer with Right direction', async () => {
    renderWithProviders(<GameBoard initialState={gameStates.charlestonSecondRight} ws={mockWs} />);

    const tilesPassingEvent: PublicEvent = {
      TilesPassing: { direction: 'Right' },
    };
    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({ kind: 'Event', payload: { event: { Public: tilesPassingEvent } } })
      );
    });

    expect(screen.getByTestId('pass-animation-layer')).toBeInTheDocument();
    expect(screen.getByTestId('pass-animation-layer')).toHaveTextContent(/Passing Right/);
  });

  test('preserves staged blind tiles when the phase advances to CourtesyAcross', async () => {
    renderWithProviders(<GameBoard initialState={gameStates.charlestonSecondRight} ws={mockWs} />);

    await stageBlindIncoming([0, 1]);

    // Advance phase to CourtesyAcross
    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({
          kind: 'Event',
          payload: {
            event: { Public: { CharlestonPhaseChanged: { stage: 'CourtesyAcross' } } },
          },
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/courtesy/i);
    });

    // Staged tiles must remain available to forward into the new stage
    expect(
      screen.getByTestId('staging-incoming-tile-incoming-SecondRight-0-0')
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('staging-incoming-tile-incoming-SecondRight-1-1')
    ).toBeInTheDocument();
    expect(screen.queryByTestId('staging-pass-button')).not.toBeInTheDocument();
  });

  test('does not reveal a blind incoming tile before any rack tile is staged', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.charlestonSecondRight} ws={mockWs} />
    );

    await stageBlindIncoming([0]);

    const firstIncoming = screen.getByTestId('staging-incoming-tile-incoming-SecondRight-0-0');
    await user.click(firstIncoming);

    expect(
      screen.getByTestId('staging-incoming-tile-incoming-SecondRight-0-0')
    ).toBeInTheDocument();
    expect(firstIncoming).toHaveClass('tile-face-down');
  });
});
