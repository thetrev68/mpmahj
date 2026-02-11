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
import { DrawOverlay } from './DrawOverlay';
import { DrawScoringScreen } from './DrawScoringScreen';
import { WinnerCelebration } from './WinnerCelebration';
import { ScoringScreen } from './ScoringScreen';
import { GameOverPanel } from './GameOverPanel';
import { useGameSocket, type Envelope } from '@/hooks/useGameSocket';
import { useGameEvents } from '@/hooks/useGameEvents';
import type { UIStateAction } from '@/lib/game-events/types';
import type { GameResult } from '@/types/bindings/generated/GameResult';
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

  // End-game overlay state (US-018/019)
  const [calledFrom, setCalledFrom] = useState<
    import('@/types/bindings/generated/Seat').Seat | null
  >(null);
  const [winnerCelebration, setWinnerCelebration] = useState<{
    winnerName: string;
    winnerSeat: import('@/types/bindings/generated/Seat').Seat;
    patternName: string;
    handValue?: number;
  } | null>(null);
  const [gameResult, setGameResult] = useState<GameResult | null>(null);
  const [showScoringScreen, setShowScoringScreen] = useState(false);
  const [showGameOverPanel, setShowGameOverPanel] = useState(false);
  const [heavenlyHand, setHeavenlyHand] = useState<{
    pattern: string;
    base_score: number;
  } | null>(null);
  // US-021: draw overlay (wall exhaustion or game abandoned)
  const [showDrawOverlay, setShowDrawOverlay] = useState(false);
  const [drawReason, setDrawReason] = useState<string>('Wall exhausted');
  const [wallTilesAtExhaustion, setWallTilesAtExhaustion] = useState<number>(0);
  // Tracks whether the draw overlay was acknowledged before GameOver arrived
  const [, setDrawAcknowledged] = useState(false);
  const [showDrawScoringScreen, setShowDrawScoringScreen] = useState(false);

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

      // US-019: track who discarded the winning tile (dispatched for all clients)
      case 'SET_CALLED_FROM':
        setCalledFrom(action.discardedBy);
        break;
      // Caller-only: show validation dialog (calledFrom already set by SET_CALLED_FROM)
      case 'SET_AWAITING_MAHJONG_VALIDATION':
        break;

      // End-game overlays (US-018)
      case 'SET_MAHJONG_VALIDATED':
        if (action.valid && action.pattern) {
          setWinnerCelebration({
            winnerName: action.player,
            winnerSeat: action.player,
            patternName: action.pattern,
          });
        }
        break;
      case 'SET_GAME_OVER':
        setGameResult(action.result);
        // AC-6 (US-018): ScoringScreen shown after WinnerCelebration.onContinue.
        // US-021: For draw games (winner=null), if the player already acknowledged the
        // DrawOverlay before GameOver arrived, auto-show DrawScoringScreen now.
        if (action.winner === null) {
          setDrawAcknowledged((prev) => {
            if (prev) {
              setShowDrawScoringScreen(true);
            }
            return prev;
          });
        }
        break;
      case 'SET_HEAVENLY_HAND':
        setHeavenlyHand({ pattern: action.pattern, base_score: action.base_score });
        break;

      // US-021: Wall game / draw
      case 'SET_WALL_EXHAUSTED':
        setDrawReason('Wall exhausted');
        setWallTilesAtExhaustion(action.remaining_tiles);
        setShowDrawOverlay(true);
        break;
      case 'SET_GAME_ABANDONED':
        setDrawReason(
          action.reason === 'AllPlayersDead' ? 'All players dead hands' : action.reason
        );
        setShowDrawOverlay(true);
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

      {/* Heavenly Hand Overlay */}
      {heavenlyHand && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80"
          data-testid="heavenly-hand-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Heavenly Hand"
        >
          <div className="bg-gray-900 border-2 border-yellow-400 rounded-2xl shadow-2xl px-10 py-8 flex flex-col items-center gap-4 min-w-[320px]">
            <h2 className="text-4xl font-bold text-yellow-400">Heavenly Hand!</h2>
            <p className="text-gray-300 text-center">East wins with the initial deal!</p>
            <div className="bg-gray-800 rounded-lg px-6 py-3 text-center">
              <p className="text-green-300 font-semibold">{heavenlyHand.pattern}</p>
              <p className="text-yellow-300 font-medium">{heavenlyHand.base_score} points</p>
            </div>
          </div>
        </div>
      )}

      {/* Draw Overlay (US-021: wall exhaustion or game abandoned) */}
      <DrawOverlay
        show={showDrawOverlay}
        reason={drawReason}
        remainingTiles={wallTilesAtExhaustion}
        onAcknowledge={() => {
          setShowDrawOverlay(false);
          setDrawAcknowledged(true);
          // If GameOver result is already here, show DrawScoringScreen immediately.
          // If not (race condition), SET_GAME_OVER handler will show it when it arrives.
          if (gameResult && gameResult.winner === null) {
            setShowDrawScoringScreen(true);
          }
        }}
      />

      {/* Draw Scoring Screen (US-021: shown after DrawOverlay for draw games) */}
      <DrawScoringScreen
        isOpen={showDrawScoringScreen}
        reason={drawReason}
        currentScores={gameResult?.final_scores ?? {}}
        onContinue={() => {
          setShowDrawScoringScreen(false);
          setShowGameOverPanel(true);
        }}
      />

      {/* Winner Celebration Overlay */}
      <WinnerCelebration
        isOpen={winnerCelebration !== null}
        winnerName={winnerCelebration?.winnerName ?? ''}
        winnerSeat={winnerCelebration?.winnerSeat ?? 'East'}
        patternName={winnerCelebration?.patternName ?? ''}
        handValue={winnerCelebration?.handValue}
        onContinue={() => {
          setWinnerCelebration(null);
          // AC-4/AC-6: show ScoringScreen after celebration completes (not immediately on GameOver)
          if (gameResult) {
            setShowScoringScreen(true);
          } else {
            setShowGameOverPanel(true);
          }
        }}
      />

      {/* Scoring Screen — only shown after celebration completes (winnerCelebration must be null) */}
      <ScoringScreen
        isOpen={showScoringScreen && gameResult !== null && winnerCelebration === null}
        result={
          gameResult ?? {
            winner: null,
            winning_pattern: null,
            score_breakdown: null,
            final_scores: {},
            final_hands: {},
            next_dealer: 'East',
            end_condition: 'WallExhausted',
          }
        }
        winnerName={gameResult?.winner ?? '—'}
        isSelfDraw={calledFrom === null}
        calledFrom={calledFrom ?? undefined}
        onContinue={() => {
          setShowScoringScreen(false);
          setShowGameOverPanel(true);
        }}
      />

      {/* Game Over Panel */}
      <GameOverPanel
        isOpen={showGameOverPanel && gameResult !== null}
        result={
          gameResult ?? {
            winner: null,
            winning_pattern: null,
            score_breakdown: null,
            final_scores: {},
            final_hands: {},
            next_dealer: 'East',
            end_condition: 'WallExhausted',
          }
        }
        onNewGame={() => setShowGameOverPanel(false)}
        onReturnToLobby={() => setShowGameOverPanel(false)}
      />
    </div>
  );
};

GameBoard.displayName = 'GameBoard';
