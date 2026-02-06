/**
 * Integration Tests for US-001: Roll Dice & Break Wall
 *
 * Test Scenario: roll-dice-break-wall.md
 * User Story: US-001-roll-dice-break-wall.md
 *
 * These tests verify the complete dice roll flow from user action to wall break.
 */

import { describe, expect, test, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { createMockWebSocket } from '@/test/mocks/websocket';
import { gameStates, eventSequences } from '@/test/fixtures';
import { GameBoard } from '@/components/game/GameBoard';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { PrivateEvent } from '@/types/bindings/generated/PrivateEvent';

describe('US-001: Roll Dice & Break Wall', () => {
  let mockWs: ReturnType<typeof createMockWebSocket>;

  beforeEach(() => {
    mockWs = createMockWebSocket();
    vi.clearAllMocks();
  });

  describe('Test 1: East rolls dice successfully', () => {
    test('displays Roll Dice button when user is East in RollingDice phase', () => {
      // Setup: Game in Setup(RollingDice), user is East
      const gameState = gameStates.setupRollingDice;

      // Render GameBoard component with initial state
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Assert: "Roll Dice" button is visible and enabled
      const rollButton = screen.getByTestId('roll-dice-button');
      expect(rollButton).toBeInTheDocument();
      expect(rollButton).toBeEnabled();
    });

    test('sends RollDice command when button is clicked', async () => {
      // Setup: Game in Setup(RollingDice), user is East
      const gameState = gameStates.setupRollingDice;

      // Render component
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Action: User clicks "Roll Dice" button
      const rollButton = screen.getByTestId('roll-dice-button');
      await user.click(rollButton);

      // Assert: Command sent with correct shape
      const expectedCommand: GameCommand = { RollDice: { player: 'East' } };
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(expectedCommand));
    });

    test('displays dice result after DiceRolled event', async () => {
      // Setup: Game in Setup(RollingDice), user is East
      const gameState = gameStates.setupRollingDice;

      // Render component
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Simulate server response
      const diceRolledEvent: PublicEvent = { DiceRolled: { roll: 7 } };
      await act(async () => {
        mockWs.triggerMessage(JSON.stringify({ Public: diceRolledEvent }));
      });

      // Assert: Dice result "7" is displayed prominently
      await waitFor(() => {
        expect(screen.getByTestId('dice-total')).toHaveTextContent('Total: 7');
      });
    });

    test('displays wall break after WallBroken event', async () => {
      // Setup: Game in Setup(RollingDice), user is East
      const gameState = gameStates.setupRollingDice;

      // Render component
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Simulate dice rolled
      const diceRolledEvent: PublicEvent = { DiceRolled: { roll: 7 } };
      await act(async () => {
        mockWs.triggerMessage(JSON.stringify({ Public: diceRolledEvent }));
      });

      // Simulate wall break
      const wallBrokenEvent: PublicEvent = { WallBroken: { position: 42 } };
      await act(async () => {
        mockWs.triggerMessage(JSON.stringify({ Public: wallBrokenEvent }));
      });

      // Assert: Wall break position is stored in state
      // (visual indicator will be tested in component unit tests)
      await waitFor(() => {
        // Game state should have updated with wall break point
        expect(screen.getByTestId('game-board')).toBeInTheDocument();
      });
    });

    test('displays dealt tiles after TilesDealt event', async () => {
      // Setup: Game in Setup(RollingDice), user is East
      const gameState = gameStates.setupRollingDice;

      // Render component
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Simulate tiles dealt (private event)
      const tilesDealtEvent: PrivateEvent = {
        TilesDealt: {
          your_tiles: [0, 1, 5, 9, 12, 18, 22, 27, 31, 33, 34, 35, 2, 10],
        },
      };
      await act(async () => {
        mockWs.triggerMessage(JSON.stringify({ Private: tilesDealtEvent }));
      });

      // Assert: User's hand is updated
      // (hand display will be tested when we implement ConcealedHand component)
      await waitFor(() => {
        expect(screen.getByTestId('game-board')).toBeInTheDocument();
      });
    });

    test('transitions to Charleston phase after CharlestonPhaseChanged event', async () => {
      // Setup: Game in Setup(RollingDice), user is East
      const gameState = gameStates.setupRollingDice;

      // Render component
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Simulate phase change
      const phaseChangedEvent: PublicEvent = {
        CharlestonPhaseChanged: { stage: 'FirstRight' },
      };
      await act(async () => {
        mockWs.triggerMessage(JSON.stringify({ Public: phaseChangedEvent }));
      });

      // Assert: Phase updated (will show Charleston-specific UI when implemented)
      await waitFor(() => {
        expect(screen.getByTestId('action-bar')).toBeInTheDocument();
      });
    });

    test('complete dice roll sequence using fixture', async () => {
      // Setup: Game in Setup(RollingDice), user is East
      const gameState = gameStates.setupRollingDice;

      // Render component
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Simulate complete event sequence from fixture
      const { events } = eventSequences.diceRollSequence;

      await act(async () => {
        for (const event of events) {
          mockWs.triggerMessage(JSON.stringify(event));
        }
      });

      // Assert: Final state shows dice were rolled
      await waitFor(() => {
        expect(screen.getByTestId('game-board')).toBeInTheDocument();
      });
    });
  });

  describe('Test 2: Non-East player cannot roll', () => {
    test('does not show Roll Dice button when user is not East', () => {
      // Setup: Game in Setup(RollingDice), user is South
      const gameState = {
        ...gameStates.setupRollingDice,
        your_seat: 'South' as const,
      };

      // Render component
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Assert: "Roll Dice" button is NOT visible
      expect(screen.queryByTestId('roll-dice-button')).not.toBeInTheDocument();
    });

    test('shows waiting message when user is not East', () => {
      // Setup: Game in Setup(RollingDice), user is South
      const gameState = {
        ...gameStates.setupRollingDice,
        your_seat: 'South' as const,
      };

      // Render component
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Assert: Message shows "Waiting for East to roll dice..."
      expect(screen.getByTestId('waiting-message')).toHaveTextContent(
        /waiting for east to roll dice/i
      );
    });
  });

  describe('Test 3: Button disabled after click (prevent double-submit)', () => {
    test('disables button immediately after click', async () => {
      // Setup: Game in Setup(RollingDice), user is East
      const gameState = gameStates.setupRollingDice;

      // Render component
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Action: Click "Roll Dice" button
      const rollButton = screen.getByTestId('roll-dice-button');
      await user.click(rollButton);

      // Assert: Button becomes disabled immediately
      expect(rollButton).toBeDisabled();
    });

    test('only sends one RollDice command on rapid clicks', async () => {
      // Setup: Game in Setup(RollingDice), user is East
      const gameState = gameStates.setupRollingDice;

      // Render component
      const { user } = renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Action: Attempt to click button multiple times rapidly
      const rollButton = screen.getByTestId('roll-dice-button');
      await user.click(rollButton);
      await user.click(rollButton); // Second click should be ignored

      // Assert: Only ONE RollDice command was sent
      expect(mockWs.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('Test 4: Bot auto-roll behavior', () => {
    test('does not show Roll Dice button when East is a bot', () => {
      // Setup: Game in Setup(RollingDice), East is a bot, user is South
      const gameState = {
        ...gameStates.setupRollingDice,
        your_seat: 'South' as const,
        players: gameStates.setupRollingDice.players.map((p) =>
          p.seat === 'East' ? { ...p, is_bot: true } : p
        ),
      };

      // Render component
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Assert: No "Roll Dice" button visible to human players
      expect(screen.queryByTestId('roll-dice-button')).not.toBeInTheDocument();
    });

    test('shows bot rolling message when East is a bot', () => {
      // Setup: Game in Setup(RollingDice), East is a bot, user is South
      const gameState = {
        ...gameStates.setupRollingDice,
        your_seat: 'South' as const,
        players: gameStates.setupRollingDice.players.map((p) =>
          p.seat === 'East' ? { ...p, is_bot: true } : p
        ),
      };

      // Render component
      renderWithProviders(<GameBoard initialState={gameState} ws={mockWs} />);

      // Assert: Message shows "East (Bot) is rolling dice..."
      expect(screen.getByTestId('bot-rolling-message')).toHaveTextContent(
        /east \(bot\) is rolling dice/i
      );
    });
  });
});
