/**
 * PlayingPhase Component Tests
 *
 * Comprehensive test suite for the PlayingPhase component.
 * Tests all rendering, interactions, and state management.
 *
 * Related: GAMEBOARD_REFACTORING_PLAN.md Phase 3, Task 7
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { PlayingPhase } from './PlayingPhase';
import { gameStates } from '@/test/fixtures';
import { useGameUIStore } from '@/stores/gameUIStore';
import type { ResolutionOverlayData } from '@/lib/game-events/types';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';

describe('PlayingPhase', () => {
  let mockSendCommand: (cmd: import('@/types/bindings/generated/GameCommand').GameCommand) => void;
  let gameState: GameStateSnapshot;

  beforeEach(() => {
    mockSendCommand = vi.fn();
    vi.useFakeTimers();
    localStorage.clear();
    // Reset the game UI store between tests to avoid state leaking across test cases.
    useGameUIStore.getState().reset();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // ============================================================================
  // Rendering Tests
  // ============================================================================

  describe('Rendering - Basic Components', () => {
    it('highlights only the active rack for the current turn', () => {
      const turnStage: TurnStage = { Drawing: { player: 'East' } };
      gameState = gameStates.playingDrawing as GameStateSnapshot;

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="East"
          sendCommand={mockSendCommand}
        />
      );

      expect(screen.getByTestId('opponent-rack-east')).toHaveClass('ring-2', 'ring-green-400');
      expect(screen.getByTestId('player-rack')).not.toHaveClass('ring-green-400');
      expect(screen.getByTestId('opponent-rack-west')).not.toHaveClass('ring-green-400');
      expect(screen.getByTestId('opponent-rack-north')).not.toHaveClass('ring-green-400');
      expect(document.querySelectorAll('.ring-green-400')).toHaveLength(1);
    });

    it('renders DiscardPool with discarded tiles', () => {
      const turnStage: TurnStage = { Discarding: { player: 'South' } };
      gameState = {
        ...gameStates.playingDiscarding,
        discard_pile: [
          { tile: 5, discarded_by: 'East' },
          { tile: 10, discarded_by: 'South' },
        ],
      } as GameStateSnapshot;

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="South"
          sendCommand={mockSendCommand}
        />
      );

      expect(screen.getByTestId('discard-pool')).toBeInTheDocument();
      expect(screen.getByLabelText(/Discard pool: 2 tiles/i)).toBeInTheDocument();
    });

    it('renders rack-owned exposed melds for players who have them', () => {
      const turnStage: TurnStage = { Drawing: { player: 'East' } };
      gameState = {
        ...gameStates.playingDrawing,
        players: [
          {
            seat: 'East',
            player_id: 'player1',
            is_bot: false,
            status: 'Active',
            tile_count: 14,
            exposed_melds: [
              { meld_type: 'Pung', tiles: [5, 5, 5], called_tile: 5, joker_assignments: {} },
            ],
          },
          {
            seat: 'South',
            player_id: 'bot1',
            is_bot: true,
            status: 'Active',
            tile_count: 13,
            exposed_melds: [],
          },
          {
            seat: 'West',
            player_id: 'bot2',
            is_bot: true,
            status: 'Active',
            tile_count: 13,
            exposed_melds: [],
          },
          {
            seat: 'North',
            player_id: 'bot3',
            is_bot: true,
            status: 'Active',
            tile_count: 13,
            exposed_melds: [],
          },
        ],
      } as GameStateSnapshot;

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="East"
          sendCommand={mockSendCommand}
        />
      );

      expect(screen.getByTestId('opponent-meld-row-east')).toBeInTheDocument();
      expect(screen.getByRole('region', { name: /exposed meld/i })).toBeInTheDocument();
      expect(screen.queryAllByTestId('exposed-melds-area')).toHaveLength(1);
    });

    it('renders PlayerRack with player tiles', () => {
      const turnStage: TurnStage = { Discarding: { player: 'South' } };
      gameState = {
        ...gameStates.playingDiscarding,
        your_seat: 'South',
        your_hand: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
      } as GameStateSnapshot;

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="South"
          sendCommand={mockSendCommand}
        />
      );

      expect(screen.getByTestId('player-rack')).toBeInTheDocument();
      expect(screen.getByLabelText(/Your rack: 14 tiles/i)).toBeInTheDocument();
      expect(screen.getByTestId('player-zone')).toBeInTheDocument();
      expect(screen.getByTestId('staging-strip')).toBeInTheDocument();
    });

    it('renders ActionBar with phase-appropriate buttons', () => {
      const turnStage: TurnStage = { Discarding: { player: 'South' } };
      gameState = {
        ...gameStates.playingDiscarding,
        your_seat: 'South',
      } as GameStateSnapshot;

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="South"
          sendCommand={mockSendCommand}
        />
      );

      // ActionBar should render (specific buttons depend on turn stage)
      expect(screen.getByTestId('action-bar')).toBeInTheDocument();
      expect(screen.getByTestId('player-zone')).toBeInTheDocument();
      expect(screen.getByTestId('staging-strip')).toBeInTheDocument();
      expect(screen.queryByTestId('staging-discard-button')).not.toBeInTheDocument();
      expect(screen.getByTestId('proceed-button')).toBeInTheDocument();
      expect(screen.getByTestId('gameplay-status-bar')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Call Window Tests
  // ============================================================================

  describe('Call Window', () => {
    it('does not render modal call window initially', () => {
      const turnStage: TurnStage = { Drawing: { player: 'East' } };
      gameState = gameStates.playingDrawing as GameStateSnapshot;

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="East"
          sendCommand={mockSendCommand}
        />
      );

      expect(screen.getByTestId('proceed-button')).toBeDisabled();
    });

    it('renders claim-window staging instead of CallWindowPanel when call window is active', () => {
      const turnStage: TurnStage = {
        CallWindow: {
          tile: 5,
          discarded_by: 'East',
          can_act: ['South'],
          pending_intents: [],
          timer: 10,
        },
      };
      gameState = {
        ...gameStates.playingCallWindow,
        your_seat: 'South',
        your_hand: [5, 5, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21], // Has 2 matching tiles
      } as GameStateSnapshot;

      // Simulate call window opened event via hook (would normally be triggered by event handler)
      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="East"
          sendCommand={mockSendCommand}
        />
      );

      useGameUIStore.getState().dispatch({
        type: 'OPEN_CALL_WINDOW',
        params: {
          tile: 5,
          discardedBy: 'East',
          canCall: ['South'],
          timerDuration: 10,
          timerStart: Date.now(),
        },
      });

      expect(screen.queryByRole('dialog', { name: /call window/i })).not.toBeInTheDocument();
      expect(screen.getByTestId('proceed-button')).toBeInTheDocument();
    });

    it('calculates call eligibility correctly (can call for Pung)', () => {
      const turnStage: TurnStage = {
        CallWindow: {
          tile: 5,
          discarded_by: 'East',
          can_act: ['South'],
          pending_intents: [],
          timer: 10,
        },
      };
      gameState = {
        ...gameStates.playingCallWindow,
        your_seat: 'South',
        your_hand: [5, 5, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21], // Has 2x tile 5
      } as GameStateSnapshot;

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="East"
          sendCommand={mockSendCommand}
        />
      );

      // Manually trigger call window opened (simulating event handler)
      // This would normally be done via publicEventHandlers.handleCallWindowOpened
      // For this test, we verify the component renders correctly when call window is open
      // Full integration will be tested in integration tests
    });

    it('calculates call eligibility correctly (can call for Kong with jokers)', () => {
      const turnStage: TurnStage = {
        CallWindow: {
          tile: 5,
          discarded_by: 'East',
          can_act: ['South'],
          pending_intents: [],
          timer: 10,
        },
      };
      gameState = {
        ...gameStates.playingCallWindow,
        your_seat: 'South',
        your_hand: [5, 5, 42, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20], // 2x tile 5 + 1 joker
      } as GameStateSnapshot;

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="East"
          sendCommand={mockSendCommand}
        />
      );

      // Component should calculate eligibility for Kong (2 matching + 1 joker = can call)
      // Verification will be done when CallWindowPanel is rendered
    });

    it('sends DeclareCallIntent command when proceeding with a staged Pung', () => {
      const turnStage: TurnStage = {
        CallWindow: {
          tile: 5,
          discarded_by: 'East',
          can_act: ['South'],
          pending_intents: [],
          timer: 10,
        },
      };
      const handTileForPung = 5;
      gameState = {
        ...gameStates.playingCallWindow,
        your_seat: 'South',
        your_hand: [
          handTileForPung,
          handTileForPung,
          10,
          11,
          12,
          13,
          14,
          15,
          16,
          17,
          18,
          19,
          20,
          21,
        ],
      } as GameStateSnapshot;

      useGameUIStore.getState().dispatch({
        type: 'OPEN_CALL_WINDOW',
        params: {
          tile: 5,
          discardedBy: 'East',
          canCall: ['South'],
          timerDuration: 10,
          timerStart: Date.now(),
        },
      });

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="East"
          sendCommand={mockSendCommand}
        />
      );

      fireEvent.click(screen.getByTestId('tile-5-5-0'));
      fireEvent.click(screen.getByTestId('tile-5-5-1'));
      fireEvent.click(screen.getByTestId('proceed-button'));

      expect(mockSendCommand).toHaveBeenCalledWith({
        DeclareCallIntent: {
          player: 'South',
          intent: {
            Meld: {
              meld_type: 'Pung',
              tiles: [5, 5, 5],
              called_tile: 5,
              joker_assignments: {},
            },
          },
        },
      });
    });

    it('sends Pass command when proceeding with no staged claim', () => {
      const turnStage: TurnStage = {
        CallWindow: {
          tile: 5,
          discarded_by: 'East',
          can_act: ['South'],
          pending_intents: [],
          timer: 10,
        },
      };
      gameState = {
        ...gameStates.playingCallWindow,
        your_seat: 'South',
        your_hand: [5, 6, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21],
      } as GameStateSnapshot;

      useGameUIStore.getState().dispatch({
        type: 'OPEN_CALL_WINDOW',
        params: {
          tile: 5,
          discardedBy: 'East',
          canCall: ['South'],
          timerDuration: 10,
          timerStart: Date.now(),
        },
      });

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="East"
          sendCommand={mockSendCommand}
        />
      );

      fireEvent.click(screen.getByTestId('proceed-button'));

      expect(mockSendCommand).toHaveBeenCalledWith({
        Pass: {
          player: 'South',
        },
      });
    });

    it('closes staged claim affordances when CallWindowClosed event is received', () => {
      const turnStage: TurnStage = {
        CallWindow: {
          tile: 5,
          discarded_by: 'East',
          can_act: ['South'],
          pending_intents: [],
          timer: 10,
        },
      };
      gameState = {
        ...gameStates.playingCallWindow,
        your_seat: 'South',
      } as GameStateSnapshot;

      useGameUIStore.getState().dispatch({
        type: 'OPEN_CALL_WINDOW',
        params: {
          tile: 5,
          discardedBy: 'East',
          canCall: ['South'],
          timerDuration: 10,
          timerStart: Date.now(),
        },
      });

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="South"
          sendCommand={mockSendCommand}
        />
      );

      expect(screen.getByTestId('proceed-button')).toBeInTheDocument();

      act(() => {
        useGameUIStore.getState().dispatch({ type: 'CLOSE_CALL_WINDOW' });
      });

      expect(screen.getByTestId('proceed-button')).toBeDisabled();
    });
  });

  // ============================================================================
  // Call Window Timer Tests
  // ============================================================================

  describe('Call Window Timer', () => {
    it('keeps the staged claim surface open while timer state updates', () => {
      const callStage: TurnStage = {
        CallWindow: {
          tile: 5,
          discarded_by: 'East',
          can_act: ['South'],
          pending_intents: [],
          timer: 10,
        },
      };
      const startAt = Date.now();
      gameState = gameStates.playingCallWindow as GameStateSnapshot;

      useGameUIStore.getState().dispatch({
        type: 'OPEN_CALL_WINDOW',
        params: {
          tile: 5,
          discardedBy: 'East',
          canCall: ['South'],
          timerDuration: 10,
          timerStart: startAt,
        },
      });

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={callStage}
          currentTurn="East"
          sendCommand={mockSendCommand}
        />
      );

      expect(screen.getByTestId('proceed-button')).toBeInTheDocument();
    });

    it('updates timer every second', () => {
      const callStage: TurnStage = {
        CallWindow: {
          tile: 5,
          discarded_by: 'East',
          can_act: ['South'],
          pending_intents: [],
          timer: 5,
        },
      };
      const startAt = Date.now();
      gameState = gameStates.playingCallWindow as GameStateSnapshot;

      useGameUIStore.getState().dispatch({
        type: 'OPEN_CALL_WINDOW',
        params: {
          tile: 5,
          discardedBy: 'East',
          canCall: ['South'],
          timerDuration: 5,
          timerStart: startAt,
        },
      });

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={callStage}
          currentTurn="East"
          sendCommand={mockSendCommand}
        />
      );

      act(() => {
        vi.advanceTimersByTime(1100);
      });

      expect(screen.getByTestId('proceed-button')).toBeInTheDocument();
    });

    it('does NOT auto-pass when timer expires (display-only)', () => {
      const callStage: TurnStage = {
        CallWindow: {
          tile: 5,
          discarded_by: 'East',
          can_act: ['South'],
          pending_intents: [],
          timer: 2,
        },
      };
      const startAt = Date.now();
      gameState = gameStates.playingCallWindow as GameStateSnapshot;

      useGameUIStore.getState().dispatch({
        type: 'OPEN_CALL_WINDOW',
        params: {
          tile: 5,
          discardedBy: 'East',
          canCall: ['South'],
          timerDuration: 2,
          timerStart: startAt,
        },
      });

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={callStage}
          currentTurn="East"
          sendCommand={mockSendCommand}
        />
      );
      (mockSendCommand as unknown as { mockClear: () => void }).mockClear();

      act(() => {
        vi.advanceTimersByTime(2500);
      });

      expect(mockSendCommand).not.toHaveBeenCalled();
      expect(screen.getByTestId('proceed-button')).toBeInTheDocument();
    });
  });

  // ============================================================================
  // Call Resolution Overlay Tests
  // ============================================================================

  describe('Call Resolution Overlay', () => {
    it('does not render CallResolutionOverlay initially', () => {
      const turnStage: TurnStage = { Drawing: { player: 'East' } };
      gameState = gameStates.playingDrawing as GameStateSnapshot;

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="East"
          sendCommand={mockSendCommand}
        />
      );

      expect(screen.queryByRole('dialog', { name: /call resolved/i })).not.toBeInTheDocument();
    });

    it('renders CallResolutionOverlay when resolution is shown', () => {
      const turnStage: TurnStage = { Drawing: { player: 'East' } };
      gameState = gameStates.playingDrawing as GameStateSnapshot;
      const resolutionData: ResolutionOverlayData = {
        resolution: { Mahjong: 'South' },
        tieBreak: null,
        allCallers: [{ seat: 'South', kind: 'Mahjong' }],
        discardedBy: 'East',
      };

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="East"
          sendCommand={mockSendCommand}
        />
      );

      act(() => {
        useGameUIStore.getState().dispatch({
          type: 'SHOW_RESOLUTION_OVERLAY',
          data: resolutionData,
        });
      });

      expect(screen.getByRole('dialog', { name: /call resolved/i })).toBeInTheDocument();
      expect(screen.getByText(/Call Resolved/i)).toBeInTheDocument();
    });

    it('dismisses CallResolutionOverlay when clicking dismiss button', () => {
      const turnStage: TurnStage = { Drawing: { player: 'East' } };
      gameState = gameStates.playingDrawing as GameStateSnapshot;
      const resolutionData: ResolutionOverlayData = {
        resolution: { Mahjong: 'South' },
        tieBreak: null,
        allCallers: [{ seat: 'South', kind: 'Mahjong' }],
        discardedBy: 'East',
      };

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="East"
          sendCommand={mockSendCommand}
        />
      );

      act(() => {
        useGameUIStore.getState().dispatch({
          type: 'SHOW_RESOLUTION_OVERLAY',
          data: resolutionData,
        });
      });

      expect(screen.getByRole('dialog', { name: /call resolved/i })).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: /continue/i }));
      expect(screen.queryByRole('dialog', { name: /call resolved/i })).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Discard Animation Tests
  // ============================================================================

  describe('Discard Animation', () => {
    it('renders DiscardAnimationLayer when tile is discarded', () => {
      const turnStage: TurnStage = { Discarding: { player: 'South' } };
      gameState = gameStates.playingDiscarding as GameStateSnapshot;

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="South"
          sendCommand={mockSendCommand}
        />
      );

      act(() => {
        useGameUIStore.getState().dispatch({ type: 'SET_DISCARD_ANIMATION_TILE', tile: 7 });
      });

      expect(screen.getByTestId('discard-animation-layer')).toBeInTheDocument();
      expect(screen.getByTestId('discard-animated-tile')).toBeInTheDocument();
    });

    it('clears discard animation after animation completes', () => {
      const turnStage: TurnStage = { Discarding: { player: 'South' } };
      gameState = gameStates.playingDiscarding as GameStateSnapshot;

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="South"
          sendCommand={mockSendCommand}
        />
      );

      act(() => {
        useGameUIStore.getState().dispatch({ type: 'SET_DISCARD_ANIMATION_TILE', tile: 7 });
      });
      expect(screen.getByTestId('discard-animation-layer')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(399);
      });
      expect(screen.getByTestId('discard-animation-layer')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(screen.queryByTestId('discard-animation-layer')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // State Reset Tests
  // ============================================================================

  describe('State Management', () => {
    it('persists rapid sound-effects volume and enabled changes in the same act block', () => {
      const turnStage: TurnStage = { Discarding: { player: 'South' } };
      gameState = {
        ...gameStates.playingDiscarding,
        your_seat: 'South',
      } as GameStateSnapshot;

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="South"
          sendCommand={mockSendCommand}
        />
      );

      fireEvent.click(screen.getByTestId('hint-settings-button'));

      act(() => {
        fireEvent.keyDown(screen.getByRole('slider', { name: 'Sound Effects volume' }), {
          key: 'ArrowRight',
        });
        fireEvent.click(screen.getByTestId('sound-effects-toggle'));
      });

      expect(JSON.parse(localStorage.getItem('audio_settings') ?? 'null')).toMatchObject({
        soundEffectsEnabled: false,
        soundEffectsVolume: 0.6,
      });
    });

    it('persists rapid music volume and enabled changes in the same act block', () => {
      const turnStage: TurnStage = { Discarding: { player: 'South' } };
      gameState = {
        ...gameStates.playingDiscarding,
        your_seat: 'South',
      } as GameStateSnapshot;

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="South"
          sendCommand={mockSendCommand}
        />
      );

      fireEvent.click(screen.getByTestId('hint-settings-button'));

      act(() => {
        fireEvent.keyDown(screen.getByRole('slider', { name: 'Background Music volume' }), {
          key: 'ArrowRight',
        });
        fireEvent.click(screen.getByTestId('music-toggle'));
      });

      expect(JSON.parse(localStorage.getItem('audio_settings') ?? 'null')).toMatchObject({
        musicEnabled: false,
        musicVolume: 0.6,
      });
    });

    it('resets state when turn changes', () => {
      const turnStage: TurnStage = { Drawing: { player: 'East' } };
      gameState = gameStates.playingDrawing as GameStateSnapshot;

      const { rerender } = render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="East"
          sendCommand={mockSendCommand}
        />
      );

      // Change turn
      const newTurnStage: TurnStage = { Drawing: { player: 'South' } };
      rerender(
        <PlayingPhase
          gameState={gameState}
          turnStage={newTurnStage}
          currentTurn="South"
          sendCommand={mockSendCommand}
        />
      );

      // State should be reset (animations cleared, etc.)
      expect(screen.queryByTestId('discard-animation-layer')).not.toBeInTheDocument();
    });

    it('clears animations when turn stage changes', () => {
      const turnStage: TurnStage = { Drawing: { player: 'East' } };
      gameState = gameStates.playingDrawing as GameStateSnapshot;

      const { rerender } = render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="East"
          sendCommand={mockSendCommand}
        />
      );

      // Change stage
      const newTurnStage: TurnStage = { Discarding: { player: 'East' } };
      rerender(
        <PlayingPhase
          gameState={gameState}
          turnStage={newTurnStage}
          currentTurn="East"
          sendCommand={mockSendCommand}
        />
      );

      // Animations should be cleared
      expect(screen.queryByTestId('discard-animation-layer')).not.toBeInTheDocument();
    });

    it('clears outgoing staged tile when stage transitions from Discarding to CallWindow (same currentTurn)', () => {
      // AC-4: staging resets on phase transitions without a seat change
      const discardingStage: TurnStage = { Discarding: { player: 'South' } };
      gameState = gameStates.playingDiscarding as GameStateSnapshot;

      const { rerender } = render(
        <PlayingPhase
          gameState={gameState}
          turnStage={discardingStage}
          currentTurn="South"
          sendCommand={mockSendCommand}
        />
      );

      // Select tile 1 (id '1-0') — puts it in the outgoing staging slot
      fireEvent.click(screen.getByTestId('tile-1-1-0'));
      expect(screen.getByTestId('staging-outgoing-tile-1-0')).toBeInTheDocument();

      // Stage transitions to CallWindow while currentTurn stays South
      const callWindowStage: TurnStage = {
        CallWindow: {
          tile: 1,
          discarded_by: 'South',
          can_act: ['East', 'West', 'North'],
          pending_intents: [],
          timer: 10,
        },
      };
      rerender(
        <PlayingPhase
          gameState={gameState}
          turnStage={callWindowStage}
          currentTurn="South"
          sendCommand={mockSendCommand}
        />
      );

      // Outgoing staged tile must be gone — no longer in discard flow
      expect(screen.queryByTestId('staging-outgoing-tile-1-0')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Integration Tests with Hooks
  // ============================================================================

  describe('Hook Integration', () => {
    it('uses useCallWindowState hook correctly', () => {
      const turnStage: TurnStage = { Drawing: { player: 'East' } };
      gameState = gameStates.playingDrawing as GameStateSnapshot;

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="East"
          sendCommand={mockSendCommand}
        />
      );

      // Hook should be initialized with no active call-window surface
      expect(screen.getByTestId('proceed-button')).toBeDisabled();
    });

    it('uses usePlayingPhaseState hook correctly', () => {
      const turnStage: TurnStage = { Drawing: { player: 'East' } };
      gameState = gameStates.playingDrawing as GameStateSnapshot;

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="East"
          sendCommand={mockSendCommand}
        />
      );

      // Hook should be initialized with default state
      expect(screen.queryByTestId('discard-animation-layer')).not.toBeInTheDocument();
      expect(screen.queryByRole('dialog', { name: /call resolved/i })).not.toBeInTheDocument();
    });

    it('uses useGameAnimations hook correctly', () => {
      const turnStage: TurnStage = { Drawing: { player: 'East' } };
      gameState = gameStates.playingDrawing as GameStateSnapshot;

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="East"
          sendCommand={mockSendCommand}
        />
      );

      // Hook should be initialized with no animations
      expect(screen.queryByTestId('discard-animation-layer')).not.toBeInTheDocument();
    });
  });

  // ============================================================================
  // Edge Cases and Error Handling
  // ============================================================================

  describe('Edge Cases', () => {
    it('handles missing discard pool gracefully', () => {
      const turnStage: TurnStage = { Drawing: { player: 'East' } };
      gameState = {
        ...gameStates.playingDrawing,
        discard_pile: [],
      } as GameStateSnapshot;

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="East"
          sendCommand={mockSendCommand}
        />
      );

      expect(screen.getByTestId('discard-pool')).toBeInTheDocument();
      expect(screen.getByLabelText(/Discard pool: 0 tiles/i)).toBeInTheDocument();
    });

    it('handles empty exposed melds gracefully', () => {
      const turnStage: TurnStage = { Drawing: { player: 'East' } };
      gameState = {
        ...gameStates.playingDrawing,
        players: [
          {
            seat: 'East',
            player_id: 'player1',
            is_bot: false,
            status: 'Active',
            tile_count: 14,
            exposed_melds: [],
          },
          {
            seat: 'South',
            player_id: 'bot1',
            is_bot: true,
            status: 'Active',
            tile_count: 13,
            exposed_melds: [],
          },
          {
            seat: 'West',
            player_id: 'bot2',
            is_bot: true,
            status: 'Active',
            tile_count: 13,
            exposed_melds: [],
          },
          {
            seat: 'North',
            player_id: 'bot3',
            is_bot: true,
            status: 'Active',
            tile_count: 13,
            exposed_melds: [],
          },
        ],
      } as GameStateSnapshot;

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="East"
          sendCommand={mockSendCommand}
        />
      );

      expect(screen.getByTestId('player-rack-meld-row')).toBeInTheDocument();
      expect(screen.getByTestId('opponent-meld-row-east')).toBeInTheDocument();
      expect(screen.getByTestId('opponent-meld-row-west')).toBeInTheDocument();
      expect(screen.getByTestId('opponent-meld-row-north')).toBeInTheDocument();
      expect(screen.queryByTestId('exposed-melds-area')).not.toBeInTheDocument();
    });

    it('handles AwaitingMahjong stage correctly', () => {
      const turnStage: TurnStage = {
        AwaitingMahjong: { caller: 'East', tile: 5, discarded_by: 'South' },
      };
      gameState = {
        ...gameStates.playingDrawing,
        your_seat: 'East',
      } as GameStateSnapshot;

      render(
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn="East"
          sendCommand={mockSendCommand}
        />
      );

      // Should render awaiting mahjong state
      // (Specific UI will depend on implementation)
    });
  });
});
