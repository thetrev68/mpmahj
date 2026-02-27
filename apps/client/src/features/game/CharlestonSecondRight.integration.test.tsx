/**
 * Integration Tests for VR-006: Charleston Second Right staging strip
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

describe('VR-006: Charleston Second Right staging strip (blind)', () => {
  let mockWs: ReturnType<typeof createMockWebSocket>;

  // Fixture: your_seat='South', your_hand=[2,5,8,11,14,15,20,23,24,27,29,33,42]
  // Tiles 0, 1, 3 are not in hand — safe to use as incoming staged tiles.
  // Tile 42 is the Joker and cannot be selected for passing.

  const getTileByValue = (value: number) => screen.getAllByTestId(new RegExp(`^tile-${value}-`))[0];

  beforeEach(() => {
    mockWs = createMockWebSocket();
    vi.clearAllMocks();
  });

  test('renders staging strip and not the legacy blind panel', () => {
    renderWithProviders(<GameBoard initialState={gameStates.charlestonSecondRight} ws={mockWs} />);

    expect(screen.getByTestId('staging-strip')).toBeInTheDocument();
    expect(screen.queryByTestId('blind-pass-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('staging-pass-button')).toBeDisabled();
  });

  test('stages blind incoming tiles face-down when IncomingTilesStaged arrives', async () => {
    renderWithProviders(<GameBoard initialState={gameStates.charlestonSecondRight} ws={mockWs} />);

    const stagedEvent: PrivateEvent = {
      IncomingTilesStaged: {
        player: 'South',
        tiles: [0, 1],
        from: null,
        context: 'Charleston',
      },
    };

    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({ kind: 'Event', payload: { event: { Private: stagedEvent } } })
      );
    });

    // Tiles should appear face-down in the incoming lane with SecondRight stage IDs
    const tile0 = screen.getByTestId('staging-incoming-tile-incoming-SecondRight-0-0');
    const tile1 = screen.getByTestId('staging-incoming-tile-incoming-SecondRight-1-1');
    expect(tile0).toHaveClass('tile-face-down');
    expect(tile1).toHaveClass('tile-face-down');
  });

  test('computes CommitCharlestonPass from selected hand tiles plus remaining staged incoming', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.charlestonSecondRight} ws={mockWs} />
    );

    // Stage 2 blind incoming tiles
    const stagedEvent: PrivateEvent = {
      IncomingTilesStaged: {
        player: 'South',
        tiles: [0, 1],
        from: null,
        context: 'Charleston',
      },
    };

    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({ kind: 'Event', payload: { event: { Private: stagedEvent } } })
      );
    });

    // Flip tile 0 to reveal it, then absorb it into hand
    const firstIncoming = screen.getByTestId('staging-incoming-tile-incoming-SecondRight-0-0');
    await user.click(firstIncoming); // flip — now revealed
    expect(firstIncoming).not.toHaveClass('tile-face-down');

    await user.click(firstIncoming); // absorb — removes from staging lane
    expect(
      screen.queryByTestId('staging-incoming-tile-incoming-SecondRight-0-0')
    ).not.toBeInTheDocument();

    // Select 2 tiles from hand (need 2 + 1 remaining staged = 3 total)
    await user.click(getTileByValue(11));
    await user.click(getTileByValue(20));
    expect(screen.getByTestId('staging-pass-button')).toBeEnabled();

    await user.click(screen.getByTestId('staging-pass-button'));

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

  test('resets staged blind tiles when the phase advances to CourtesyAcross', async () => {
    renderWithProviders(<GameBoard initialState={gameStates.charlestonSecondRight} ws={mockWs} />);

    const stagedEvent: PrivateEvent = {
      IncomingTilesStaged: {
        player: 'South',
        tiles: [0, 1],
        from: null,
        context: 'Charleston',
      },
    };

    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({ kind: 'Event', payload: { event: { Private: stagedEvent } } })
      );
    });

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

    // Staged tiles must be cleared after stage transition
    expect(
      screen.queryByTestId('staging-incoming-tile-incoming-SecondRight-0-0')
    ).not.toBeInTheDocument();
    expect(screen.getByTestId('staging-pass-button')).toBeDisabled();
  });
});
