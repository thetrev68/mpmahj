/**
 * PlayingPhase Component
 *
 * Self-contained orchestrator for the Playing phase (main game loop).
 * Extracted from GameBoard.tsx as part of Phase 3 refactoring.
 *
 * Related: GAMEBOARD_REFACTORING_PLAN.md Phase 3
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
import { HistoryPanel } from '../HistoryPanel';
import { HistoricalViewBanner } from '../HistoricalViewBanner';
import { TimelineScrubber } from '../TimelineScrubber';
import { ResumeConfirmationDialog } from '../ResumeConfirmationDialog';
import { UndoVotePanel } from '../UndoVotePanel';
import { HintPanel } from '../HintPanel';
import { HintSettingsSection } from '../HintSettingsSection';
import { AnimationSettings } from '../AnimationSettings';
import type { ExchangeOpportunity } from '../JokerExchangeDialog';
import { useCallWindowState } from '@/hooks/useCallWindowState';
import { usePlayingPhaseState } from '@/hooks/usePlayingPhaseState';
import { useGameAnimations } from '@/hooks/useGameAnimations';
import { useTileSelection } from '@/hooks/useTileSelection';
import { useHistoryData } from '@/hooks/useHistoryData';
import { useSoundEffects } from '@/hooks/useSoundEffects';
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
import {
  DEFAULT_HINT_SETTINGS,
  loadHintSettings,
  saveHintSettings,
  type HintSettings,
  type HintSoundType,
} from '@/lib/hintSettings';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { UIStateAction } from '@/lib/game-events/types';
import type { HistoryMode } from '@/types/bindings/generated/HistoryMode';
import type { HintData } from '@/types/bindings/generated/HintData';
import type { HintVerbosity } from '@/types/bindings/generated/HintVerbosity';

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
  const SOLO_UNDO_LIMIT = 10;
  const MULTIPLAYER_UNDO_LIMIT = 3;
  const callWindow = useCallWindowState();
  const playing = usePlayingPhaseState();
  const animations = useGameAnimations();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showMahjongDialog, setShowMahjongDialog] = useState(false);
  const [mahjongDialogLoading, setMahjongDialogLoading] = useState(false);
  const [mahjongDeclaredMessage, setMahjongDeclaredMessage] = useState<string | null>(null);
  const [deadHandNotice, setDeadHandNotice] = useState<string | null>(null);
  // US-020: persistent dead hand tracking (survives turn changes)
  // Initialize from server snapshot so reconnects restore dead-hand state (AC-10)
  const [deadHandPlayers, setDeadHandPlayers] = useState<Set<Seat>>(
    () => new Set(gameState.players.filter((p) => p.status === 'Dead').map((p) => p.seat))
  );
  // Ref mirrors state so eventBus closure (dep=[eventBus]) always reads the latest set (EC-1, AC-3)
  const deadHandPlayersRef = useRef<Set<Seat>>(
    new Set(gameState.players.filter((p) => p.status === 'Dead').map((p) => p.seat))
  );
  const [showDeadHandOverlay, setShowDeadHandOverlay] = useState(false);
  const [deadHandOverlayData, setDeadHandOverlayData] = useState<{
    player: Seat;
    reason: string;
  } | null>(null);
  // US-019: called-discard Mahjong validation state
  const [awaitingMahjongValidation, setAwaitingMahjongValidation] = useState<{
    calledTile: Tile;
    discardedBy: Seat;
  } | null>(null);
  const [awaitingValidationLoading, setAwaitingValidationLoading] = useState(false);

  // US-014/015: Joker exchange state
  const [showJokerExchangeDialog, setShowJokerExchangeDialog] = useState(false);
  const [jokerExchangeLoading, setJokerExchangeLoading] = useState(false);
  const [forfeitedPlayers, setForfeitedPlayers] = useState<Set<Seat>>(new Set());
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isHistoricalView, setIsHistoricalView] = useState(false);
  const [historicalMoveNumber, setHistoricalMoveNumber] = useState<number | null>(null);
  const [historicalDescription, setHistoricalDescription] = useState('');
  const [historyLoadingMessage, setHistoryLoadingMessage] = useState<string | null>(null);
  const [historyWarning, setHistoryWarning] = useState<string | null>(null);
  const [showResumeDialog, setShowResumeDialog] = useState(false);
  const [isResuming, setIsResuming] = useState(false);
  const [soloUndoRemaining, setSoloUndoRemaining] = useState(SOLO_UNDO_LIMIT);
  const [multiplayerUndoRemaining, setMultiplayerUndoRemaining] = useState(MULTIPLAYER_UNDO_LIMIT);
  const [undoPending, setUndoPending] = useState(false);
  const [recentUndoableActions, setRecentUndoableActions] = useState<string[]>([]);
  const [undoNotice, setUndoNotice] = useState<string | null>(null);
  const [undoRequest, setUndoRequest] = useState<{ requester: Seat; target_move: number } | null>(
    null
  );
  const [undoVotes, setUndoVotes] = useState<Partial<Record<Seat, boolean | null>>>({});
  const [undoVoteDeadlineMs, setUndoVoteDeadlineMs] = useState<number | null>(null);
  const [undoVoteSecondsRemaining, setUndoVoteSecondsRemaining] = useState<number | null>(null);
  const [hintSettings, setHintSettings] = useState<HintSettings>(() => loadHintSettings());
  const [showHintSettings, setShowHintSettings] = useState(false);
  const [hintStatusMessage, setHintStatusMessage] = useState<string | null>(null);
  const [showHintRequestDialog, setShowHintRequestDialog] = useState(false);
  const [requestVerbosity, setRequestVerbosity] = useState<HintVerbosity>(
    () => loadHintSettings().verbosity
  );
  const [hintPending, setHintPending] = useState(false);
  const [currentHint, setCurrentHint] = useState<HintData | null>(null);
  const [showHintPanel, setShowHintPanel] = useState(false);
  const {
    settings: animationSettings,
    updateSettings: updateAnimationSettings,
    getDuration,
    isEnabled,
    prefersReducedMotion,
  } = useAnimationSettings();
  const tileMovementEnabledRef = useRef(isEnabled('tile_movement'));
  const incomingAnimationDurationRef = useRef(getDuration(1500));
  const pendingUndoTypeRef = useRef<'solo' | 'vote' | null>(null);
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const jumpThrottleRef = useRef<{
    lastSentAt: number;
    timer: ReturnType<typeof setTimeout> | null;
    queuedMove: number | null;
  }>({ lastSentAt: 0, timer: null, queuedMove: null });

  // Auto-draw retry state
  type DrawStatus = null | 'drawing' | { retrying: number } | 'failed';
  const [drawStatus, setDrawStatus] = useState<DrawStatus>(null);
  const drawRetryRef = useRef<{ count: number; cleared: boolean }>({ count: 0, cleared: false });

  useEffect(() => {
    tileMovementEnabledRef.current = isEnabled('tile_movement');
    incomingAnimationDurationRef.current = getDuration(1500);
  }, [getDuration, isEnabled]);

  // Determine if it's the current player's turn
  const isMyTurn = currentTurn === gameState.your_seat;

  // Determine if player is in discarding stage
  const isDiscardingStage = typeof turnStage === 'object' && 'Discarding' in turnStage && isMyTurn;

  // Mahjong can be declared when discarding with a full 14-tile hand (dead hand players cannot)
  const canDeclareMahjong =
    isDiscardingStage &&
    gameState.your_hand.length === 14 &&
    !deadHandPlayers.has(gameState.your_seat) &&
    !forfeitedPlayers.has(gameState.your_seat);

  // US-014/015: Calculate joker exchange opportunities
  const jokerExchangeOpportunities = useMemo((): ExchangeOpportunity[] => {
    if (!isDiscardingStage) return [];

    const opportunities: ExchangeOpportunity[] = [];
    const myTiles = new Set(gameState.your_hand);

    // Check each opponent's exposed melds
    for (const player of gameState.players) {
      if (player.seat === gameState.your_seat) continue; // Skip my own melds

      player.exposed_melds.forEach((meld, meldIndex) => {
        // Check joker_assignments for this meld
        Object.entries(meld.joker_assignments ?? {}).forEach(([posStr, representedTile]) => {
          if (representedTile === undefined) return; // Skip if no represented tile
          const tilePosition = parseInt(posStr, 10);
          // If I have the matching tile in my hand, this is an exchange opportunity
          if (myTiles.has(representedTile)) {
            opportunities.push({
              targetSeat: player.seat,
              meldIndex,
              tilePosition,
              representedTile,
            });
          }
        });
      });
    }

    return opportunities;
  }, [isDiscardingStage, gameState.players, gameState.your_hand, gameState.your_seat]);

  const canExchangeJoker = jokerExchangeOpportunities.length > 0;
  const localPlayerInfo = useMemo(
    () => gameState.players.find((player) => player.seat === gameState.your_seat) ?? null,
    [gameState.players, gameState.your_seat]
  );
  const canRequestHint =
    isDiscardingStage &&
    gameState.your_hand.length === 14 &&
    !isHistoricalView &&
    !forfeitedPlayers.has(gameState.your_seat) &&
    !localPlayerInfo?.is_bot;
  const hintHighlightedIds = useMemo(() => {
    if (!currentHint || currentHint.recommended_discard === null) return [];
    const tile = currentHint.recommended_discard;
    const index = gameState.your_hand.findIndex((handTile) => handTile === tile);
    return index >= 0 ? [`${tile}-${index}`] : [];
  }, [currentHint, gameState.your_hand]);
  const combinedHighlightedIds = useMemo(
    () =>
      isEnabled('tile_movement')
        ? Array.from(new Set([...animations.highlightedTileIds, ...hintHighlightedIds]))
        : [],
    [animations.highlightedTileIds, hintHighlightedIds, isEnabled]
  );
  const { playSound } = useSoundEffects({
    enabled: hintSettings.sound_enabled,
  });
  const history = useHistoryData({
    isOpen: isHistoryOpen,
    mySeat: gameState.your_seat,
    sendCommand,
    eventBus,
  });
  const totalMoves = history.moves[history.moves.length - 1]?.move_number ?? 1;
  const humanPlayers = useMemo(
    () => gameState.players.filter((player) => !player.is_bot).length,
    [gameState.players]
  );
  const canJumpToHistory = humanPlayers === 1;
  const canResumeFromHistory =
    canJumpToHistory && isHistoricalView && historicalMoveNumber !== null;
  const isSoloGame = humanPlayers === 1;
  const playerSeats = useMemo(
    () => gameState.players.map((player) => player.seat),
    [gameState.players]
  );

  const pushUndoAction = useCallback((description: string) => {
    setRecentUndoableActions((prev) => [description, ...prev].slice(0, 3));
  }, []);

  const sendJumpCommand = useCallback(
    (moveNumber: number) => {
      const boundedMove = Math.max(1, Math.min(moveNumber, Math.max(1, totalMoves)));
      sendCommand({
        JumpToMove: {
          player: gameState.your_seat,
          move_number: boundedMove,
        },
      });
      setHistoryLoadingMessage(`Loading game state from move #${boundedMove}...`);
      setIsHistoryOpen(true);
    },
    [gameState.your_seat, sendCommand, totalMoves]
  );

  const requestJumpToMove = useCallback(
    (moveNumber: number) => {
      if (!canJumpToHistory) {
        setHistoryWarning(
          'Cannot jump to history in active multiplayer game. This feature is read-only and requires game pause.'
        );
        return;
      }

      const boundedMove = Math.max(1, Math.min(moveNumber, Math.max(1, totalMoves)));
      const now = Date.now();
      const sinceLast = now - jumpThrottleRef.current.lastSentAt;

      if (sinceLast >= 100) {
        jumpThrottleRef.current.lastSentAt = now;
        sendJumpCommand(boundedMove);
        return;
      }

      jumpThrottleRef.current.queuedMove = boundedMove;
      if (!jumpThrottleRef.current.timer) {
        jumpThrottleRef.current.timer = setTimeout(() => {
          if (jumpThrottleRef.current.queuedMove !== null) {
            sendJumpCommand(jumpThrottleRef.current.queuedMove);
            jumpThrottleRef.current.lastSentAt = Date.now();
            jumpThrottleRef.current.queuedMove = null;
          }
          jumpThrottleRef.current.timer = null;
        }, 100 - sinceLast);
      }
    },
    [canJumpToHistory, sendJumpCommand, totalMoves]
  );

  const returnToPresent = useCallback(() => {
    sendCommand({ ReturnToPresent: { player: gameState.your_seat } });
    setHistoryLoadingMessage('Returning to current game state...');
  }, [gameState.your_seat, sendCommand]);

  const confirmResumeFromHere = useCallback(() => {
    if (!historicalMoveNumber) return;
    setIsResuming(true);
    sendCommand({
      ResumeFromHistory: {
        player: gameState.your_seat,
        move_number: historicalMoveNumber,
      },
    });
    setHistoryLoadingMessage(`Resuming from move #${historicalMoveNumber}...`);
    setShowResumeDialog(false);
  }, [gameState.your_seat, historicalMoveNumber, sendCommand]);

  const handleOpenJokerExchange = useCallback(() => {
    setShowJokerExchangeDialog(true);
  }, []);

  const handleHintSettingsChange = useCallback(
    (nextSettings: HintSettings) => {
      setHintSettings(nextSettings);
      saveHintSettings(nextSettings);
      setHintStatusMessage(`Hint verbosity set to ${nextSettings.verbosity}`);
      if (!isHistoricalView && !forfeitedPlayers.has(gameState.your_seat)) {
        sendCommand({
          SetHintVerbosity: {
            player: gameState.your_seat,
            verbosity: nextSettings.verbosity,
          },
        });
      }
    },
    [forfeitedPlayers, gameState.your_seat, isHistoricalView, sendCommand]
  );

  const handleResetHintSettings = useCallback(() => {
    const confirmed = window.confirm('Reset to default hint settings?');
    if (!confirmed) return;
    handleHintSettingsChange(DEFAULT_HINT_SETTINGS);
  }, [handleHintSettingsChange]);

  const handleTestHintSound = useCallback(
    (soundType: HintSoundType) => {
      if (!hintSettings.sound_enabled) return;
      if (soundType === 'Chime') {
        playSound('mahjong');
      } else if (soundType === 'Ping') {
        playSound('tile-draw');
      } else {
        playSound('tile-call');
      }
    },
    [hintSettings.sound_enabled, playSound]
  );

  const clearHintTimeout = useCallback(() => {
    if (hintTimeoutRef.current) {
      clearTimeout(hintTimeoutRef.current);
      hintTimeoutRef.current = null;
    }
  }, []);

  const handleRequestHint = useCallback(() => {
    if (!canRequestHint || hintPending) return;
    setHintPending(true);
    setShowHintRequestDialog(false);
    clearHintTimeout();
    hintTimeoutRef.current = setTimeout(() => {
      setHintPending(false);
      setHintStatusMessage('Hint request timed out. Please try again.');
    }, 10000);
    sendCommand({
      RequestHint: {
        player: gameState.your_seat,
        verbosity: requestVerbosity,
      },
    });
  }, [
    canRequestHint,
    clearHintTimeout,
    gameState.your_seat,
    hintPending,
    requestVerbosity,
    sendCommand,
  ]);

  const cancelHintRequest = useCallback(() => {
    clearHintTimeout();
    setHintPending(false);
  }, [clearHintTimeout]);

  const requestSoloUndo = useCallback(() => {
    if (
      !isSoloGame ||
      soloUndoRemaining <= 0 ||
      undoPending ||
      isHistoricalView ||
      playing.isProcessing
    )
      return;
    setUndoPending(true);
    pendingUndoTypeRef.current = 'solo';
    sendCommand({ SmartUndo: { player: gameState.your_seat } });
  }, [
    gameState.your_seat,
    isHistoricalView,
    isSoloGame,
    sendCommand,
    soloUndoRemaining,
    undoPending,
    playing.isProcessing,
  ]);

  const requestUndoVote = useCallback(() => {
    if (
      isSoloGame ||
      multiplayerUndoRemaining <= 0 ||
      undoPending ||
      isHistoricalView ||
      playing.isProcessing
    )
      return;
    setUndoPending(true);
    pendingUndoTypeRef.current = 'vote';
    sendCommand({ SmartUndo: { player: gameState.your_seat } });
  }, [
    gameState.your_seat,
    isHistoricalView,
    isSoloGame,
    multiplayerUndoRemaining,
    sendCommand,
    undoPending,
    playing.isProcessing,
  ]);

  const voteUndo = useCallback(
    (approve: boolean) => {
      if (!undoRequest || undoVoteSecondsRemaining === null || undoVoteSecondsRemaining <= 0)
        return;
      if (undoRequest.requester === gameState.your_seat) return;
      if (undoVotes[gameState.your_seat] !== null && undoVotes[gameState.your_seat] !== undefined)
        return;

      setUndoVotes((prev) => ({
        ...prev,
        [gameState.your_seat]: approve,
      }));
      sendCommand({
        VoteUndo: {
          player: gameState.your_seat,
          approve,
        },
      });
    },
    [gameState.your_seat, sendCommand, undoRequest, undoVoteSecondsRemaining, undoVotes]
  );

  // Issue #5: Global keyboard shortcut 'J' to open joker exchange dialog
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not in an input/textarea and dialog not already open
      if (e.key === 'j' || e.key === 'J') {
        const target = e.target as HTMLElement;
        if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
        if (showJokerExchangeDialog) return;

        // Only if we have joker exchange opportunities
        if (jokerExchangeOpportunities.length > 0) {
          e.preventDefault();
          setShowJokerExchangeDialog(true);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jokerExchangeOpportunities, showJokerExchangeDialog]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && (event.key === 'z' || event.key === 'Z')) {
        const target = event.target as HTMLElement;
        if (target?.tagName !== 'INPUT' && target?.tagName !== 'TEXTAREA') {
          event.preventDefault();
          requestSoloUndo();
        }
        return;
      }

      if (event.key !== 'h' && event.key !== 'H') return;
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      event.preventDefault();
      setIsHistoryOpen((prev) => !prev);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [requestSoloUndo]);

  useEffect(() => {
    if (!undoVoteDeadlineMs) {
      setUndoVoteSecondsRemaining(null);
      return;
    }

    const tick = () => {
      const remaining = Math.max(0, Math.ceil((undoVoteDeadlineMs - Date.now()) / 1000));
      setUndoVoteSecondsRemaining(remaining);
    };

    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, [undoVoteDeadlineMs]);

  useEffect(() => {
    setRequestVerbosity(hintSettings.verbosity);
  }, [hintSettings.verbosity]);

  useEffect(() => {
    const throttleState = jumpThrottleRef.current;
    return () => {
      const timer = throttleState.timer;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  const handleJokerExchange = useCallback(
    (opportunity: ExchangeOpportunity) => {
      setJokerExchangeLoading(true);
      sendCommand({
        ExchangeJoker: {
          player: gameState.your_seat,
          target_seat: opportunity.targetSeat,
          meld_index: opportunity.meldIndex,
          replacement: opportunity.representedTile,
        },
      });
    },
    [sendCommand, gameState.your_seat]
  );

  const handleCloseJokerExchange = useCallback(() => {
    setShowJokerExchangeDialog(false);
    setJokerExchangeLoading(false);
  }, []);

  const handleDeclareMahjong = useCallback(() => {
    setShowMahjongDialog(true);
  }, []);

  const handleMahjongConfirm = useCallback(
    (command: import('@/types/bindings/generated/GameCommand').GameCommand) => {
      setMahjongDialogLoading(true);
      playing.setProcessing(true); // AC-3: disable hand while waiting for server validation
      sendCommand(command);
    },
    [sendCommand, playing]
  );

  const handleMahjongCancel = useCallback(() => {
    setShowMahjongDialog(false);
    setMahjongDialogLoading(false);
  }, []);

  // Tile selection for discarding
  const { selectedIds, toggleTile, clearSelection } = useTileSelection({
    maxSelection: 1,
    disabledIds: [],
  });

  // Subscribe to event bus UI actions
  useEffect(() => {
    if (!eventBus) return;

    const unsub = eventBus.on('ui-action', (data: unknown) => {
      const action = data as UIStateAction;
      switch (action.type) {
        case 'OPEN_CALL_WINDOW':
          // Dead hand players cannot call (US-020 EC-1, AC-3)
          // Use ref so stale closure always reads the latest set
          if (!deadHandPlayersRef.current.has(gameState.your_seat)) {
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
          // Issue #1: Clear joker exchange loading state on error
          setJokerExchangeLoading(false);
          if (action.message && pendingUndoTypeRef.current) {
            pendingUndoTypeRef.current = null;
            setUndoPending(false);
          }
          break;
        case 'CLEAR_PENDING_DRAW_RETRY':
          drawRetryRef.current.cleared = true;
          setDrawStatus(null);
          break;
        case 'SET_MAHJONG_DECLARED':
          setMahjongDeclaredMessage(`${action.player} is declaring Mahjong...`);
          break;
        case 'SET_AWAITING_MAHJONG_VALIDATION':
          setAwaitingMahjongValidation({
            calledTile: action.calledTile,
            discardedBy: action.discardedBy,
          });
          break;
        case 'SET_MAHJONG_VALIDATED':
          setMahjongDialogLoading(false);
          setAwaitingValidationLoading(false);
          setAwaitingMahjongValidation(null);
          setMahjongDeclaredMessage(null); // Clear announcing banner once server responds
          if (!action.valid) {
            setShowMahjongDialog(false);
            playing.setProcessing(false); // Allow discard again after invalid claim
            setDeadHandNotice(`Invalid Mahjong - Hand does not match any pattern`);
          }
          // On valid: keep isProcessing=true (hand stays locked, game proceeds to scoring)
          break;
        case 'SET_HAND_DECLARED_DEAD': {
          // AC-3: specific message for local player; generic for others
          const isLocalPlayer = action.player === gameState.your_seat;
          setDeadHandNotice(
            isLocalPlayer
              ? 'You have a dead hand. You will be skipped for the rest of the game.'
              : `${action.player}'s hand is declared dead: ${action.reason}`
          );
          // Persist dead hand for this player for the rest of the game (US-020 AC-3)
          setDeadHandPlayers((prev) => {
            const next = new Set([...prev, action.player]);
            deadHandPlayersRef.current = next; // keep ref in sync
            return next;
          });
          // Show acknowledgeable overlay only to the penalized player (US-020 AC-2)
          if (isLocalPlayer) {
            setDeadHandOverlayData({ player: action.player, reason: action.reason });
            setShowDeadHandOverlay(true);
          }
          break;
        }
        case 'SET_PLAYER_SKIPPED':
          setDeadHandNotice(`${action.player}'s turn was skipped (${action.reason})`);
          break;
        case 'SET_JOKER_EXCHANGED':
          // Close the joker exchange dialog and reset loading state
          setShowJokerExchangeDialog(false);
          setJokerExchangeLoading(false);
          break;
        case 'SET_PLAYER_FORFEITED':
          setForfeitedPlayers((prev) => new Set([...prev, action.player]));
          if (action.player === gameState.your_seat) {
            setDeadHandNotice(
              action.reason
                ? `You forfeited the game (${action.reason}).`
                : 'You forfeited the game.'
            );
            playing.setProcessing(true);
            callWindow.closeCallWindow();
          } else {
            setDeadHandNotice(
              action.reason
                ? `${action.player} forfeited (${action.reason}).`
                : `${action.player} forfeited.`
            );
          }
          break;
        default:
          break;
      }
    });

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventBus]);

  useEffect(() => {
    if (!eventBus) return;

    const unsubscribe = eventBus.on('server-event', (data: unknown) => {
      const event = data as { Public?: unknown; Analysis?: unknown };
      if (!event || typeof event !== 'object') return;

      if ('Analysis' in event) {
        const analysis = event.Analysis;
        if (typeof analysis === 'object' && analysis !== null && 'HintUpdate' in analysis) {
          const hint = (analysis as { HintUpdate: { hint: HintData } }).HintUpdate.hint;
          clearHintTimeout();
          setHintPending(false);
          setCurrentHint(hint);
          setShowHintPanel(true);
          setHintStatusMessage('Hint received');
          if (hintSettings.sound_enabled) {
            if (hintSettings.sound_type === 'Chime') {
              playSound('mahjong');
            } else if (hintSettings.sound_type === 'Ping') {
              playSound('tile-draw');
            } else {
              playSound('tile-call');
            }
          }
          return;
        }
      }

      if (!('Public' in event)) return;
      const pub = event.Public;
      if (typeof pub !== 'object' || pub === null) return;

      if ('StateRestored' in pub) {
        const restored = pub.StateRestored as {
          move_number: number;
          description: string;
          mode: HistoryMode;
        };
        if (pendingUndoTypeRef.current === 'solo') {
          setSoloUndoRemaining((prev) => Math.max(0, prev - 1));
          setUndoNotice(`Undid: ${restored.description}`);
          setUndoPending(false);
          pendingUndoTypeRef.current = null;
        } else if (pendingUndoTypeRef.current === 'vote') {
          setMultiplayerUndoRemaining((prev) => Math.max(0, prev - 1));
          setUndoPending(false);
          pendingUndoTypeRef.current = null;
        }

        setHistoryLoadingMessage(null);
        setHistoricalMoveNumber(restored.move_number);
        setHistoricalDescription(restored.description);

        if (restored.mode === 'None') {
          setIsHistoricalView(false);
          setIsResuming(false);
          return;
        }

        setIsHistoricalView(true);
        return;
      }

      if ('HistoryTruncated' in pub) {
        const fromMove = (pub as { HistoryTruncated: { from_move: number } }).HistoryTruncated
          .from_move;
        const deletedMoves = Math.max(0, totalMoves - fromMove + 1);
        setHistoryWarning(
          `${deletedMoves} future moves deleted. Game resumed from move #${Math.max(1, fromMove - 1)}.`
        );
        return;
      }

      if ('UndoRequested' in pub) {
        const requested = (pub as { UndoRequested: { requester: Seat; target_move: number } })
          .UndoRequested;
        const nextVotes: Partial<Record<Seat, boolean | null>> = {};
        playerSeats.forEach((seat) => {
          nextVotes[seat] = seat === requested.requester ? true : null;
        });
        setUndoRequest(requested);
        setUndoVotes(nextVotes);
        setUndoVoteDeadlineMs(Date.now() + 30000);
        setUndoPending(false);
        return;
      }

      if ('UndoVoteRegistered' in pub) {
        const vote = (pub as { UndoVoteRegistered: { voter: Seat; approved: boolean } })
          .UndoVoteRegistered;
        setUndoVotes((prev) => ({ ...prev, [vote.voter]: vote.approved }));
        return;
      }

      if ('UndoRequestResolved' in pub) {
        const resolution = (pub as { UndoRequestResolved: { approved: boolean } })
          .UndoRequestResolved;
        setUndoNotice(
          resolution.approved
            ? 'Undo approved - game state restored'
            : 'Undo denied - game continues'
        );
        if (resolution.approved) {
          setMultiplayerUndoRemaining((prev) => Math.max(0, prev - 1));
        }
        setUndoRequest(null);
        setUndoVotes({});
        setUndoVoteDeadlineMs(null);
        setUndoPending(false);
        pendingUndoTypeRef.current = null;
        return;
      }

      if ('HistoryError' in pub) {
        setHistoryLoadingMessage(null);
        setIsResuming(false);
        setHistoryWarning((pub as { HistoryError: { message: string } }).HistoryError.message);
      }
    });

    return unsubscribe;
  }, [
    clearHintTimeout,
    eventBus,
    hintSettings.sound_enabled,
    hintSettings.sound_type,
    playSound,
    playerSeats,
    totalMoves,
  ]);

  useEffect(() => {
    if (!isHistoricalView) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA') return;

      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        const nextMove = Math.max(1, (historicalMoveNumber ?? 1) - 1);
        requestJumpToMove(nextMove);
        return;
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault();
        const nextMove = Math.min(totalMoves, (historicalMoveNumber ?? 1) + 1);
        requestJumpToMove(nextMove);
        return;
      }

      if (event.key === 'Home') {
        event.preventDefault();
        requestJumpToMove(1);
        return;
      }

      if (event.key === 'End') {
        event.preventDefault();
        requestJumpToMove(totalMoves);
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        returnToPresent();
        return;
      }

      if ((event.key === 'r' || event.key === 'R') && canResumeFromHistory) {
        event.preventDefault();
        setShowResumeDialog(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    canResumeFromHistory,
    historicalMoveNumber,
    isHistoricalView,
    requestJumpToMove,
    returnToPresent,
    totalMoves,
  ]);

  useEffect(() => {
    if (!undoNotice) return;
    const timer = setTimeout(() => setUndoNotice(null), 3000);
    return () => clearTimeout(timer);
  }, [undoNotice]);

  useEffect(() => {
    if (!hintStatusMessage) return;
    const timer = setTimeout(() => setHintStatusMessage(null), 3000);
    return () => clearTimeout(timer);
  }, [hintStatusMessage]);

  // Reset state on turn change
  useEffect(() => {
    playing.reset();
    animations.clearAllAnimations();
    clearSelection();
    clearHintTimeout();
    setHintPending(false);
    setCurrentHint(null);
    setShowHintPanel(false);
    setShowHintRequestDialog(false);
    setDrawStatus(null);
    drawRetryRef.current = { count: 0, cleared: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTurn]);

  // Auto-draw tile when it's my turn and stage is Drawing
  const isDrawingStage = typeof turnStage === 'object' && 'Drawing' in turnStage;
  useEffect(() => {
    if (!isMyTurn || !isDrawingStage) return;

    drawRetryRef.current = { count: 0, cleared: false };
    setDrawStatus('drawing');

    const sendDraw = () => {
      sendCommand({ DrawTile: { player: gameState.your_seat } });
    };

    const MAX_RETRIES = 3;
    const scheduleRetry = (attempt: number) => {
      return setTimeout(() => {
        if (drawRetryRef.current.cleared) return;
        const retryNum = attempt + 1;
        setDrawStatus({ retrying: retryNum });
        sendDraw();
        if (retryNum >= MAX_RETRIES) {
          // Final retry sent – show failure
          setDrawStatus('failed');
        } else {
          retryTimerRef.current = scheduleRetry(attempt + 1);
        }
      }, 5000);
    };

    const retryTimerRef = { current: 0 as ReturnType<typeof setTimeout> };

    const initialTimer = setTimeout(() => {
      if (drawRetryRef.current.cleared) return;
      sendDraw();
      retryTimerRef.current = scheduleRetry(0);
    }, 500);

    return () => {
      clearTimeout(initialTimer);
      clearTimeout(retryTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, isDrawingStage]);

  // Call window timer countdown effect (includes auto-pass on expiry)
  useEffect(() => {
    if (!callWindow.callWindow) {
      callWindow.setTimerRemaining(null);
      return;
    }

    const updateRemaining = () => {
      const now = Date.now();
      const remainingMs = Math.max(
        0,
        callWindow.callWindow!.timerStart + callWindow.callWindow!.timerDuration * 1000 - now
      );
      callWindow.setTimerRemaining(Math.ceil(remainingMs / 1000));

      // Auto-pass when timer expires and player hasn't responded
      if (remainingMs === 0 && !callWindow.callWindow!.hasResponded) {
        sendCommand({ Pass: { player: gameState.your_seat } });
        callWindow.markResponded('Time expired - auto-passed');
      }
    };

    updateRemaining();
    const interval = setInterval(updateRemaining, 500);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callWindow.callWindow]);

  // Calculate call eligibility based on current hand
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

  // Handle call intent declaration
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
        pushUndoAction('Declared Mahjong call intent');
        callWindow.markResponded('Declared Mahjong');
        return;
      } else {
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
          pushUndoAction(`Called for ${intent}`);
        }
      }

      callWindow.markResponded(`Declared intent to call for ${intent}`);
    },
    [
      callWindow,
      gameState.your_seat,
      gameState.your_hand,
      sendCommand,
      forfeitedPlayers,
      pushUndoAction,
    ]
  );

  // Handle pass on call
  const handlePass = useCallback(() => {
    if (forfeitedPlayers.has(gameState.your_seat)) return;
    if (!callWindow.callWindow || callWindow.callWindow.hasResponded) return;

    const tile = callWindow.callWindow.tile;
    sendCommand({
      Pass: {
        player: gameState.your_seat,
      },
    });
    pushUndoAction(`Passed on ${getTileName(tile)}`);

    const message = `Passed on ${getTileName(tile)}`;
    setErrorMessage(message);
    callWindow.closeCallWindow();
  }, [callWindow, gameState.your_seat, sendCommand, forfeitedPlayers, pushUndoAction]);

  // Handle discard animation completion
  const handleDiscardAnimationComplete = useCallback(() => {
    playing.setDiscardAnimation(null);
  }, [playing]);

  useEffect(() => {
    if (playing.discardAnimationTile !== null && !isEnabled('tile_movement')) {
      playing.setDiscardAnimation(null);
    }
  }, [isEnabled, playing, playing.discardAnimationTile]);

  // Handle resolution overlay dismiss
  const handleResolutionDismiss = useCallback(() => {
    playing.dismissResolutionOverlay();
  }, [playing]);

  return (
    <>
      {/* Turn Indicator (dead hand badges shown for all dead-hand players - US-020 AC-5) */}
      <TurnIndicator
        currentSeat={currentTurn}
        stage={turnStage}
        isMyTurn={isMyTurn}
        deadHandSeats={Array.from(deadHandPlayers)}
      />

      {/* Draw retry / failure feedback (initial "drawing" status shown by ActionBar) */}
      {isMyTurn && isDrawingStage && drawStatus !== null && drawStatus !== 'drawing' && (
        <div
          className="fixed top-[135px] left-1/2 -translate-x-1/2 bg-red-900/80 text-red-100 text-sm px-4 py-2 rounded"
          role="alert"
        >
          {drawStatus !== null &&
            typeof drawStatus === 'object' &&
            `Failed to draw tile. Retrying... ${drawStatus.retrying}/3`}
          {drawStatus === 'failed' && 'Failed to draw tile after 3 attempts. Please refresh.'}
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
        />
      ))}

      {/* Concealed Hand */}
      <ConcealedHand
        tiles={gameState.your_hand.map((tile, idx) => ({
          id: `${tile}-${idx}`,
          tile,
        }))}
        mode={isHistoricalView ? 'view-only' : 'discard'}
        selectedTileIds={selectedIds}
        onTileSelect={toggleTile}
        maxSelection={1}
        disabled={
          isHistoricalView ||
          !isDiscardingStage ||
          playing.isProcessing ||
          forfeitedPlayers.has(gameState.your_seat)
        }
        highlightedTileIds={combinedHighlightedIds}
        incomingFromSeat={animations.incomingFromSeat}
        leavingTileIds={animations.leavingTileIds}
      />
      {isHistoricalView && (
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
          selectedTiles={selectedIds
            .map((id) => parseInt(id.split('-')[0]))
            .filter((t): t is Tile => !isNaN(t))}
          isProcessing={playing.isProcessing}
          canDeclareMahjong={canDeclareMahjong}
          onDeclareMahjong={handleDeclareMahjong}
          canExchangeJoker={canExchangeJoker}
          onExchangeJoker={handleOpenJokerExchange}
          canRequestHint={canRequestHint}
          onOpenHintRequest={() => {
            setRequestVerbosity(hintSettings.verbosity);
            setShowHintRequestDialog(true);
          }}
          isHintRequestPending={hintPending}
          onCommand={(cmd) => {
            sendCommand(cmd);
            if ('DiscardTile' in cmd) {
              pushUndoAction(`Discarded ${getTileName(cmd.DiscardTile.tile)}`);
              playing.setProcessing(true);
              clearSelection();
            }
            if ('PassTiles' in cmd) {
              pushUndoAction('Passed tiles');
            }
          }}
          onLeaveConfirmed={onLeaveConfirmed}
          readOnly={isHistoricalView}
          readOnlyMessage="Historical View - No actions available"
          showSoloUndo={isSoloGame}
          soloUndoRemaining={soloUndoRemaining}
          soloUndoLimit={SOLO_UNDO_LIMIT}
          undoRecentActions={recentUndoableActions}
          undoPending={undoPending}
          onUndo={requestSoloUndo}
          showUndoVoteRequest={!isSoloGame}
          undoVoteRemaining={multiplayerUndoRemaining}
          onRequestUndoVote={requestUndoVote}
          disableUndoControls={
            mahjongDialogLoading ||
            awaitingMahjongValidation !== null ||
            mahjongDeclaredMessage !== null
          }
        />
      </div>
      <div className="fixed right-6 top-6 z-30">
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHintSettings(true)}
            data-testid="hint-settings-button"
          >
            Settings
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsHistoryOpen(true)}
            data-testid="history-button"
          >
            History
          </Button>
        </div>
      </div>

      {showHintPanel && currentHint && (
        <HintPanel
          hint={currentHint}
          verbosity={requestVerbosity}
          onClose={() => {
            setShowHintPanel(false);
            setCurrentHint(null);
          }}
        />
      )}

      {hintPending && (
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
              onClick={cancelHintRequest}
              data-testid="cancel-hint-request-button"
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      <Dialog open={showHintRequestDialog} onOpenChange={setShowHintRequestDialog}>
        <DialogContent data-testid="hint-request-dialog">
          <DialogHeader>
            <DialogTitle>Request AI Hint</DialogTitle>
            <DialogDescription>Choose how much detail you want in this hint.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Select
              value={requestVerbosity}
              onValueChange={(value) => setRequestVerbosity(value as HintVerbosity)}
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
              onClick={handleRequestHint}
              disabled={requestVerbosity === 'Disabled'}
              data-testid="request-analysis-button"
            >
              Request Analysis
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showHintSettings} onOpenChange={setShowHintSettings}>
        <DialogContent className="max-w-2xl" data-testid="hint-settings-dialog">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>
              Configure your hint defaults, audio, and animations.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <HintSettingsSection
              settings={hintSettings}
              onChange={handleHintSettingsChange}
              onReset={handleResetHintSettings}
              onTestSound={handleTestHintSound}
            />
            <AnimationSettings
              settings={animationSettings}
              onChange={updateAnimationSettings}
              prefersReducedMotion={prefersReducedMotion}
            />
          </div>
          {hintStatusMessage && (
            <p className="text-sm text-cyan-300" data-testid="hint-settings-status">
              {hintStatusMessage}
            </p>
          )}
        </DialogContent>
      </Dialog>

      {/* Mahjong Confirmation Dialog (self-draw) */}
      <MahjongConfirmationDialog
        isOpen={showMahjongDialog}
        hand={gameState.your_hand}
        mySeat={gameState.your_seat}
        isLoading={mahjongDialogLoading}
        onConfirm={handleMahjongConfirm}
        onCancel={handleMahjongCancel}
      />

      {/* Mahjong Validation Dialog (called discard - US-019) */}
      <MahjongValidationDialog
        isOpen={awaitingMahjongValidation !== null}
        concealedHand={gameState.your_hand}
        calledTile={awaitingMahjongValidation?.calledTile ?? 0}
        discardedBy={awaitingMahjongValidation?.discardedBy ?? 'East'}
        mySeat={gameState.your_seat}
        isLoading={awaitingValidationLoading}
        onSubmit={(command) => {
          setAwaitingValidationLoading(true);
          playing.setProcessing(true);
          sendCommand(command);
        }}
      />

      {/* Joker Exchange Dialog (US-014/015) */}
      <JokerExchangeDialog
        isOpen={showJokerExchangeDialog}
        opportunities={jokerExchangeOpportunities}
        isLoading={jokerExchangeLoading}
        onExchange={handleJokerExchange}
        onClose={handleCloseJokerExchange}
      />

      {/* AC-1: Mahjong opportunity message when player has 14-tile winning hand */}
      {canDeclareMahjong && !showMahjongDialog && (
        <div
          className="fixed top-[100px] left-1/2 -translate-x-1/2 bg-yellow-900/90 border border-yellow-400 text-yellow-100 px-5 py-2 rounded-lg text-sm text-center z-30"
          data-testid="mahjong-opportunity-message"
          aria-live="polite"
        >
          You have Mahjong! Declare to win or discard to continue.
        </div>
      )}

      {/* Mahjong Declared Announcement (shown to all players) */}
      {mahjongDeclaredMessage && (
        <div
          className="fixed top-1/4 left-1/2 -translate-x-1/2 bg-yellow-900/90 border border-yellow-500 text-yellow-200 px-6 py-3 rounded-lg text-center z-40"
          data-testid="mahjong-declared-message"
          aria-live="polite"
        >
          {mahjongDeclaredMessage}
        </div>
      )}

      {/* Dead Hand Notice */}
      {deadHandNotice && (
        <div
          className="fixed top-1/3 left-1/2 -translate-x-1/2 bg-red-900/90 border border-red-500 text-red-200 px-6 py-3 rounded-lg text-center z-40"
          data-testid="dead-hand-notice"
          aria-live="assertive"
        >
          {deadHandNotice}
        </div>
      )}

      {/* Dead Hand Overlay (AC-2: shown to penalized player with acknowledge button) */}
      <DeadHandOverlay
        show={showDeadHandOverlay && deadHandOverlayData !== null}
        player={deadHandOverlayData?.player ?? 'East'}
        reason={deadHandOverlayData?.reason ?? ''}
        revealedHand={gameState.your_hand}
        onAcknowledge={() => setShowDeadHandOverlay(false)}
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
          onDismiss={handleResolutionDismiss}
        />
      )}

      {/* Discard Animation Layer */}
      {playing.discardAnimationTile !== null && isEnabled('tile_movement') && (
        <DiscardAnimationLayer
          tile={playing.discardAnimationTile}
          duration={getDuration(400)}
          onComplete={handleDiscardAnimationComplete}
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

      {undoNotice && (
        <div
          className="fixed left-1/2 top-[170px] z-40 -translate-x-1/2 rounded bg-sky-900/90 px-4 py-2 text-sm text-sky-100"
          role="status"
          aria-live="polite"
          data-testid="undo-notice"
        >
          {undoNotice}
        </div>
      )}

      {hintStatusMessage && !showHintSettings && (
        <div
          className="fixed left-1/2 top-[205px] z-40 -translate-x-1/2 rounded bg-cyan-900/90 px-4 py-2 text-sm text-cyan-100"
          role="status"
          aria-live="polite"
          data-testid="hint-status-banner"
        >
          {hintStatusMessage}
        </div>
      )}

      {!isSoloGame && (
        <UndoVotePanel
          undoRequest={undoRequest}
          currentSeat={gameState.your_seat}
          seats={playerSeats}
          votes={undoVotes}
          onVote={voteUndo}
          timeRemaining={undoVoteSecondsRemaining ?? undefined}
        />
      )}

      <HistoryPanel
        isOpen={isHistoryOpen}
        roomId={gameState.game_id}
        onClose={() => setIsHistoryOpen(false)}
        history={history}
        onJumpToMove={requestJumpToMove}
        activeMoveNumber={historicalMoveNumber}
        dimmed={historyLoadingMessage !== null}
        overlayMessage={historyLoadingMessage}
      />

      {isHistoricalView && historicalMoveNumber !== null && (
        <>
          <HistoricalViewBanner
            moveNumber={historicalMoveNumber}
            moveDescription={historicalDescription}
            isGameOver={false}
            canResume={canResumeFromHistory}
            onReturnToPresent={returnToPresent}
            onResumeFromHere={() => setShowResumeDialog(true)}
          />
          <TimelineScrubber
            currentMove={historicalMoveNumber}
            totalMoves={Math.max(totalMoves, historicalMoveNumber)}
            onMoveChange={requestJumpToMove}
          />
        </>
      )}

      <ResumeConfirmationDialog
        isOpen={showResumeDialog}
        moveNumber={historicalMoveNumber ?? 1}
        currentMove={Math.max(totalMoves, historicalMoveNumber ?? 1)}
        isLoading={isResuming}
        onConfirm={confirmResumeFromHere}
        onCancel={() => setShowResumeDialog(false)}
      />

      {historyWarning && (
        <div
          className="fixed left-1/2 top-24 z-40 -translate-x-1/2 rounded border border-amber-400/70 bg-amber-900/90 px-4 py-2 text-sm text-amber-100"
          role="alert"
          data-testid="history-warning"
        >
          <div className="flex items-center gap-2">
            <span>{historyWarning}</span>
            <Button variant="ghost" size="sm" onClick={() => setHistoryWarning(null)}>
              Dismiss
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
