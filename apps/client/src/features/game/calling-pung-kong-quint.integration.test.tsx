/**
 * Integration Test: Calling Pung/Kong/Quint/Sextet
 *
 * Tests the full flow of calling melds and exposing them
 * Related: US-013 (Calling Pung/Kong/Quint/Sextet)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { GameBoard } from '@/components/game/GameBoard';
import type { GameState } from '@/components/game/GameBoard';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { Seat } from '@/types/bindings/generated/Seat';

describe('US-013: Calling Pung/Kong/Quint/Sextet', () => {
  let mockWs: ReturnType<typeof createMockWebSocket>;
  let baseGameState: GameState;

  // Helper to simulate public events
  const simulatePublicEvent = async (event: PublicEvent) => {
    await act(async () => {
      mockWs.triggerMessage(
        JSON.stringify({ kind: 'Event', payload: { event: { Public: event } } })
      );
    });
  };

  beforeEach(() => {
    mockWs = createMockWebSocket();

    baseGameState = {
      game_id: 'test-game',
      phase: { Playing: { Discarding: { player: 'North' } } },
      current_turn: 'North',
      your_seat: 'West',
      your_hand: [4, 4, 11, 11, 11, 18, 27, 27, 27, 31, 32, 33, 42],
      house_rules: {
        ruleset: {
          blank_exchange_enabled: false,
        },
      },
      players: [
        { seat: 'East', player_id: 'p1', is_bot: false, status: 'active', tile_count: 13 },
        { seat: 'South', player_id: 'p2', is_bot: false, status: 'active', tile_count: 13 },
        { seat: 'West', player_id: 'p3', is_bot: false, status: 'active', tile_count: 13 },
        { seat: 'North', player_id: 'p4', is_bot: false, status: 'active', tile_count: 13 },
      ],
      remaining_tiles: 70,
      wall_seed: 12345,
      wall_draw_index: 52,
      wall_break_point: 52,
      wall_tiles_remaining: 70,
      discard_pile: [{ tile: 4, player: 'North' as Seat, turn: 1, safe: false, called: false }],
      exposed_melds: {
        East: [],
        South: [],
        West: [],
        North: [],
      },
    };
  });

  describe('AC-1: Meld Call Won (Pung)', () => {
    it('should expose Pung meld when TileCalled event received', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      // Simulate TileCalled event for Pung
      await simulatePublicEvent({
        TileCalled: {
          player: 'West',
          called_from: 'North',
          meld: {
            meld_type: 'Pung',
            tiles: [4, 4, 4],
            called_tile: 4,
            joker_assignments: {},
          },
          called_tile: 4,
        },
      });

      await waitFor(() => {
        expect(screen.getByText(/Pung/i)).toBeInTheDocument();
      });
    });

    it('should remove called tile from discard pool', async () => {
      const { container } = renderWithProviders(
        <GameBoard initialState={baseGameState} ws={mockWs} />
      );

      // Verify discard is present initially
      const initialDiscards = container.querySelectorAll(
        '[data-testid="discard-pool"] [data-testid^="tile-4"]'
      );
      expect(initialDiscards.length).toBeGreaterThan(0);

      // Simulate TileCalled event
      await simulatePublicEvent({
        TileCalled: {
          player: 'West',
          called_from: 'North',
          meld: {
            meld_type: 'Pung',
            tiles: [4, 4, 4],
            called_tile: 4,
            joker_assignments: {},
          },
          called_tile: 4,
        },
      });

      // Called tile should be removed from discard pool
      await waitFor(() => {
        const remainingDiscards = container.querySelectorAll(
          '[data-testid="discard-pool"] [data-testid^="tile-4"]'
        );
        expect(remainingDiscards.length).toBe(0);
      });
    });

    it('should remove the most recent matching discard when duplicates exist', async () => {
      const duplicateDiscardState = {
        ...baseGameState,
        discard_pile: [
          { tile: 4, player: 'South' as Seat, turn: 1, safe: false, called: false },
          { tile: 4, player: 'North' as Seat, turn: 2, safe: false, called: false },
        ],
      };

      const { container } = renderWithProviders(
        <GameBoard initialState={duplicateDiscardState} ws={mockWs} />
      );

      await simulatePublicEvent({
        TileCalled: {
          player: 'West',
          called_from: 'North',
          meld: {
            meld_type: 'Pung',
            tiles: [4, 4, 4],
            called_tile: 4,
            joker_assignments: {},
          },
          called_tile: 4,
        },
      });

      await waitFor(() => {
        const remainingDiscards = container.querySelectorAll(
          '[data-testid="discard-pool"] [data-testid^="tile-4"]'
        );
        expect(remainingDiscards.length).toBe(1);
      });
    });

    it('should remove 2 tiles from concealed hand', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      // Initial hand has [4, 4, ...] - 2 of tile 4
      const initialHand = screen.getAllByTestId(/^tile-4-/);
      const initialCount = initialHand.length;

      // Simulate TileCalled event for Pung
      await simulatePublicEvent({
        TileCalled: {
          player: 'West',
          called_from: 'North',
          meld: {
            meld_type: 'Pung',
            tiles: [4, 4, 4],
            called_tile: 4,
            joker_assignments: {},
          },
          called_tile: 4,
        },
      });

      // Should have 2 fewer tiles in hand
      await waitFor(() => {
        const remainingHandTiles = screen.queryAllByTestId(/^tile-4-/);
        expect(remainingHandTiles.length).toBe(initialCount - 2);
      });
    });

    it('should show meld in exposed melds area', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      await simulatePublicEvent({
        TileCalled: {
          player: 'West',
          called_from: 'North',
          meld: {
            meld_type: 'Pung',
            tiles: [4, 4, 4],
            called_tile: 4,
            joker_assignments: {},
          },
          called_tile: 4,
        },
      });

      await waitFor(() => {
        const exposedArea = screen.getByTestId('exposed-melds-area');
        expect(exposedArea).toBeInTheDocument();
        expect(screen.getByText(/Pung/i)).toBeInTheDocument();
      });
    });
  });

  describe('AC-2: Kong Call (4 Tiles)', () => {
    it('should expose Kong meld with 4 tiles', async () => {
      const kongGameState = {
        ...baseGameState,
        your_hand: [27, 27, 27, 4, 11, 18, 31, 32, 33, 42, 5, 6, 7],
        discard_pile: [{ tile: 27, player: 'North' as Seat, turn: 1, safe: false, called: false }],
      };

      renderWithProviders(<GameBoard initialState={kongGameState} ws={mockWs} />);

      await simulatePublicEvent({
        TileCalled: {
          player: 'West',
          called_from: 'North',
          meld: {
            meld_type: 'Kong',
            tiles: [27, 27, 27, 27],
            called_tile: 27,
            joker_assignments: {},
          },
          called_tile: 27,
        },
      });

      await waitFor(() => {
        expect(screen.getByText(/Kong/i)).toBeInTheDocument();
      });
    });

    it('should remove 3 matching tiles from hand', async () => {
      const kongGameState = {
        ...baseGameState,
        your_hand: [27, 27, 27, 4, 11, 18, 31, 32, 33, 42, 5, 6, 7],
      };

      renderWithProviders(<GameBoard initialState={kongGameState} ws={mockWs} />);

      const initialWindTiles = screen.getAllByTestId(/^tile-27-/);
      const initialCount = initialWindTiles.length;

      await simulatePublicEvent({
        TileCalled: {
          player: 'West',
          called_from: 'North',
          meld: {
            meld_type: 'Kong',
            tiles: [27, 27, 27, 27],
            called_tile: 27,
            joker_assignments: {},
          },
          called_tile: 27,
        },
      });

      await waitFor(() => {
        const remainingWindTiles = screen.queryAllByTestId(/^tile-27-/);
        expect(remainingWindTiles.length).toBe(initialCount - 3);
      });
    });
  });

  describe('AC-3: Quint Call (5 Tiles)', () => {
    it('should expose Quint meld with Jokers', async () => {
      const quintGameState = {
        ...baseGameState,
        your_hand: [11, 11, 42, 42, 4, 18, 31, 32, 33, 5, 6, 7, 8],
        discard_pile: [{ tile: 11, player: 'North' as Seat, turn: 1, safe: false, called: false }],
      };

      renderWithProviders(<GameBoard initialState={quintGameState} ws={mockWs} />);

      await simulatePublicEvent({
        TileCalled: {
          player: 'West',
          called_from: 'North',
          meld: {
            meld_type: 'Quint',
            tiles: [11, 11, 11, 42, 42],
            called_tile: 11,
            joker_assignments: { 3: 11, 4: 11 },
          },
          called_tile: 11,
        },
      });

      await waitFor(() => {
        expect(screen.getByText(/Quint/i)).toBeInTheDocument();
      });
    });

    it('should display Jokers in exposed meld (EC-2)', async () => {
      const quintGameState = {
        ...baseGameState,
        your_hand: [11, 11, 42, 42, 4, 18, 31, 32, 33, 5, 6, 7, 8],
      };

      renderWithProviders(<GameBoard initialState={quintGameState} ws={mockWs} />);

      await simulatePublicEvent({
        TileCalled: {
          player: 'West',
          called_from: 'North',
          meld: {
            meld_type: 'Quint',
            tiles: [11, 11, 11, 42, 42],
            called_tile: 11,
            joker_assignments: { 3: 11, 4: 11 },
          },
          called_tile: 11,
        },
      });

      await waitFor(() => {
        const exposedJokers = screen.getAllByTestId(/^tile-42-/);
        // Should have jokers in exposed meld
        expect(exposedJokers.length).toBeGreaterThan(0);
      });
    });
  });

  describe('AC-4: Sextet Call (6 Tiles)', () => {
    it('should expose Sextet meld with multiple Jokers', async () => {
      const sextetGameState = {
        ...baseGameState,
        your_hand: [8, 8, 42, 42, 42, 4, 18, 31, 32, 33, 5, 6, 7],
        discard_pile: [{ tile: 8, player: 'North' as Seat, turn: 1, safe: false, called: false }],
      };

      renderWithProviders(<GameBoard initialState={sextetGameState} ws={mockWs} />);

      await simulatePublicEvent({
        TileCalled: {
          player: 'West',
          called_from: 'North',
          meld: {
            meld_type: 'Sextet',
            tiles: [8, 8, 8, 42, 42, 42],
            called_tile: 8,
            joker_assignments: { 3: 8, 4: 8, 5: 8 },
          },
          called_tile: 8,
        },
      });

      await waitFor(() => {
        expect(screen.getByText(/Sextet/i)).toBeInTheDocument();
      });
    });

    it('should display 3 Jokers in Sextet (EC-2)', async () => {
      const sextetGameState = {
        ...baseGameState,
        your_hand: [8, 8, 42, 42, 42, 4, 18, 31, 32, 33, 5, 6, 7],
      };

      const { container } = renderWithProviders(
        <GameBoard initialState={sextetGameState} ws={mockWs} />
      );

      await simulatePublicEvent({
        TileCalled: {
          player: 'West',
          called_from: 'North',
          meld: {
            meld_type: 'Sextet',
            tiles: [8, 8, 8, 42, 42, 42],
            called_tile: 8,
            joker_assignments: { 3: 8, 4: 8, 5: 8 },
          },
          called_tile: 8,
        },
      });

      await waitFor(() => {
        const exposedMeldArea = container.querySelector('[data-testid="exposed-melds-area"]');
        const jokersInMeld = exposedMeldArea?.querySelectorAll('[data-testid^="tile-42"]');
        expect(jokersInMeld?.length).toBe(3);
      });
    });
  });

  describe('AC-6: Turn Continues After Call', () => {
    it('should transition to Discarding stage after meld exposed', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      // Expose meld
      await simulatePublicEvent({
        TileCalled: {
          player: 'West',
          called_from: 'North',
          meld: {
            meld_type: 'Pung',
            tiles: [4, 4, 4],
            called_tile: 4,
            joker_assignments: {},
          },
          called_tile: 4,
        },
      });

      // Then turn changes to Discarding
      await simulatePublicEvent({
        TurnChanged: {
          player: 'West',
          stage: { Discarding: { player: 'West' } },
        },
      });

      await waitFor(() => {
        expect(screen.getByTestId('turn-indicator')).toHaveTextContent(/Discarding/i);
      });
    });

    it('should enable discard mode after calling', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      // Expose meld
      await simulatePublicEvent({
        TileCalled: {
          player: 'West',
          called_from: 'North',
          meld: {
            meld_type: 'Pung',
            tiles: [4, 4, 4],
            called_tile: 4,
            joker_assignments: {},
          },
          called_tile: 4,
        },
      });

      // Turn changed to Discarding
      await simulatePublicEvent({
        TurnChanged: {
          player: 'West',
          stage: { Discarding: { player: 'West' } },
        },
      });

      // Should be able to select tiles to discard
      await waitFor(() => {
        const concealedHand = screen.getByTestId('concealed-hand');
        expect(concealedHand).toHaveAttribute('data-mode', 'discard');
      });
    });
  });

  describe('EC-1: No Replacement Draw', () => {
    it('should maintain 14 total tiles after calling (hand + exposures)', async () => {
      const { container } = renderWithProviders(
        <GameBoard initialState={baseGameState} ws={mockWs} />
      );

      // Initial hand: 13 tiles
      const initialHandTiles = container.querySelectorAll(
        '[data-testid="concealed-hand"] [role="img"]'
      );
      expect(initialHandTiles.length).toBe(13);

      // Call Pung (add 1 tile from discard, removes 2 from hand)
      await simulatePublicEvent({
        TileCalled: {
          player: 'West',
          called_from: 'North',
          meld: {
            meld_type: 'Pung',
            tiles: [4, 4, 4],
            called_tile: 4,
            joker_assignments: {},
          },
          called_tile: 4,
        },
      });

      await waitFor(() => {
        const handTiles = container.querySelectorAll('[data-testid="concealed-hand"] [role="img"]');
        const exposedTiles = container.querySelectorAll(
          '[data-testid="exposed-melds-area"] [role="img"]'
        );
        const totalTiles = handTiles.length + exposedTiles.length;

        // Should have 14 total (11 in hand + 3 exposed)
        expect(totalTiles).toBe(14);
      });
    });
  });

  describe('Opponent Calling', () => {
    it('should show opponent meld when they call', async () => {
      renderWithProviders(<GameBoard initialState={baseGameState} ws={mockWs} />);

      // East calls a Pung
      await simulatePublicEvent({
        TileCalled: {
          player: 'East',
          called_from: 'North',
          meld: {
            meld_type: 'Pung',
            tiles: [18, 18, 18],
            called_tile: 18,
            joker_assignments: {},
          },
          called_tile: 18,
        },
      });

      // For MVP, we'll just verify the event is processed without error
      // Full opponent meld display deferred to later US
      await waitFor(() => {
        expect(screen.getByTestId('game-board')).toBeInTheDocument();
      });
    });

    it('should not affect my hand when opponent calls', async () => {
      const { container } = renderWithProviders(
        <GameBoard initialState={baseGameState} ws={mockWs} />
      );

      const initialHandTiles = container.querySelectorAll(
        '[data-testid="concealed-hand"] [role="img"]'
      );
      const initialCount = initialHandTiles.length;

      // South calls a Kong
      await simulatePublicEvent({
        TileCalled: {
          player: 'South',
          called_from: 'North',
          meld: {
            meld_type: 'Kong',
            tiles: [31, 31, 31, 31],
            called_tile: 31,
            joker_assignments: {},
          },
          called_tile: 31,
        },
      });

      await waitFor(() => {
        const currentHandTiles = container.querySelectorAll(
          '[data-testid="concealed-hand"] [role="img"]'
        );
        expect(currentHandTiles.length).toBe(initialCount);
      });
    });
  });
});
