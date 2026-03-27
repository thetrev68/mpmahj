/**
 * Integration Tests: Charleston Standard Pass (FirstRight & FirstAcross)
 *
 * CL-1: Consolidated from separate CharlestonFirstRight and CharlestonFirstAcross
 * test files. Both stages use identical mechanics (select 3, submit, receive).
 * Parameterized describe.each covers shared flow; FirstRight-specific edge cases
 * (Joker blocking, over-selection, deselection, double-submit) remain standalone.
 *
 * IMPORTANT: Command/event shapes match backend bindings (source of truth).
 */

import { describe, expect, test, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { gameStates } from '@/test/fixtures';
import { GameBoard } from '@/components/game/GameBoard';
import { TILE_INDICES } from '@/lib/utils/tileUtils';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { PrivateEvent } from '@/types/bindings/generated/PrivateEvent';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { PassDirection } from '@/types/bindings/generated/PassDirection';
import type { Seat } from '@/types/bindings/generated/Seat';

// ─── Parameterized standard pass stages ─────────────────────────────────────

interface StandardPassConfig {
  label: string;
  fixtureKey: 'charlestonFirstRight' | 'charlestonFirstAcross';
  directionPattern: RegExp;
  tiles: [number, number, number];
  receivedFrom: Seat;
  nextStage: CharlestonStage;
  nextDirectionPattern: RegExp;
  passingDirection: PassDirection;
}

const STANDARD_PASS_STAGES: StandardPassConfig[] = [
  {
    label: 'FirstRight',
    fixtureKey: 'charlestonFirstRight',
    directionPattern: /right/i,
    tiles: [0, 1, 2],
    receivedFrom: 'West',
    nextStage: 'FirstAcross',
    nextDirectionPattern: /across/i,
    passingDirection: 'Right',
  },
  {
    label: 'FirstAcross',
    fixtureKey: 'charlestonFirstAcross',
    directionPattern: /across/i,
    tiles: [1, 4, 7],
    receivedFrom: 'North',
    nextStage: 'FirstLeft',
    nextDirectionPattern: /left/i,
    passingDirection: 'Across',
  },
];

describe.each(STANDARD_PASS_STAGES)(
  'Charleston Standard Pass: $label',
  ({
    fixtureKey,
    directionPattern,
    tiles,
    receivedFrom,
    nextStage,
    nextDirectionPattern,
    passingDirection,
  }) => {
    let mockWs: ReturnType<typeof createMockWebSocket>;
    let gameState: GameStateSnapshot;

    const getTileByValue = (value: number) =>
      screen.getAllByTestId(new RegExp(`^tile-${value}-`))[0];
    const queryTileByValue = (value: number) =>
      screen.queryAllByTestId(new RegExp(`^tile-${value}-`))[0] ?? null;

    beforeEach(() => {
      mockWs = createMockWebSocket();
      gameState = gameStates[fixtureKey];
      vi.clearAllMocks();
    });

    test('displays Charleston tracker with correct direction and selection counter', () => {
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      expect(screen.getByTestId('charleston-tracker')).toBeInTheDocument();
      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(directionPattern);
      expect(screen.getByTestId('selection-counter')).toHaveTextContent('0/3');
      expect(screen.getByTestId('proceed-button')).toBeDisabled();
    });

    test('renders player hand with 13 tiles', () => {
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      expect(screen.getByTestId('player-rack')).toBeInTheDocument();
      gameState.your_hand.forEach((tile) => {
        expect(getTileByValue(tile)).toBeInTheDocument();
      });
    });

    test('allows selecting 3 tiles and enables Pass button', async () => {
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      await user.click(getTileByValue(tiles[0]));
      await user.click(getTileByValue(tiles[1]));
      await user.click(getTileByValue(tiles[2]));

      expect(screen.getByTestId('selection-counter')).toHaveTextContent('3/3');
      expect(screen.getByTestId('proceed-button')).toBeEnabled();
    });

    test('sends CommitCharlestonPass command with forward_incoming_count 0', async () => {
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      await user.click(getTileByValue(tiles[0]));
      await user.click(getTileByValue(tiles[1]));
      await user.click(getTileByValue(tiles[2]));
      await user.click(screen.getByTestId('proceed-button'));

      const expectedCommand: GameCommand = {
        CommitCharlestonPass: {
          player: 'South',
          from_hand: [...tiles],
          forward_incoming_count: 0,
        },
      };
      expect(mockWs.send).toHaveBeenCalledWith(
        JSON.stringify({ kind: 'Command', payload: { command: expectedCommand } })
      );
    });

    test('disables button after submitting pass', async () => {
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      await user.click(getTileByValue(tiles[0]));
      await user.click(getTileByValue(tiles[1]));
      await user.click(getTileByValue(tiles[2]));
      await user.click(screen.getByTestId('proceed-button'));

      expect(screen.getByTestId('proceed-button')).toBeDisabled();
    });

    test('removes tiles from hand on TilesPassed event', async () => {
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      await user.click(getTileByValue(tiles[0]));
      await user.click(getTileByValue(tiles[1]));
      await user.click(getTileByValue(tiles[2]));
      await user.click(screen.getByTestId('proceed-button'));

      const tilesPassedEvent: PrivateEvent = {
        TilesPassed: { player: 'South', tiles: [...tiles] },
      };
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({ kind: 'Event', payload: { event: { Private: tilesPassedEvent } } })
        );
      });

      await waitFor(() => {
        tiles.forEach((tile) => {
          expect(queryTileByValue(tile)).not.toBeInTheDocument();
        });
      });
    });

    test('tracks ready players via PlayerReadyForPass events', async () => {
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      const readyEvents: PublicEvent[] = [
        { PlayerReadyForPass: { player: 'East' } },
        { PlayerReadyForPass: { player: 'South' } },
        { PlayerReadyForPass: { player: 'West' } },
      ];

      for (const event of readyEvents) {
        await act(async () => {
          mockWs.triggerMessage(
            JSON.stringify({ kind: 'Event', payload: { event: { Public: event } } })
          );
        });
      }

      await waitFor(() => {
        expect(screen.getByTestId('ready-indicator-east')).toHaveTextContent('E✓');
        expect(screen.getByTestId('ready-indicator-south')).toHaveTextContent('S✓');
        expect(screen.getByTestId('ready-indicator-west')).toHaveTextContent('W✓');
        expect(screen.getByTestId('ready-indicator-north')).toHaveTextContent('N•');
      });
    });

    test('adds received tiles to hand on TilesReceived event', async () => {
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      await user.click(getTileByValue(tiles[0]));
      await user.click(getTileByValue(tiles[1]));
      await user.click(getTileByValue(tiles[2]));
      await user.click(screen.getByTestId('proceed-button'));

      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({
            kind: 'Event',
            payload: {
              event: { Private: { TilesPassed: { player: 'South', tiles: [...tiles] } } },
            },
          })
        );
      });

      const tilesReceivedEvent: PrivateEvent = {
        TilesReceived: { player: 'South', tiles: [22, 23, 24], from: receivedFrom },
      };
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({ kind: 'Event', payload: { event: { Private: tilesReceivedEvent } } })
        );
      });

      await waitFor(() => {
        expect(getTileByValue(22)).toBeInTheDocument();
        expect(getTileByValue(23)).toBeInTheDocument();
        expect(getTileByValue(24)).toBeInTheDocument();
      });
    });

    test('advances to next phase on CharlestonPhaseChanged event', async () => {
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      const phaseChangedEvent: PublicEvent = {
        CharlestonPhaseChanged: { stage: nextStage },
      };
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({ kind: 'Event', payload: { event: { Public: phaseChangedEvent } } })
        );
      });

      await waitFor(() => {
        expect(screen.getByTestId('charleston-direction')).toHaveTextContent(nextDirectionPattern);
      });
      expect(screen.getByTestId('selection-counter')).toHaveTextContent('0/3');
      expect(screen.getByTestId('proceed-button')).toBeDisabled();
    });

    test('shows bot pass status message when bot becomes ready', async () => {
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      const readyEvent: PublicEvent = { PlayerReadyForPass: { player: 'West' } };
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({ kind: 'Event', payload: { event: { Public: readyEvent } } })
        );
      });

      expect(screen.getByTestId('charleston-status-message')).toHaveTextContent(
        'West (Bot) has passed tiles.'
      );
    });

    test('shows pass animation layer with correct direction', async () => {
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      const tilesPassingEvent: PublicEvent = {
        TilesPassing: { direction: passingDirection },
      };
      await act(async () => {
        mockWs.triggerMessage(
          JSON.stringify({ kind: 'Event', payload: { event: { Public: tilesPassingEvent } } })
        );
      });

      expect(screen.getByTestId('pass-animation-layer')).toBeInTheDocument();
      expect(screen.getByTestId('pass-animation-layer')).toHaveTextContent(
        new RegExp(`Passing ${passingDirection}`)
      );
    });
  }
);

// ─── FirstRight-specific edge cases ─────────────────────────────────────────

describe('Charleston FirstRight: edge cases', () => {
  let mockWs: ReturnType<typeof createMockWebSocket>;

  const getTileByValue = (value: number) => screen.getAllByTestId(new RegExp(`^tile-${value}-`))[0];

  beforeEach(() => {
    mockWs = createMockWebSocket();
    vi.clearAllMocks();
  });

  test('shows opponent staging tile backs after PlayerStagedTile', async () => {
    renderWithProviders(<GameBoard initialState={gameStates.charlestonFirstRight} ws={mockWs} />);

    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({
          kind: 'Event',
          payload: { event: { Public: { PlayerStagedTile: { player: 'North', count: 3 } } } },
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('opponent-staging-north').children).toHaveLength(3);
    });
  });

  test('opponent staging persists after PlayerReadyForPass until TilesPassing', async () => {
    renderWithProviders(<GameBoard initialState={gameStates.charlestonFirstRight} ws={mockWs} />);

    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({
          kind: 'Event',
          payload: { event: { Public: { PlayerStagedTile: { player: 'North', count: 3 } } } },
        })
      );
    });

    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({
          kind: 'Event',
          payload: { event: { Public: { PlayerReadyForPass: { player: 'North' } } } },
        })
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('opponent-staging-north').children).toHaveLength(3);
    });
  });

  test('Joker tile shows disabled state and cannot be selected', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.charlestonFirstRight} ws={mockWs} />
    );

    const jokerTile = getTileByValue(TILE_INDICES.JOKER);
    expect(jokerTile).toHaveClass('tile-disabled');

    await user.click(jokerTile);
    expect(screen.getByTestId('selection-counter')).toHaveTextContent('0/3');
  });

  test('4th tile click does not increase selection beyond 3', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.charlestonFirstRight} ws={mockWs} />
    );

    await user.click(getTileByValue(0));
    await user.click(getTileByValue(1));
    await user.click(getTileByValue(2));
    await user.click(getTileByValue(9));

    expect(screen.getByTestId('selection-counter')).toHaveTextContent('3/3');
  });

  test('clicking selected tile deselects it', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.charlestonFirstRight} ws={mockWs} />
    );

    await user.click(getTileByValue(0));
    await user.click(getTileByValue(1));
    await user.click(getTileByValue(2));
    await user.click(getTileByValue(1)); // deselect

    expect(screen.getByTestId('selection-counter')).toHaveTextContent('2/3');
    expect(screen.getByTestId('proceed-button')).toBeDisabled();
  });

  test('only sends one CommitCharlestonPass command on rapid clicks', async () => {
    const { user } = renderWithProviders(
      <GameBoard initialState={gameStates.charlestonFirstRight} ws={mockWs} />
    );

    await user.click(getTileByValue(0));
    await user.click(getTileByValue(1));
    await user.click(getTileByValue(2));

    const passButton = screen.getByTestId('proceed-button');
    await user.click(passButton);
    await user.click(passButton);

    const sendCalls = mockWs.send.mock.calls.filter((call) => {
      const envelope = JSON.parse(call[0] as string);
      return envelope.kind === 'Command' && 'CommitCharlestonPass' in envelope.payload.command;
    });
    expect(sendCalls).toHaveLength(1);
  });
});
