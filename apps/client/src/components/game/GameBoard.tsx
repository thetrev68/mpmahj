/**
 * @module GameBoard
 *
 * Main game container orchestrating all game phases (Setup, Charleston, Playing, Scoring).
 * Manages WebSocket communication, state reconciliation, and event routing to phase components.
 *
 * Key responsibilities:
 * - Maintains {@link GameState} as single source of truth for UI
 * - Routes server events to {@link useGameEvents} hook for state updates
 * - Sends commands via {@link sendCommand} callback
 * - Manages event bridge (WebSocket proxy) for phase components
 * - Coordinates overlays (drawing, mahjong validation, end-game scoring)
 * - Handles reconnection and replay features (history, timeline, undo voting)
 *
 * Phase components (SetupPhase, CharlestonPhase, PlayingPhase) are passed:
 * - `gameState`: Current server state snapshot
 * - `sendCommand`: Callback to send commands to server
 * - `eventBus`: Optional event emitter for cross-component communication
 *
 * For testing, provides `initialState` and `ws` props for offline/mock scenarios.
 *
 * @see `src/hooks/useGameSocket.ts` for WebSocket management
 * @see `src/hooks/useGameEvents.ts` for event dispatching
 */

import { type FC } from 'react';
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
import { ConnectionStatus } from './ConnectionStatus';
import { HouseRulesPanel } from './HouseRulesPanel';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useGameSocket, type UseGameSocketReturn } from '@/hooks/useGameSocket';
import { useRoomStore } from '@/stores/roomStore';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { DiscardInfo } from '@/types/bindings/generated/DiscardInfo';
import type { PlayerStatus } from '@/types/bindings/generated/PlayerStatus';
import type { CharlestonState } from '@/types/bindings/generated/CharlestonState';
import type { TimerMode } from '@/types/bindings/generated/TimerMode';
import type { Meld } from '@/types/bindings/generated/Meld';
import { useGameBoardBridge } from './useGameBoardBridge';
import { useGameBoardOverlays } from './useGameBoardOverlays';
import { useGamePhase } from './useGamePhase';

interface GameBoardProps {
  /** Initial game state (for testing) */
  initialState?: GameState;
  /** WebSocket instance (for testing) */
  ws?: WebSocketLike;
  /** Shared game socket from parent app */
  socket?: UseGameSocketReturn;
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
 * Local game state combining server snapshot and component-managed state.
 * Serves as single source of truth for the game UI.
 *
 * @interface GameState
 * @property {string} game_id - Unique room identifier from server
 * @property {GamePhase} phase - Current game phase (Setup/Charleston/Playing/Scoring/GameOver)
 * @property {Seat} current_turn - Whose turn it is (East/South/West/North)
 * @property {Seat} dealer - Dealer seat this round
 * @property {number} round_number - Current round (starts at 1)
 * @property {number} turn_number - Current turn within a phase (increments per discard)
 * @property {Seat} your_seat - Player's own seat (used for filtering visible state)
 * @property {Tile[]} your_hand - Current hand tiles (0-43 indices per `tileUtils.ts`)
 * @property {Object} house_rules - Game rule configuration
 *   @property {Object} house_rules.ruleset - Runtime ruleset (card year, timers, features)
 *   @property {Object} house_rules.ruleset.card_year - NMJL card year (2017-2025)
 *   @property {TimerMode} house_rules.ruleset.timer_mode - Timer visibility mode (Visible/Hidden)
 *   @property {boolean} house_rules.ruleset.blank_exchange_enabled - Allow blank tile swaps
 *   @property {number} house_rules.ruleset.call_window_seconds - Call timeout in seconds
 *   @property {number} house_rules.ruleset.charleston_timer_seconds - Charleston stage timeout
 *   @property {boolean} house_rules.analysis_enabled - Show AI analysis during play
 *   @property {boolean} house_rules.concealed_bonus_enabled - Double score for concealed win
 *   @property {boolean} house_rules.dealer_bonus_enabled - Bonus for dealer (East) win
 * @property {CharlestonState | null} charleston_state - Charleston phase state or null if not in Charleston
 * @property {Array} players - All player seats in turn order with metadata
 *   @property {Seat} players[].seat - Player's seat
 *   @property {string} players[].player_id - Unique player identifier
 *   @property {boolean} players[].is_bot - Whether player is bot-controlled
 *   @property {PlayerStatus} players[].status - Player status (Active/Dead/Disconnected)
 *   @property {number} players[].tile_count - Tiles in concealed hand
 *   @property {Meld[]} players[].exposed_melds - Visible declared melds
 * @property {number} remaining_tiles - Tiles left in wall to draw from
 * @property {bigint} wall_seed - Random seed for wall generation (for replay)
 * @property {number} wall_draw_index - Current draw position in wall
 * @property {number} wall_break_point - Break point (last legal draw position)
 * @property {number} wall_tiles_remaining - Tiles still in wall (for counter display)
 * @property {LocalDiscardInfo[]} discard_pile - All discarded tiles with metadata (tile, player, turn, safe, called)
 * @property {Record<Seat, Meld[]>} [exposed_melds] - Alternative meld display per seat (used in some phases)
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
interface WebSocketLike {
  send: (data: string) => void;
  addEventListener: (event: string, handler: (e: MessageEvent) => void) => void;
  removeEventListener: (event: string, handler: (e: MessageEvent) => void) => void;
}

// Feature flags removed - Phase 5 complete: Event bridge + phase components fully integrated
// Old envelope types removed - now handled by useGameEvents hook

/**
 * GameBoard is the main game container
 */
export const GameBoard: FC<GameBoardProps> = ({ initialState, ws, socket }) => {
  const currentRoom = useRoomStore((state) => state.currentRoom);
  const internalSocket = useGameSocket({ enabled: !ws && !socket });
  const socketClient = socket ?? internalSocket;
  const overlays = useGameBoardOverlays({ socketClient, ws });
  const { eventBridgeResult, gameState, usingInternalSocket, interactionsDisabled, sendCommand } =
    useGameBoardBridge({
      ws,
      socketClient,
      initialState,
      dispatchUIAction: overlays.dispatchUIAction,
      currentRoom,
    });

  const phase = useGamePhase(gameState);

  if (!gameState) {
    if (currentRoom) {
      return (
        <div
          className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-900 px-6 text-white"
          data-testid="room-waiting"
        >
          <h1 className="text-3xl font-bold">Room {currentRoom.room_id}</h1>
          <p className="text-center text-gray-300">Waiting for players and initial game state...</p>
        </div>
      );
    }

    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="text-xl">Loading game...</div>
      </div>
    );
  }

  if (usingInternalSocket && socketClient.recoveryAction === 'return_login') {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-900 px-6 text-white"
        data-testid="login-screen-placeholder"
      >
        <h1 className="text-3xl font-bold">Login</h1>
        <p className="text-center text-gray-300">
          {socketClient.recoveryMessage ?? 'Session expired. Please log in again.'}
        </p>
      </div>
    );
  }

  if (usingInternalSocket && socketClient.recoveryAction === 'return_lobby') {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-900 px-6 text-white"
        data-testid="reconnect-lobby-placeholder"
      >
        <h1 className="text-3xl font-bold">Lobby</h1>
        <p className="text-center text-gray-300">
          {socketClient.recoveryMessage ?? 'Unable to restore game. Returned to lobby.'}
        </p>
      </div>
    );
  }

  if (overlays.hasLeftGame) {
    return (
      <div
        className="flex min-h-screen flex-col items-center justify-center gap-3 bg-gray-900 text-white"
        data-testid="lobby-screen-placeholder"
      >
        <h1 className="text-3xl font-bold">Lobby</h1>
        {/* Toast notification (AC-6 US-031): auto-dismisses after 4 s */}
        {overlays.showLeaveToast && (
          <div
            className="fixed bottom-6 right-6 z-50 rounded-lg bg-green-700 px-5 py-3 text-white shadow-lg"
            role="status"
            aria-live="polite"
            data-testid="leave-toast"
          >
            You left the game.
          </div>
        )}
      </div>
    );
  }

  const {
    isCharleston,
    charlestonStage,
    isSetupPhase,
    setupStage,
    isPlaying,
    turnStage,
    isEastBot,
    totalTiles,
    stacksPerWallInitial,
    stacksPerWallDisplay,
    wallBreakIndex,
    wallDrawIndex,
  } = phase;

  return (
    <div
      className="dark relative w-full h-screen bg-gradient-to-br from-green-800 to-green-900"
      data-testid="game-board"
      role="main"
      aria-label="Mahjong game board"
    >
      {usingInternalSocket && (
        <ConnectionStatus
          isReconnecting={socketClient.isReconnecting}
          reconnectAttempt={socketClient.reconnectAttempt}
          canManualRetry={socketClient.canManualRetry}
          onRetryNow={socketClient.retryNow}
          showReconnectedToast={socketClient.showReconnectedToast}
        />
      )}
      {interactionsDisabled && (
        <div
          className="absolute inset-0 z-[60] cursor-not-allowed bg-transparent"
          aria-hidden="true"
          data-testid="disconnect-interaction-lock"
        />
      )}

      {/* Wall Counter */}
      <WallCounter
        remainingTiles={gameState.wall_tiles_remaining}
        totalTiles={totalTiles}
        isDeadWall={false}
      />

      <div className="absolute right-4 top-4 z-30 w-64 bg-black/20 p-2 rounded-md">
        <HouseRulesPanel rules={gameState.house_rules} onChange={() => {}} readOnly />
      </div>

      {/* Walls */}
      <Wall
        position="north"
        stackCount={stacksPerWallDisplay}
        initialStacks={stacksPerWallInitial}
      />
      <Wall
        position="south"
        stackCount={stacksPerWallDisplay}
        initialStacks={stacksPerWallInitial}
      />
      <Wall
        position="east"
        stackCount={stacksPerWallDisplay}
        initialStacks={stacksPerWallInitial}
        breakIndex={wallBreakIndex}
        drawIndex={wallDrawIndex}
      />
      <Wall
        position="west"
        stackCount={stacksPerWallDisplay}
        initialStacks={stacksPerWallInitial}
      />

      {/* Setup Phase */}
      {isSetupPhase && setupStage && (
        <SetupPhase
          key={`setup-${eventBridgeResult.snapshotRevision}`}
          gameState={gameState}
          stage={setupStage}
          sendCommand={sendCommand}
          diceRoll={overlays.diceRoll}
          showDiceOverlay={overlays.showDiceOverlay}
          onDiceOverlayClose={overlays.handleDiceComplete}
          onLeaveConfirmed={overlays.handleLeaveConfirmed}
        />
      )}

      {/* Playing Phase */}
      {isPlaying && turnStage && (
        <PlayingPhase
          key={`playing-${eventBridgeResult.snapshotRevision}`}
          gameState={gameState}
          turnStage={turnStage}
          currentTurn={gameState.current_turn}
          sendCommand={sendCommand}
          onLeaveConfirmed={overlays.handleLeaveConfirmed}
          eventBus={eventBridgeResult.eventBus}
        />
      )}

      {/* Charleston Phase */}
      {isCharleston && charlestonStage && (
        <CharlestonPhase
          key={`charleston-${eventBridgeResult.snapshotRevision}`}
          gameState={gameState}
          stage={charlestonStage}
          sendCommand={sendCommand}
          onLeaveConfirmed={overlays.handleLeaveConfirmed}
          eventBus={eventBridgeResult.eventBus}
        />
      )}

      {/* Bot rolling message */}
      {isSetupPhase &&
        setupStage === 'RollingDice' &&
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
      {overlays.heavenlyHand && (
        <Dialog open>
          <DialogContent
            className="flex max-w-fit flex-col items-center gap-4 rounded-2xl border-2 border-yellow-400 bg-gray-900 px-10 py-8 shadow-2xl [&>button]:hidden"
            data-testid="heavenly-hand-overlay"
            role="dialog"
            aria-modal="true"
            aria-label="Heavenly Hand"
            onEscapeKeyDown={(event) => event.preventDefault()}
            onPointerDownOutside={(event) => event.preventDefault()}
          >
            <h2 className="text-4xl font-bold text-yellow-400">Heavenly Hand!</h2>
            <p className="text-center text-gray-300">East wins with the initial deal!</p>
            <div className="rounded-lg bg-gray-800 px-6 py-3 text-center">
              <p className="font-semibold text-green-300">{overlays.heavenlyHand.pattern}</p>
              <p className="font-medium text-yellow-300">
                {overlays.heavenlyHand.base_score} points
              </p>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Draw Overlay (US-021: wall exhaustion or game abandoned) */}
      <DrawOverlay
        show={overlays.showDrawOverlay}
        reason={overlays.drawReason}
        remainingTiles={overlays.wallTilesAtExhaustion}
        onAcknowledge={overlays.handleDrawAcknowledge}
      />

      {/* Draw Scoring Screen (US-021: shown after DrawOverlay for draw games) */}
      <DrawScoringScreen
        isOpen={overlays.showDrawScoringScreen}
        reason={overlays.drawReason}
        currentScores={overlays.gameResult?.final_scores ?? {}}
        onContinue={overlays.handleDrawScoringContinue}
      />

      {/* Winner Celebration Overlay */}
      <WinnerCelebration
        isOpen={overlays.winnerCelebration !== null}
        winnerName={overlays.winnerCelebration?.winnerName ?? ''}
        winnerSeat={overlays.winnerCelebration?.winnerSeat ?? 'East'}
        patternName={overlays.winnerCelebration?.patternName ?? ''}
        handValue={overlays.winnerCelebration?.handValue}
        onContinue={overlays.handleWinnerCelebrationContinue}
      />

      {/* Scoring Screen - only shown after celebration completes (winnerCelebration must be null) */}
      <ScoringScreen
        isOpen={
          overlays.showScoringScreen &&
          overlays.gameResult !== null &&
          overlays.winnerCelebration === null
        }
        result={
          overlays.gameResult ?? {
            winner: null,
            winning_pattern: null,
            score_breakdown: null,
            final_scores: {},
            final_hands: {},
            next_dealer: 'East',
            end_condition: 'WallExhausted',
          }
        }
        winnerName={overlays.gameResult?.winner ?? '-'}
        isSelfDraw={overlays.calledFrom === null}
        calledFrom={overlays.calledFrom ?? undefined}
        onContinue={overlays.handleScoringContinue}
      />

      {/* Game Over Panel */}
      <GameOverPanel
        isOpen={overlays.showGameOverPanel && overlays.gameResult !== null}
        result={
          overlays.gameResult ?? {
            winner: null,
            winning_pattern: null,
            score_breakdown: null,
            final_scores: {},
            final_hands: {},
            next_dealer: 'East',
            end_condition: 'WallExhausted',
          }
        }
        onNewGame={overlays.handleGameOverClose}
        onReturnToLobby={overlays.handleGameOverClose}
      />
    </div>
  );
};

GameBoard.displayName = 'GameBoard';
