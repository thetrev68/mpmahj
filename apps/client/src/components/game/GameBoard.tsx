/**
 * GameBoard Component
 *
 * Main game container that orchestrates all game components and manages
 * WebSocket communication with the backend.
 *
 * Related: All user stories - this is the main game container
 */

import React, { useState, useCallback, useMemo } from 'react';
import { Wall } from './Wall';
import { WallCounter } from './WallCounter';
import { CharlestonPhase } from './phases/CharlestonPhase';
import { PlayingPhase } from './phases/PlayingPhase';
import { SetupPhase } from './phases/SetupPhase';
import { useGameSocket, type Envelope } from '@/hooks/useGameSocket';
import { useGameEvents } from '@/hooks/useGameEvents';
import type { UIStateAction } from '@/lib/game-events/types';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { DiscardInfo } from '@/types/bindings/generated/DiscardInfo';
import type { PlayerStatus } from '@/types/bindings/generated/PlayerStatus';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { CharlestonState } from '@/types/bindings/generated/CharlestonState';
import type { TimerMode } from '@/types/bindings/generated/TimerMode';
import type { Meld } from '@/types/bindings/generated/Meld';

export interface GameBoardProps {
  /** Initial game state (for testing) */
  initialState?: GameState;
  /** WebSocket instance (for testing) */
  ws?: WebSocketLike;
}

/**
 * Local discard info with extra metadata not in server bindings
 */
export interface LocalDiscardInfo extends DiscardInfo {
  player: Seat; // Legacy alias for discarded_by
  turn: number;
  safe: boolean;
  called: boolean;
}

/**
 * Simplified game state for MVP
 */
export interface GameState {
  game_id: string;
  phase: GamePhase;
  current_turn: Seat;
  dealer: Seat;
  round_number: number;
  turn_number: number;
  your_seat: Seat;
  your_hand: Tile[];
  house_rules: {
    ruleset: {
      card_year: number;
      timer_mode: TimerMode;
      blank_exchange_enabled: boolean;
      call_window_seconds: number;
      charleston_timer_seconds: number;
    };
    analysis_enabled: boolean;
    concealed_bonus_enabled: boolean;
    dealer_bonus_enabled: boolean;
  };
  charleston_state: CharlestonState | null;
  players: Array<{
    seat: Seat;
    player_id: string;
    is_bot: boolean;
    status: PlayerStatus;
    tile_count: number;
    exposed_melds: Array<Meld>;
  }>;
  remaining_tiles: number;
  wall_seed: bigint;
  wall_draw_index: number;
  wall_break_point: number;
  wall_tiles_remaining: number;
  discard_pile: Array<LocalDiscardInfo>;
  exposed_melds?: Record<Seat, Array<Meld & { called_from?: Seat }>>;
}

/**
 * WebSocket-like interface for testing
 */
export interface WebSocketLike {
  send: (data: string) => void;
  addEventListener: (event: string, handler: (e: MessageEvent) => void) => void;
  removeEventListener: (event: string, handler: (e: MessageEvent) => void) => void;
}

type CommandEnvelope = {
  kind: 'Command';
  payload: {
    command: GameCommand;
  };
};

// Feature flags removed - Phase 5 complete: Event bridge + phase components fully integrated
// Old envelope types removed - now handled by useGameEvents hook

/**
 * GameBoard is the main game container
 */
export const GameBoard: React.FC<GameBoardProps> = ({ initialState, ws }) => {
  // WebSocket connection (Phase 4: Event Bridge)
  // If ws prop provided (testing), use it; otherwise use useGameSocket hook
  const socket = useGameSocket();

  // Local game state fallback (for testing without WebSocket)
  const [localGameState, setLocalGameState] = useState<GameState | null>(initialState || null);

  // Setup phase UI state (still needed for SetupPhase component props)
  const [diceRoll, setDiceRoll] = useState<number | null>(null);
  const [showDiceOverlay, setShowDiceOverlay] = useState(false);

  // All other state now managed by phase components via event bridge

  /**
   * UI Action Dispatcher (Phase 4: Event Bridge)
   * Minimal dispatcher - most actions now handled by phase components
   */
  const dispatchUIAction = useCallback((action: UIStateAction) => {
    switch (action.type) {
      // Setup phase actions still needed
      case 'SET_DICE_ROLL':
        setDiceRoll(action.value);
        break;
      case 'SET_SHOW_DICE_OVERLAY':
        setShowDiceOverlay(action.value);
        break;
      case 'SET_SETUP_PHASE':
        setLocalGameState((prev) => (prev ? { ...prev, phase: { Setup: action.phase } } : null));
        break;

      // All other actions now handled by phase components
      default:
        // No-op: Phase components manage their own state
        break;
    }
  }, []);

  const eventBridgeSocket = useMemo(() => {
    if (ws) {
      const socket = ws; // Capture in closure for type narrowing
      return {
        send: (envelope: Envelope) => {
          socket.send(JSON.stringify(envelope));
        },
        subscribe: (kind: string, listener: (envelope: Envelope) => void) => {
          const handler = (event: MessageEvent) => {
            try {
              const envelope = JSON.parse(event.data) as Envelope;
              if (envelope.kind === kind) {
                listener(envelope);
              }
            } catch (error) {
              console.error('Failed to parse WebSocket message:', error);
            }
          };

          socket.addEventListener('message', handler);
          return () => socket.removeEventListener('message', handler);
        },
      };
    }

    return {
      send: socket.send,
      subscribe: socket.subscribe,
    };
  }, [ws, socket.send, socket.subscribe]);

  // Event bridge always enabled when WebSocket connected
  const eventBridgeEnabled = !!ws || socket.connectionState === 'connected';

  const eventBridgeResult = useGameEvents({
    socket: eventBridgeSocket,
    initialState: initialState || null,
    dispatchUIAction,
    debug: import.meta.env.DEV,
    enabled: eventBridgeEnabled,
  });

  // Game state: from event bridge (if enabled) or local state
  const gameState = eventBridgeEnabled ? eventBridgeResult.gameState : localGameState;

  // Determine current phase for routing to phase components
  const isCharleston =
    gameState !== null && typeof gameState.phase === 'object' && 'Charleston' in gameState.phase;

  const charlestonStage: CharlestonStage | undefined =
    isCharleston && typeof gameState!.phase === 'object' && 'Charleston' in gameState!.phase
      ? (gameState!.phase as { Charleston: CharlestonStage }).Charleston
      : undefined;

  // Send command to server (from event bridge or inline)
  const sendCommand = useCallback(
    (command: GameCommand) => {
      if (eventBridgeEnabled) {
        eventBridgeResult.sendCommand(command);
      } else if (ws) {
        const envelope: CommandEnvelope = {
          kind: 'Command',
          payload: { command },
        };
        // Type assertion needed due to closure scope
        (ws as WebSocketLike).send(JSON.stringify(envelope));
      }
    },
    [ws, eventBridgeEnabled, eventBridgeResult]
  );

  // Handle dice overlay complete
  const handleDiceComplete = () => {
    setShowDiceOverlay(false);
  };

  if (!gameState) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-xl">Loading game...</div>
      </div>
    );
  }

  // Check if East is a bot
  const eastPlayer = gameState.players.find((p) => p.seat === 'East');
  const isEastBot = eastPlayer?.is_bot || false;
  const includeBlanks = gameState.house_rules.ruleset.blank_exchange_enabled;
  const totalTiles = includeBlanks ? 160 : 152;
  const stacksPerWall = totalTiles / 8;
  const wallBreakIndex = gameState.wall_break_point > 0 ? gameState.wall_break_point : undefined;
  const wallDrawIndex = gameState.wall_draw_index > 0 ? gameState.wall_draw_index : undefined;

  // Determine current phase
  const isSetupPhase =
    gameState.phase && typeof gameState.phase === 'object' && 'Setup' in gameState.phase;
  const setupStage =
    isSetupPhase && typeof gameState.phase === 'object' && 'Setup' in gameState.phase
      ? gameState.phase.Setup
      : null;

  const isPlaying =
    gameState.phase && typeof gameState.phase === 'object' && 'Playing' in gameState.phase;
  const turnStage =
    isPlaying && typeof gameState.phase === 'object' && 'Playing' in gameState.phase
      ? gameState.phase.Playing
      : null;

  return (
    <div
      className="relative w-full h-screen bg-gradient-to-br from-green-800 to-green-900"
      data-testid="game-board"
      role="main"
      aria-label="Mahjong game board"
    >
      {/* Wall Counter */}
      <WallCounter
        remainingTiles={gameState.wall_tiles_remaining}
        totalTiles={totalTiles}
        isDeadWall={false}
      />

      {/* Turn Indicator now handled by PlayingPhase component */}

      {/* Walls */}
      <Wall position="north" stackCount={stacksPerWall} initialStacks={stacksPerWall} />
      <Wall position="south" stackCount={stacksPerWall} initialStacks={stacksPerWall} />
      <Wall
        position="east"
        stackCount={stacksPerWall}
        initialStacks={stacksPerWall}
        breakIndex={wallBreakIndex}
        drawIndex={wallDrawIndex}
      />
      <Wall position="west" stackCount={stacksPerWall} initialStacks={stacksPerWall} />

      {/* Setup Phase */}
      {isSetupPhase && setupStage && (
        <SetupPhase
          gameState={gameState}
          stage={setupStage}
          sendCommand={sendCommand}
          diceRoll={diceRoll}
          showDiceOverlay={showDiceOverlay}
          onDiceOverlayClose={handleDiceComplete}
        />
      )}

      {/* Old UI elements now handled by phase components */}

      {/* Playing Phase */}
      {isPlaying && turnStage && (
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn={gameState.current_turn}
          sendCommand={sendCommand}
          eventBus={eventBridgeResult.eventBus}
        />
      )}

      {/* Charleston Phase */}
      {isCharleston && charlestonStage && (
        <CharlestonPhase
          gameState={gameState}
          stage={charlestonStage}
          sendCommand={sendCommand}
          eventBus={eventBridgeResult.eventBus}
        />
      )}

      {/* Old Charleston UI now handled by CharlestonPhase component */}

      {/* Old hand and voting UI now handled by phase components */}

      {/* Old call window, IOU, and animation UI now handled by phase components */}

      {/* Bot rolling message */}
      {typeof gameState.phase === 'object' &&
        'Setup' in gameState.phase &&
        gameState.phase.Setup === 'RollingDice' &&
        isEastBot &&
        gameState.your_seat !== 'East' && (
          <div
            className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-black/75 text-white px-6 py-4 rounded-lg text-lg"
            data-testid="bot-rolling-message"
            aria-live="polite"
          >
            East (Bot) is rolling dice...
          </div>
        )}
    </div>
  );
};

GameBoard.displayName = 'GameBoard';
