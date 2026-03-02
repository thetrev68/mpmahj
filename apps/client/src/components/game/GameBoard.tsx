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
import { useGameBoardBridge, type WebSocketLike } from './useGameBoardBridge';
import { useGameBoardOverlays } from './useGameBoardOverlays';
import { useGamePhase } from './useGamePhase';
import type { ClientGameState, LocalDiscardInfo } from '@/types/clientGameState';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';

// Re-export client state types for consumers that import them from this module.
// New code should import directly from '@/types/clientGameState'.
export type { ClientGameState as GameState, LocalDiscardInfo };

interface GameBoardProps {
  /** Initial raw server snapshot (for testing) */
  initialState?: GameStateSnapshot;
  /** WebSocket instance (for testing) */
  ws?: WebSocketLike;
  /** Shared game socket from parent app */
  socket?: UseGameSocketReturn;
}

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
  } = phase;

  return (
    <div
      className="dark relative w-full h-screen bg-[image:var(--table-felt-gradient)]"
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

      <div
        className={`absolute right-4 ${isCharleston ? 'top-20' : 'top-4'} z-30 w-64 rounded-md bg-black/20 p-2`}
      >
        <HouseRulesPanel rules={gameState.house_rules} onChange={() => {}} readOnly />
      </div>

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
