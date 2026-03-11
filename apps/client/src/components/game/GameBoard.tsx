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

import { type FC, useCallback, useState } from 'react';
import { RotateCcw, Settings, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { LeaveConfirmationDialog } from './LeaveConfirmationDialog';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { LEAVE_FORFEIT_OVERLAY_DURATION_MS } from '@/lib/constants';
import { getActionBarPhaseMeta } from './ActionBarDerivations';
import { useGameSocket, type UseGameSocketReturn } from '@/hooks/useGameSocket';
import { useRoomStore } from '@/stores/roomStore';
import { clearStoredSession } from '@/hooks/gameSocketStorage';
import { useGameBoardBridge, type WebSocketLike } from './useGameBoardBridge';
import { useGameBoardOverlays } from './useGameBoardOverlays';
import { useGamePhase } from './useGamePhase';
import type { ClientGameState, LocalDiscardInfo } from '@/types/clientGameState';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import { signOutFromSupabase } from '@/lib/supabaseAuth';

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
  const resetLobbyState = useRoomStore((state) => state.resetLobbyState);
  const internalSocket = useGameSocket({ enabled: !ws && !socket });
  const socketClient = socket ?? internalSocket;
  const overlays = useGameBoardOverlays({ socketClient, ws });
  const { eventBridgeResult, gameState, usingInternalSocket, interactionsDisabled, sendCommand } =
    useGameBoardBridge({
      ws,
      socketClient,
      initialState,
    });

  const phase = useGamePhase(gameState);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [leaveButtonLocked, setLeaveButtonLocked] = useState(false);
  const [showSoundSettings, setShowSoundSettings] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const resetToLobby = useCallback(
    (noticeMessage: string) => {
      clearStoredSession();
      resetLobbyState({
        tone: 'success',
        message: noticeMessage,
      });

      if (!ws) {
        socketClient.disconnect();
        socketClient.clearRecoveryAction();
        socketClient.connect();
      }
    },
    [resetLobbyState, socketClient, ws]
  );

  const handleOpenLeaveDialog = useCallback(() => {
    if (interactionsDisabled || leaveButtonLocked || isLeaving) return;
    setLeaveButtonLocked(true);
    setShowLeaveDialog(true);
  }, [interactionsDisabled, isLeaving, leaveButtonLocked]);

  const handleCancelLeave = useCallback(() => {
    setShowLeaveDialog(false);
    setLeaveButtonLocked(false);
  }, []);

  const handleConfirmLeave = useCallback(() => {
    if (!gameState || isLeaving) return;
    setShowLeaveDialog(false);
    setIsLeaving(true);
    sendCommand({ LeaveGame: { player: gameState.your_seat } });
    setTimeout(() => {
      setIsLeaving(false);
      setLeaveButtonLocked(false);
      resetToLobby('You left the game and can start a new one.');
    }, LEAVE_FORFEIT_OVERLAY_DURATION_MS);
  }, [gameState, isLeaving, resetToLobby, sendCommand]);

  const handleStartOver = useCallback(() => {
    if (interactionsDisabled || isLeaving || isLoggingOut) {
      return;
    }
    setShowLeaveDialog(true);
    setLeaveButtonLocked(true);
  }, [interactionsDisabled, isLeaving, isLoggingOut]);

  const handleLogOut = useCallback(async () => {
    if (interactionsDisabled || isLeaving || isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);

    try {
      if (gameState) {
        sendCommand({ LeaveGame: { player: gameState.your_seat } });
      }
      await signOutFromSupabase();
    } finally {
      clearStoredSession();
      resetLobbyState({
        tone: 'info',
        message: 'You have been logged out.',
      });
      if (!ws) {
        socketClient.disconnect();
        socketClient.connect();
      }
      setIsLoggingOut(false);
    }
  }, [
    gameState,
    interactionsDisabled,
    isLeaving,
    isLoggingOut,
    resetLobbyState,
    sendCommand,
    socketClient,
    ws,
  ]);

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
  const isCriticalPhase = getActionBarPhaseMeta(
    gameState.phase,
    gameState.your_seat
  ).isCriticalPhase;

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
        className="absolute right-4 top-4 z-40 flex items-center gap-2"
        data-testid="board-controls-strip"
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label={showSoundSettings ? 'Hide sound settings' : 'Show sound settings'}
          data-testid="board-settings-button"
          onClick={() => setShowSoundSettings((prev) => !prev)}
        >
          <Settings className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-amber-400/70 text-amber-100 hover:bg-amber-900/60"
          data-testid="start-over-button"
          aria-label="Start over from the lobby"
          onClick={handleStartOver}
          disabled={interactionsDisabled || isLeaving || isLoggingOut}
        >
          <RotateCcw className="h-4 w-4" />
          Start Over
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-red-500/70 text-red-200 hover:bg-red-900/60"
          data-testid="leave-game-button"
          aria-label="Leave game (marks you disconnected)"
          onClick={handleOpenLeaveDialog}
          disabled={interactionsDisabled || isLeaving || isLoggingOut}
        >
          <LogOut className="h-4 w-4" />
          Leave Game
        </Button>
        <Button
          type="button"
          variant="outline"
          className="border-slate-400/70 text-slate-100 hover:bg-slate-800/70"
          data-testid="logout-button"
          aria-label="Log out"
          onClick={() => {
            void handleLogOut();
          }}
          disabled={interactionsDisabled || isLeaving || isLoggingOut}
        >
          <LogOut className="h-4 w-4" />
          {isLoggingOut ? 'Logging Out...' : 'Log Out'}
        </Button>
      </div>

      {showSoundSettings && (
        <div
          className="absolute right-4 top-16 z-30 w-64 rounded-md bg-black/80 p-4 text-sm text-white shadow-lg"
          data-testid="sound-settings-placeholder"
        >
          <p>Sound settings coming soon</p>
          <p className="mt-2 text-xs text-white/70">
            TODO: add Auto-sort hand to this settings surface.
          </p>
        </div>
      )}

      <LeaveConfirmationDialog
        isOpen={showLeaveDialog}
        isLoading={isLeaving}
        isCriticalPhase={isCriticalPhase}
        onConfirm={handleConfirmLeave}
        onCancel={handleCancelLeave}
      />
      {isLeaving && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 text-lg text-white"
          data-testid="leave-loading-overlay"
          role="status"
          aria-live="polite"
        >
          Leaving game...
        </div>
      )}

      <div
        className="flex h-full w-full px-4 pb-4 pt-16 lg:items-center lg:justify-start lg:gap-6"
        data-testid="game-board-layout"
      >
        <div
          className="relative h-full w-full lg:h-[min(90vh,calc(100vw-22rem))] lg:max-h-[1200px] lg:max-w-[1200px] lg:aspect-square"
          data-testid="square-board-container"
        >
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
            />
          )}
        </div>
        <div
          className="right-rail hidden w-64 flex-shrink-0 lg:block"
          data-testid="right-rail"
          aria-hidden="true"
        />
      </div>

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
