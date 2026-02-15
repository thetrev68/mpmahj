/**
 * @module PlayingPhase
 *
 * Self-contained orchestrator for the Playing phase (main game loop) where players draw, discard,
 * call for melds, and attempt to win. Extracted from GameBoard as phase-specific component.
 *
 * Key features:
 * - **Turn management**: Displays current turn, tracks draw/discard sequence
 * - **Hand display**: Concealed hand with tile selection and discard buttons
 * - **Call window**: Shows when other players can call the discard
 * - **Call resolution**: Dialog for choosing which meld to claim (Pung/Kong/Quint)
 * - **Melds**: Shows opponent exposed melds with caller indicators
 * - **Mahjong**: Declare mahjong with validation dialog
 * - **Dead hands**: Tracks and displays players with dead hands
 * - **History & replay**: Move browser with timeline scrubber, undo voting
 * - **AI hints**: Discard recommendations with toggle panel
 * - **Animations & audio**: Tile movement, celebration, sound effects
 * - **Joker exchange**: Dialog for replacing Joker during play
 *
 * Event bus pattern: Listens for game events (TilesDrawn, TileDiscarded, PlayerCalled, etc.)
 * to update local UI state. Phase components manage their own state independently to reduce
 * data flow complexity.
 *
 * @see {@link src/components/game/GameBoard.tsx} for game orchestration
 * @see {@link src/hooks/usePlayingPhaseState.ts} for state management
 * @see {@link src/hooks/useCallWindowState.ts} for call window logic
 */

import { useEffect, useCallback, useMemo, useState, useRef } from 'react';
import { TurnIndicator } from '../TurnIndicator';
import { DiscardPool } from '../DiscardPool';
import { DiscardAnimationLayer } from '../DiscardAnimationLayer';
import { CallWindowPanel } from '../CallWindowPanel';
import { CallResolutionOverlay } from '../CallResolutionOverlay';
import { ExposedMeldsArea } from '../ExposedMeldsArea';
import { ConcealedHand } from '../ConcealedHand';
import { ActionBar } from '../ActionBar';
import { MahjongConfirmationDialog } from '../MahjongConfirmationDialog';
import { MahjongValidationDialog } from '../MahjongValidationDialog';
import { DeadHandOverlay } from '../DeadHandOverlay';
import { JokerExchangeDialog } from '../JokerExchangeDialog';
import { UpgradeConfirmationDialog } from '../UpgradeConfirmationDialog';
import { HistoryPanel } from '../HistoryPanel';
import { HistoricalViewBanner } from '../HistoricalViewBanner';
import { TimelineScrubber } from '../TimelineScrubber';
import { ResumeConfirmationDialog } from '../ResumeConfirmationDialog';
import { UndoVotePanel } from '../UndoVotePanel';
import { HintPanel } from '../HintPanel';
import { HintSettingsSection } from '../HintSettingsSection';
import { AnimationSettings } from '../AnimationSettings';
import { useAutoDraw } from '@/hooks/useAutoDraw';
import { useCallWindowState } from '@/hooks/useCallWindowState';
import { useCountdown } from '@/hooks/useCountdown';
import { useGameAnimations } from '@/hooks/useGameAnimations';
import { useHintSystem } from '@/hooks/useHintSystem';
import { useHistoryPlayback } from '@/hooks/useHistoryPlayback';
import { useMahjongDeclaration } from '@/hooks/useMahjongDeclaration';
import { useMeldActions } from '@/hooks/useMeldActions';
import { usePlayingPhaseState } from '@/hooks/usePlayingPhaseState';
import { useTileSelection } from '@/hooks/useTileSelection';
import { useAnimationSettings } from '@/hooks/useAnimationSettings';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { calculateCallIntent } from '@/lib/game-logic/callIntentCalculator';
import { getTileName } from '@/lib/utils/tileUtils';
import { buildTileInstances, selectedIdsToTiles } from '@/lib/utils/tileSelection';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { UIStateAction } from '@/lib/game-events/types';

const SOLO_UNDO_LIMIT = 10;

/**
 * Props for the PlayingPhase component.
 *
 * @interface PlayingPhaseProps
 * @property {GameStateSnapshot} gameState - Current game state snapshot from server.
 *   Used to initialize turn indicator, hand, melds, and discard pool display.
 *   @see {@link src/types/bindings/generated/GameStateSnapshot.ts}
 * @property {TurnStage} turnStage - Current turn stage (Drawing or DiscardingOrCalling).
 *   Determines available actions (draw-only or discard/call/mahjong).
 *   @see {@link src/types/bindings/generated/TurnStage.ts}
 * @property {Seat} currentTurn - Active player's seat. Used to highlight turn indicator.
 * @property {(cmd: GameCommand) => void} sendCommand - Callback to send game commands (discard, call, mahjong declare).
 * @property {() => void} [onLeaveConfirmed] - Optional callback when player confirms leaving game.
 * @property {Object} [eventBus] - Optional event emitter for cross-component messaging.
 *   - `on(event, handler)`: Register listener, returns unsubscribe function
 *   - Used to coordinate multi-player state changes (e.g., TilesDrawn, CharlestonPhaseChanged)
 */
export interface PlayingPhaseProps {
  gameState: GameStateSnapshot;
  turnStage: TurnStage;
  currentTurn: Seat;
  sendCommand: (cmd: GameCommand) => void;
  onLeaveConfirmed?: () => void;
  eventBus?: {
    on: (event: string, handler: (data: unknown) => void) => () => void;
  };
}

/**
 * PlayingPhase component
 *
 * Manages all Playing phase UI and interactions:
 * - Turn indicator
 * - Discard pool display
 * - Call window (declare intent, pass)
 * - Call resolution overlay
 * - Exposed melds display
 * - Concealed hand (discard mode)
 * - Action bar (discard, declare mahjong)
 * - Discard animation
 *
 * @example
 * ```tsx
 * <PlayingPhase
 *   gameState={gameState}
 *   turnStage={{ Discarding: 'East' }}
 *   currentTurn="East"
 *   sendCommand={(cmd) => ws.send(JSON.stringify({ kind: 'Command', payload: cmd }))}
 * />
 * ```
 */
export function PlayingPhase({
  gameState,
  turnStage,
  currentTurn,
  sendCommand,
  onLeaveConfirmed,
  eventBus,
}: PlayingPhaseProps) {
  const callWindow = useCallWindowState();
  const playing = usePlayingPhaseState();
  const animations = useGameAnimations();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [forfeitedPlayers, setForfeitedPlayers] = useState<Set<Seat>>(new Set());
  const {
    settings: animationSettings,
    updateSettings: updateAnimationSettings,
    getDuration,
    isEnabled,
    prefersReducedMotion,
  } = useAnimationSettings();
  const tileMovementEnabledRef = useRef(isEnabled('tile_movement'));
  const incomingAnimationDurationRef = useRef(getDuration(1500));

  useEffect(() => {
    tileMovementEnabledRef.current = isEnabled('tile_movement');
    incomingAnimationDurationRef.current = getDuration(1500);
  }, [getDuration, isEnabled]);

  const isMyTurn = currentTurn === gameState.your_seat;
  const isDiscardingStage = typeof turnStage === 'object' && 'Discarding' in turnStage && isMyTurn;
  const isDrawingStage = typeof turnStage === 'object' && 'Drawing' in turnStage;

  const meldActions = useMeldActions({
    gameState,
    isDiscardingStage,
    sendCommand,
  });
  const historyPlayback = useHistoryPlayback({
    gameState,
    sendCommand,
    eventBus,
    playingIsProcessing: playing.isProcessing,
  });
  const hintSystem = useHintSystem({
    gameState,
    isDiscardingStage,
    isHistoricalView: historyPlayback.isHistoricalView,
    forfeitedPlayers,
    sendCommand,
  });
  const mahjong = useMahjongDeclaration({
    gameState,
    sendCommand,
    setPlayingProcessing: playing.setProcessing,
    closeCallWindow: callWindow.closeCallWindow,
  });
  const autoDraw = useAutoDraw({
    isMyTurn,
    isDrawingStage,
    mySeat: gameState.your_seat,
    sendCommand,
  });

  // Mahjong can be declared when discarding with a full 14-tile hand (dead hand players cannot)
  const canDeclareMahjong =
    isDiscardingStage &&
    gameState.your_hand.length === 14 &&
    !mahjong.deadHandPlayers.has(gameState.your_seat) &&
    !forfeitedPlayers.has(gameState.your_seat);
  const combinedHighlightedIds = useMemo(
    () =>
      isEnabled('tile_movement')
        ? Array.from(new Set([...animations.highlightedTileIds, ...hintSystem.hintHighlightedIds]))
        : [],
    [animations.highlightedTileIds, hintSystem.hintHighlightedIds, isEnabled]
  );

  const handTileInstances = useMemo(
    () => buildTileInstances(gameState.your_hand),
    [gameState.your_hand]
  );

  const { selectedIds, toggleTile, clearSelection } = useTileSelection({
    maxSelection: 1,
    disabledIds: [],
  });

  useEffect(() => {
    if (!eventBus) return;

    const unsub = eventBus.on('ui-action', (data: unknown) => {
      const action = data as UIStateAction;
      switch (action.type) {
        case 'OPEN_CALL_WINDOW':
          if (!mahjong.isDeadHand(gameState.your_seat)) {
            callWindow.openCallWindow(action.params);
          }
          break;
        case 'UPDATE_CALL_WINDOW_PROGRESS':
          callWindow.updateProgress(action.canAct, action.intents);
          break;
        case 'CLOSE_CALL_WINDOW':
          callWindow.closeCallWindow();
          break;
        case 'MARK_CALL_WINDOW_RESPONDED':
          callWindow.markResponded(action.message);
          break;
        case 'SHOW_RESOLUTION_OVERLAY':
          playing.showResolutionOverlay(action.data);
          break;
        case 'DISMISS_RESOLUTION_OVERLAY':
          playing.dismissResolutionOverlay();
          break;
        case 'SET_MOST_RECENT_DISCARD':
          playing.setMostRecentDiscard(action.tile);
          break;
        case 'SET_DISCARD_ANIMATION_TILE':
          playing.setDiscardAnimation(action.tile);
          break;
        case 'SET_IS_PROCESSING':
          playing.setProcessing(action.value);
          break;
        case 'SET_INCOMING_FROM_SEAT':
          if (tileMovementEnabledRef.current) {
            animations.setIncomingFromSeat(action.seat, incomingAnimationDurationRef.current);
          } else {
            animations.setIncomingFromSeat(null);
          }
          break;
        case 'CLEAR_SELECTION':
          clearSelection();
          break;
        case 'SET_ERROR_MESSAGE':
          setErrorMessage(action.message);
          meldActions.handleUiAction(action);
          historyPlayback.clearPendingUndoOnError(action.message);
          break;
        case 'CLEAR_PENDING_DRAW_RETRY':
          autoDraw.clearPendingDrawRetry();
          break;
        case 'SET_PLAYER_FORFEITED':
          setForfeitedPlayers((prev) => new Set([...prev, action.player]));
          mahjong.handleUiAction(action);
          break;
        default:
          if (mahjong.handleUiAction(action)) break;
          if (meldActions.handleUiAction(action)) break;
          break;
      }
    });

    return unsub;
  }, [
    animations,
    autoDraw,
    callWindow,
    clearSelection,
    eventBus,
    gameState.your_seat,
    historyPlayback,
    mahjong,
    meldActions,
    playing,
  ]);

  useEffect(() => {
    if (!eventBus) return;

    const unsubscribe = eventBus.on('server-event', (data: unknown) => {
      if (hintSystem.handleServerEvent(data)) return;
      historyPlayback.handleServerEvent(data);
    });

    return unsubscribe;
  }, [eventBus, hintSystem, historyPlayback]);

  useEffect(() => {
    playing.reset();
    animations.clearAllAnimations();
    clearSelection();
    hintSystem.resetForTurnChange();
    autoDraw.resetDrawRetry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTurn]);

  const callWindowDeadlineMs = useMemo(() => {
    if (!callWindow.callWindow) return null;
    return callWindow.callWindow.timerStart + callWindow.callWindow.timerDuration * 1000;
  }, [callWindow.callWindow]);
  const handleCallWindowExpire = useCallback(() => {
    if (!callWindow.callWindow || callWindow.callWindow.hasResponded) return;
    sendCommand({ Pass: { player: gameState.your_seat } });
    callWindow.markResponded('Time expired - auto-passed');
  }, [callWindow, gameState.your_seat, sendCommand]);
  const callWindowSecondsRemaining = useCountdown({
    deadlineMs: callWindowDeadlineMs,
    intervalMs: 500,
    onExpire: handleCallWindowExpire,
  });

  useEffect(() => {
    callWindow.setTimerRemaining(callWindowSecondsRemaining);
  }, [callWindow, callWindowSecondsRemaining]);

  const callEligibility = useMemo(() => {
    if (!callWindow.callWindow) {
      return {
        canCallForPung: false,
        canCallForKong: false,
        canCallForQuint: false,
        canCallForSextet: false,
        canCallForMahjong: true, // Can always try for Mahjong
      };
    }

    const tile = callWindow.callWindow.tile;
    const tileCounts = new Map<Tile, number>();

    // Count tiles in hand
    for (const handTile of gameState.your_hand) {
      tileCounts.set(handTile, (tileCounts.get(handTile) || 0) + 1);
    }

    // Calculate eligibility for each meld type
    const pung = calculateCallIntent({ tile, tileCounts, intent: 'Pung' });
    const kong = calculateCallIntent({ tile, tileCounts, intent: 'Kong' });
    const quint = calculateCallIntent({ tile, tileCounts, intent: 'Quint' });
    const sextet = calculateCallIntent({ tile, tileCounts, intent: 'Sextet' });

    return {
      canCallForPung: pung.success,
      canCallForKong: kong.success,
      canCallForQuint: quint.success,
      canCallForSextet: sextet.success,
      canCallForMahjong: true, // Can always try for Mahjong
    };
  }, [callWindow.callWindow, gameState.your_hand]);

  const handleCallIntent = useCallback(
    (intent: 'Mahjong' | 'Pung' | 'Kong' | 'Quint' | 'Sextet') => {
      if (forfeitedPlayers.has(gameState.your_seat)) return;
      if (!callWindow.callWindow || callWindow.callWindow.hasResponded) return;

      const tile = callWindow.callWindow.tile;

      if (intent === 'Mahjong') {
        sendCommand({
          DeclareCallIntent: {
            player: gameState.your_seat,
            intent: 'Mahjong',
          },
        });
        historyPlayback.pushUndoAction('Declared Mahjong call intent');
        callWindow.markResponded('Declared Mahjong');
        return;
      }

      const tileCounts = new Map<Tile, number>();
      for (const handTile of gameState.your_hand) {
        tileCounts.set(handTile, (tileCounts.get(handTile) || 0) + 1);
      }

      const result = calculateCallIntent({ tile, tileCounts, intent });

      if (result.success && result.meldTiles) {
        sendCommand({
          DeclareCallIntent: {
            player: gameState.your_seat,
            intent: {
              Meld: {
                meld_type: intent,
                tiles: result.meldTiles,
                called_tile: tile,
                joker_assignments: {},
              },
            },
          },
        });
        historyPlayback.pushUndoAction(`Called for ${intent}`);
      }

      callWindow.markResponded(`Declared intent to call for ${intent}`);
    },
    [
      callWindow,
      gameState.your_seat,
      gameState.your_hand,
      historyPlayback,
      sendCommand,
      forfeitedPlayers,
    ]
  );

  const handlePass = useCallback(() => {
    if (forfeitedPlayers.has(gameState.your_seat)) return;
    if (!callWindow.callWindow || callWindow.callWindow.hasResponded) return;

    const message = `Passed on ${getTileName(callWindow.callWindow.tile)}`;
    sendCommand({ Pass: { player: gameState.your_seat } });
    historyPlayback.pushUndoAction(message);
    setErrorMessage(message);
    callWindow.closeCallWindow();
  }, [callWindow, gameState.your_seat, historyPlayback, sendCommand, forfeitedPlayers]);

  useEffect(() => {
    if (playing.discardAnimationTile !== null && !isEnabled('tile_movement')) {
      playing.setDiscardAnimation(null);
    }
  }, [isEnabled, playing, playing.discardAnimationTile]);

  return (
    <>
      {/* Turn Indicator (dead hand badges shown for all dead-hand players - US-020 AC-5) */}
      <TurnIndicator
        currentSeat={currentTurn}
        stage={turnStage}
        isMyTurn={isMyTurn}
        deadHandSeats={Array.from(mahjong.deadHandPlayers)}
      />

      {/* Draw retry / failure feedback (initial "drawing" status shown by ActionBar) */}
      {isMyTurn &&
        isDrawingStage &&
        autoDraw.drawStatus !== null &&
        autoDraw.drawStatus !== 'drawing' && (
          <div
            className="fixed top-[135px] left-1/2 -translate-x-1/2 bg-red-900/80 text-red-100 text-sm px-4 py-2 rounded"
            role="alert"
          >
            {typeof autoDraw.drawStatus === 'object' &&
              `Failed to draw tile. Retrying... ${autoDraw.drawStatus.retrying}/3`}
            {autoDraw.drawStatus === 'failed' &&
              'Failed to draw tile after 3 attempts. Please refresh.'}
          </div>
        )}

      {/* Discard Pool */}
      <DiscardPool
        discards={gameState.discard_pile.map((d, index) => ({
          tile: d.tile,
          discardedBy: d.discarded_by,
          turn: index + 1,
        }))}
        mostRecentTile={playing.mostRecentDiscard ?? undefined}
        callableTile={callWindow.callWindow?.tile}
      />

      {/* Exposed Melds (for each player) */}
      {gameState.players.map((player) => (
        <ExposedMeldsArea
          key={player.seat}
          melds={player.exposed_melds}
          compact={player.seat !== gameState.your_seat}
          ownerSeat={player.seat}
          upgradeableMeldIndices={
            player.seat === gameState.your_seat && !historyPlayback.isHistoricalView
              ? meldActions.upgradeableMeldIndices
              : []
          }
          onMeldClick={
            player.seat === gameState.your_seat ? meldActions.handleMeldClick : undefined
          }
        />
      ))}

      {/* Concealed Hand */}
      <ConcealedHand
        tiles={handTileInstances}
        mode={historyPlayback.isHistoricalView ? 'view-only' : 'discard'}
        selectedTileIds={selectedIds}
        onTileSelect={toggleTile}
        maxSelection={1}
        disabled={
          historyPlayback.isHistoricalView ||
          !isDiscardingStage ||
          playing.isProcessing ||
          forfeitedPlayers.has(gameState.your_seat)
        }
        highlightedTileIds={combinedHighlightedIds}
        incomingFromSeat={animations.incomingFromSeat}
        leavingTileIds={animations.leavingTileIds}
      />
      {historyPlayback.isHistoricalView && (
        <div
          className="fixed bottom-32 left-1/2 z-20 -translate-x-1/2 rounded bg-slate-950/90 px-3 py-1 text-xs text-slate-100"
          role="status"
          aria-live="polite"
        >
          Read-only mode - viewing history
        </div>
      )}

      {/* Action Bar */}
      <div role="group" aria-label="action bar">
        <ActionBar
          phase={{ Playing: turnStage }}
          mySeat={gameState.your_seat}
          selectedTiles={selectedIdsToTiles(selectedIds)}
          isProcessing={playing.isProcessing}
          canDeclareMahjong={canDeclareMahjong}
          onDeclareMahjong={mahjong.handleDeclareMahjong}
          canExchangeJoker={meldActions.canExchangeJoker}
          onExchangeJoker={meldActions.handleOpenJokerExchange}
          canRequestHint={hintSystem.canRequestHint}
          onOpenHintRequest={hintSystem.openHintRequestDialog}
          isHintRequestPending={hintSystem.hintPending}
          onCommand={(cmd) => {
            sendCommand(cmd);
            if ('DiscardTile' in cmd) {
              historyPlayback.pushUndoAction(`Discarded ${getTileName(cmd.DiscardTile.tile)}`);
              playing.setProcessing(true);
              clearSelection();
            }
            if ('PassTiles' in cmd) {
              historyPlayback.pushUndoAction('Passed tiles');
            }
          }}
          onLeaveConfirmed={onLeaveConfirmed}
          readOnly={historyPlayback.isHistoricalView}
          readOnlyMessage="Historical View - No actions available"
          showSoloUndo={historyPlayback.isSoloGame}
          soloUndoRemaining={historyPlayback.soloUndoRemaining}
          soloUndoLimit={SOLO_UNDO_LIMIT}
          undoRecentActions={historyPlayback.recentUndoableActions}
          undoPending={historyPlayback.undoPending}
          onUndo={historyPlayback.requestSoloUndo}
          showUndoVoteRequest={!historyPlayback.isSoloGame}
          undoVoteRemaining={historyPlayback.multiplayerUndoRemaining}
          onRequestUndoVote={historyPlayback.requestUndoVote}
          disableUndoControls={
            mahjong.mahjongDialogLoading ||
            mahjong.awaitingMahjongValidation !== null ||
            mahjong.mahjongDeclaredMessage !== null
          }
        />
      </div>
      <div className="fixed right-6 top-6 z-30">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => hintSystem.setShowHintSettings(true)}
            data-testid="hint-settings-button"
          >
            Settings
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => historyPlayback.setIsHistoryOpen(true)}
            data-testid="history-button"
          >
            History
          </Button>
        </div>
      </div>

      {hintSystem.showHintPanel && hintSystem.currentHint && (
        <HintPanel
          hint={hintSystem.currentHint}
          verbosity={hintSystem.requestVerbosity}
          onClose={() => {
            hintSystem.setShowHintPanel(false);
            hintSystem.setCurrentHint(null);
          }}
        />
      )}

      {hintSystem.hintPending && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          data-testid="hint-loading-overlay"
          role="status"
          aria-live="polite"
        >
          <div className="space-y-3 rounded-lg border border-cyan-500/60 bg-slate-950 p-6 text-center text-slate-100">
            <p className="text-base font-semibold">AI analyzing your hand... (1-3 seconds)</p>
            <Button
              variant="outline"
              onClick={hintSystem.cancelHintRequest}
              data-testid="cancel-hint-request-button"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={hintSystem.showHintRequestDialog}
        onOpenChange={hintSystem.setShowHintRequestDialog}
      >
        <DialogContent data-testid="hint-request-dialog">
          <DialogHeader>
            <DialogTitle>Request AI Hint</DialogTitle>
            <DialogDescription>Choose how much detail you want in this hint.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select
              value={hintSystem.requestVerbosity}
              onValueChange={(value) =>
                hintSystem.setRequestVerbosity(
                  value as 'Beginner' | 'Intermediate' | 'Expert' | 'Disabled'
                )
              }
            >
              <SelectTrigger data-testid="hint-request-verbosity-select">
                <SelectValue placeholder="Select verbosity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Beginner">Beginner</SelectItem>
                <SelectItem value="Intermediate">Intermediate</SelectItem>
                <SelectItem value="Expert">Expert</SelectItem>
                <SelectItem value="Disabled">Disabled</SelectItem>
              </SelectContent>
            </Select>
            <Button
              onClick={hintSystem.handleRequestHint}
              disabled={hintSystem.requestVerbosity === 'Disabled'}
              data-testid="request-analysis-button"
            >
              Request Analysis
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={hintSystem.showHintSettings} onOpenChange={hintSystem.setShowHintSettings}>
        <DialogContent className="max-w-2xl" data-testid="hint-settings-dialog">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Configure your hint defaults, audio, and animations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <HintSettingsSection
              settings={hintSystem.hintSettings}
              onChange={hintSystem.handleHintSettingsChange}
              onReset={hintSystem.handleResetHintSettings}
              onTestSound={hintSystem.handleTestHintSound}
            />
            <AnimationSettings
              settings={animationSettings}
              onChange={updateAnimationSettings}
              prefersReducedMotion={prefersReducedMotion}
            />
          </div>
          {hintSystem.hintStatusMessage && (
            <p className="text-sm text-cyan-300" data-testid="hint-settings-status">
              {hintSystem.hintStatusMessage}
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Mahjong Confirmation Dialog (self-draw) */}
      <MahjongConfirmationDialog
        isOpen={mahjong.showMahjongDialog}
        hand={gameState.your_hand}
        mySeat={gameState.your_seat}
        isLoading={mahjong.mahjongDialogLoading}
        onConfirm={mahjong.handleMahjongConfirm}
        onCancel={mahjong.handleMahjongCancel}
      />

      {/* Mahjong Validation Dialog (called discard - US-019) */}
      <MahjongValidationDialog
        isOpen={mahjong.awaitingMahjongValidation !== null}
        concealedHand={gameState.your_hand}
        calledTile={mahjong.awaitingMahjongValidation?.calledTile ?? 0}
        discardedBy={mahjong.awaitingMahjongValidation?.discardedBy ?? 'East'}
        mySeat={gameState.your_seat}
        isLoading={mahjong.awaitingValidationLoading}
        onSubmit={mahjong.handleMahjongValidationSubmit}
      />

      {/* Joker Exchange Dialog (US-014/015) */}
      <JokerExchangeDialog
        isOpen={meldActions.showJokerExchangeDialog}
        opportunities={meldActions.jokerExchangeOpportunities}
        isLoading={meldActions.jokerExchangeLoading}
        onExchange={meldActions.handleJokerExchange}
        onClose={meldActions.handleCloseJokerExchange}
      />

      {/* Meld Upgrade Confirmation Dialog (US-016) */}
      {meldActions.upgradeDialogState && (
        <UpgradeConfirmationDialog
          isOpen={true}
          meldType={
            gameState.players.find((p) => p.seat === gameState.your_seat)?.exposed_melds[
              meldActions.upgradeDialogState.meldIndex
            ]?.meld_type ?? 'Pung'
          }
          upgrade={meldActions.upgradeDialogState.upgrade}
          tile={meldActions.upgradeDialogState.tile}
          meldIndex={meldActions.upgradeDialogState.meldIndex}
          mySeat={gameState.your_seat}
          isLoading={meldActions.upgradeDialogLoading}
          onConfirm={meldActions.handleUpgradeConfirm}
          onCancel={meldActions.handleUpgradeCancel}
        />
      )}

      {/* AC-1: Mahjong opportunity message when player has 14-tile winning hand */}
      {canDeclareMahjong && !mahjong.showMahjongDialog && (
        <div
          className="fixed top-[100px] left-1/2 -translate-x-1/2 bg-yellow-900/90 border border-yellow-400 text-yellow-100 px-5 py-2 rounded-lg text-sm text-center z-30"
          data-testid="mahjong-opportunity-message"
          aria-live="polite"
        >
          You have Mahjong! Declare to win or discard to continue.
        </div>
      )}

      {/* Mahjong Declared Announcement (shown to all players) */}
      {mahjong.mahjongDeclaredMessage && (
        <div
          className="fixed top-1/4 left-1/2 -translate-x-1/2 bg-yellow-900/90 border border-yellow-500 text-yellow-200 px-6 py-3 rounded-lg text-center z-40"
          data-testid="mahjong-declared-message"
          aria-live="polite"
        >
          {mahjong.mahjongDeclaredMessage}
        </div>
      )}

      {/* Dead Hand Notice */}
      {mahjong.deadHandNotice && (
        <div
          className="fixed top-1/3 left-1/2 -translate-x-1/2 bg-red-900/90 border border-red-500 text-red-200 px-6 py-3 rounded-lg text-center z-40"
          data-testid="dead-hand-notice"
          aria-live="assertive"
        >
          {mahjong.deadHandNotice}
        </div>
      )}

      {/* Dead Hand Overlay (AC-2: shown to penalized player with acknowledge button) */}
      <DeadHandOverlay
        show={mahjong.showDeadHandOverlay && mahjong.deadHandOverlayData !== null}
        player={mahjong.deadHandOverlayData?.player ?? 'East'}
        reason={mahjong.deadHandOverlayData?.reason ?? ''}
        revealedHand={gameState.your_hand}
        onAcknowledge={() => mahjong.setDeadHandOverlayVisible(false)}
      />

      {/* Call Window Panel */}
      {callWindow.callWindow && (
        <CallWindowPanel
          callableTile={callWindow.callWindow.tile}
          discardedBy={callWindow.callWindow.discardedBy}
          canCallForPung={callEligibility.canCallForPung}
          canCallForKong={callEligibility.canCallForKong}
          canCallForQuint={callEligibility.canCallForQuint}
          canCallForSextet={callEligibility.canCallForSextet}
          canCallForMahjong={callEligibility.canCallForMahjong}
          onCallIntent={handleCallIntent}
          onPass={handlePass}
          timerRemaining={callWindow.timerRemaining ?? callWindow.callWindow.timerDuration}
          timerDuration={callWindow.callWindow.timerDuration}
          disabled={callWindow.callWindow.hasResponded || forfeitedPlayers.has(gameState.your_seat)}
          responseMessage={callWindow.callWindow.responseMessage}
          respondedSeats={
            callWindow.callWindow.canCall.filter(
              (seat) => !callWindow.callWindow!.canAct.includes(seat)
            ) || []
          }
          intentSummaries={callWindow.callWindow.intents}
        />
      )}

      {/* Call Resolution Overlay */}
      {playing.resolutionOverlay && (
        <CallResolutionOverlay
          resolution={playing.resolutionOverlay.resolution}
          tieBreak={playing.resolutionOverlay.tieBreak}
          allCallers={playing.resolutionOverlay.allCallers}
          discardedBy={playing.resolutionOverlay.discardedBy}
          onDismiss={playing.dismissResolutionOverlay}
        />
      )}

      {/* Discard Animation Layer */}
      {playing.discardAnimationTile !== null && isEnabled('tile_movement') && (
        <DiscardAnimationLayer
          tile={playing.discardAnimationTile}
          duration={getDuration(400)}
          onComplete={() => playing.setDiscardAnimation(null)}
        />
      )}

      {/* Error / status message */}
      {errorMessage && (
        <div
          className="fixed top-[135px] left-1/2 -translate-x-1/2 bg-gray-900/80 text-white text-sm px-4 py-2 rounded"
          role="alert"
        >
          {errorMessage}
        </div>
      )}

      {historyPlayback.undoNotice && (
        <div
          className="fixed left-1/2 top-[170px] z-40 -translate-x-1/2 rounded bg-sky-900/90 px-4 py-2 text-sm text-sky-100"
          role="status"
          aria-live="polite"
          data-testid="undo-notice"
        >
          {historyPlayback.undoNotice}
        </div>
      )}

      {hintSystem.hintStatusMessage && !hintSystem.showHintSettings && (
        <div
          className="fixed left-1/2 top-[205px] z-40 -translate-x-1/2 rounded bg-cyan-900/90 px-4 py-2 text-sm text-cyan-100"
          role="status"
          aria-live="polite"
          data-testid="hint-status-banner"
        >
          {hintSystem.hintStatusMessage}
        </div>
      )}

      {!historyPlayback.isSoloGame && (
        <UndoVotePanel
          undoRequest={historyPlayback.undoRequest}
          currentSeat={gameState.your_seat}
          seats={historyPlayback.playerSeats}
          votes={historyPlayback.undoVotes}
          onVote={historyPlayback.voteUndo}
          timeRemaining={historyPlayback.undoVoteSecondsRemaining ?? undefined}
        />
      )}

      <HistoryPanel
        isOpen={historyPlayback.isHistoryOpen}
        roomId={gameState.game_id}
        onClose={() => historyPlayback.setIsHistoryOpen(false)}
        history={historyPlayback.history}
        onJumpToMove={historyPlayback.requestJumpToMove}
        activeMoveNumber={historyPlayback.historicalMoveNumber}
        dimmed={historyPlayback.historyLoadingMessage !== null}
        overlayMessage={historyPlayback.historyLoadingMessage}
      />

      {historyPlayback.isHistoricalView && historyPlayback.historicalMoveNumber !== null && (
        <>
          <HistoricalViewBanner
            moveNumber={historyPlayback.historicalMoveNumber}
            moveDescription={historyPlayback.historicalDescription}
            isGameOver={false}
            canResume={historyPlayback.canResumeFromHistory}
            onReturnToPresent={historyPlayback.returnToPresent}
            onResumeFromHere={() => historyPlayback.setShowResumeDialog(true)}
          />
          <TimelineScrubber
            currentMove={historyPlayback.historicalMoveNumber}
            totalMoves={Math.max(historyPlayback.totalMoves, historyPlayback.historicalMoveNumber)}
            onMoveChange={historyPlayback.requestJumpToMove}
          />
        </>
      )}

      <ResumeConfirmationDialog
        isOpen={historyPlayback.showResumeDialog}
        moveNumber={historyPlayback.historicalMoveNumber ?? 1}
        currentMove={Math.max(
          historyPlayback.totalMoves,
          historyPlayback.historicalMoveNumber ?? 1
        )}
        isLoading={historyPlayback.isResuming}
        onConfirm={historyPlayback.confirmResumeFromHere}
        onCancel={() => historyPlayback.setShowResumeDialog(false)}
      />

      {historyPlayback.historyWarning && (
        <div
          className="fixed left-1/2 top-24 z-40 -translate-x-1/2 rounded border border-amber-400/70 bg-amber-900/90 px-4 py-2 text-sm text-amber-100"
          role="alert"
          data-testid="history-warning"
        >
          <div className="flex items-center gap-2">
            <span>{historyPlayback.historyWarning}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => historyPlayback.setHistoryWarning(null)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
