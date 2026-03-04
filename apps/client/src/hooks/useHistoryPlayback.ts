import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useCountdown } from '@/hooks/useCountdown';
import { useHistoryData } from '@/hooks/useHistoryData';
import { isTypingTarget } from '@/lib/utils/dom';
import type { ServerEventNotification } from '@/lib/game-events/types';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { Seat } from '@/types/bindings/generated/Seat';

export interface UseHistoryPlaybackOptions {
  gameState: GameStateSnapshot;
  sendCommand: (command: GameCommand) => void;
  eventBus?: {
    onServerEvent: (handler: (event: ServerEventNotification) => void) => () => void;
  };
  playingIsProcessing: boolean;
}

export interface UseHistoryPlaybackResult {
  history: ReturnType<typeof useHistoryData>;
  isHistoryOpen: boolean;
  isHistoricalView: boolean;
  historicalMoveNumber: number | null;
  historicalDescription: string;
  historyLoadingMessage: string | null;
  historyWarning: string | null;
  showResumeDialog: boolean;
  isResuming: boolean;
  isSoloGame: boolean;
  canJumpToHistory: boolean;
  canResumeFromHistory: boolean;
  totalMoves: number;
  playerSeats: Seat[];
  soloUndoRemaining: number;
  multiplayerUndoRemaining: number;
  undoPending: boolean;
  recentUndoableActions: string[];
  undoNotice: string | null;
  undoRequest: { requester: Seat; target_move: number } | null;
  undoVotes: Partial<Record<Seat, boolean | null>>;
  undoVoteSecondsRemaining: number | null;
  setIsHistoryOpen: (open: boolean) => void;
  setShowResumeDialog: (show: boolean) => void;
  setHistoryWarning: (message: string | null) => void;
  pushUndoAction: (description: string) => void;
  requestJumpToMove: (moveNumber: number) => void;
  returnToPresent: () => void;
  confirmResumeFromHere: () => void;
  requestSoloUndo: () => void;
  requestUndoVote: () => void;
  voteUndo: (approve: boolean) => void;
  clearPendingUndoOnError: (message: string | null) => void;
  handleServerEvent: (event: ServerEventNotification) => boolean;
}

const SOLO_UNDO_LIMIT = 10;
const MULTIPLAYER_UNDO_LIMIT = 3;

export function useHistoryPlayback({
  gameState,
  sendCommand,
  eventBus,
  playingIsProcessing,
}: UseHistoryPlaybackOptions): UseHistoryPlaybackResult {
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
  const pendingUndoTypeRef = useRef<'solo' | 'vote' | null>(null);
  const jumpThrottleRef = useRef<{
    lastSentAt: number;
    timer: ReturnType<typeof setTimeout> | null;
    queuedMove: number | null;
  }>({ lastSentAt: 0, timer: null, queuedMove: null });

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
  const undoVoteSecondsRemaining = useCountdown({
    deadlineMs: undoVoteDeadlineMs,
    intervalMs: 500,
  });

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

  const requestSoloUndo = useCallback(() => {
    if (
      !isSoloGame ||
      soloUndoRemaining <= 0 ||
      undoPending ||
      isHistoricalView ||
      playingIsProcessing
    ) {
      return;
    }
    setUndoPending(true);
    pendingUndoTypeRef.current = 'solo';
    sendCommand({ SmartUndo: { player: gameState.your_seat } });
  }, [
    gameState.your_seat,
    isHistoricalView,
    isSoloGame,
    playingIsProcessing,
    sendCommand,
    soloUndoRemaining,
    undoPending,
  ]);

  const requestUndoVote = useCallback(() => {
    if (
      isSoloGame ||
      multiplayerUndoRemaining <= 0 ||
      undoPending ||
      isHistoricalView ||
      playingIsProcessing
    ) {
      return;
    }
    setUndoPending(true);
    pendingUndoTypeRef.current = 'vote';
    sendCommand({ SmartUndo: { player: gameState.your_seat } });
  }, [
    gameState.your_seat,
    isHistoricalView,
    isSoloGame,
    multiplayerUndoRemaining,
    playingIsProcessing,
    sendCommand,
    undoPending,
  ]);

  const voteUndo = useCallback(
    (approve: boolean) => {
      if (!undoRequest || undoVoteSecondsRemaining === null || undoVoteSecondsRemaining <= 0)
        return;
      if (undoRequest.requester === gameState.your_seat) return;
      if (undoVotes[gameState.your_seat] != null) return;

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

  const clearPendingUndoOnError = useCallback((message: string | null) => {
    if (!message || !pendingUndoTypeRef.current) return;
    pendingUndoTypeRef.current = null;
    setUndoPending(false);
  }, []);

  const handleServerEvent = useCallback(
    (event: ServerEventNotification) => {
      if (event.type === 'state-restored') {
        if (pendingUndoTypeRef.current === 'solo') {
          setSoloUndoRemaining((prev) => Math.max(0, prev - 1));
          setUndoNotice(`Undid: ${event.description}`);
          setUndoPending(false);
          pendingUndoTypeRef.current = null;
        } else if (pendingUndoTypeRef.current === 'vote') {
          setMultiplayerUndoRemaining((prev) => Math.max(0, prev - 1));
          setUndoPending(false);
          pendingUndoTypeRef.current = null;
        }

        setHistoryLoadingMessage(null);
        setHistoricalMoveNumber(event.moveNumber);
        setHistoricalDescription(event.description);
        setIsHistoricalView(event.mode !== 'None');
        if (event.mode === 'None') {
          setIsResuming(false);
        }
        return true;
      }

      if (event.type === 'history-truncated') {
        const deletedMoves = Math.max(0, totalMoves - event.fromMove + 1);
        setHistoryWarning(
          `${deletedMoves} future moves deleted. Game resumed from move #${Math.max(1, event.fromMove - 1)}.`
        );
        return true;
      }

      if (event.type === 'undo-requested') {
        const nextVotes: Partial<Record<Seat, boolean | null>> = {};
        for (const seat of playerSeats) {
          nextVotes[seat] = seat === event.requester ? true : null;
        }
        setUndoRequest({ requester: event.requester, target_move: event.targetMove });
        setUndoVotes(nextVotes);
        setUndoVoteDeadlineMs(Date.now() + 30000);
        setUndoPending(false);
        return true;
      }

      if (event.type === 'undo-vote-registered') {
        setUndoVotes((prev) => ({ ...prev, [event.voter]: event.approved }));
        return true;
      }

      if (event.type === 'undo-request-resolved') {
        setUndoNotice(
          event.approved ? 'Undo approved - game state restored' : 'Undo denied - game continues'
        );
        if (event.approved) {
          setMultiplayerUndoRemaining((prev) => Math.max(0, prev - 1));
        }
        setUndoRequest(null);
        setUndoVotes({});
        setUndoVoteDeadlineMs(null);
        setUndoPending(false);
        pendingUndoTypeRef.current = null;
        return true;
      }

      if (event.type === 'history-error') {
        setHistoryLoadingMessage(null);
        setIsResuming(false);
        setHistoryWarning(event.message);
        return true;
      }

      return false;
    },
    [playerSeats, totalMoves]
  );

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey && (event.key === 'z' || event.key === 'Z')) {
        if (!isTypingTarget(event.target)) {
          event.preventDefault();
          requestSoloUndo();
        }
        return;
      }

      if (event.key !== 'h' && event.key !== 'H') return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      setIsHistoryOpen((prev) => !prev);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [requestSoloUndo]);

  useEffect(() => {
    const throttleState = jumpThrottleRef.current;
    return () => {
      const timer = throttleState.timer;
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, []);

  useEffect(() => {
    if (!isHistoricalView) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) return;
      const currentMove = historicalMoveNumber ?? 1;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          requestJumpToMove(Math.max(1, currentMove - 1));
          break;
        case 'ArrowRight':
          event.preventDefault();
          requestJumpToMove(Math.min(totalMoves, currentMove + 1));
          break;
        case 'Home':
          event.preventDefault();
          requestJumpToMove(1);
          break;
        case 'End':
          event.preventDefault();
          requestJumpToMove(totalMoves);
          break;
        case 'Escape':
          event.preventDefault();
          returnToPresent();
          break;
        case 'r':
        case 'R':
          if (canResumeFromHistory) {
            event.preventDefault();
            setShowResumeDialog(true);
          }
          break;
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

  return {
    history,
    isHistoryOpen,
    isHistoricalView,
    historicalMoveNumber,
    historicalDescription,
    historyLoadingMessage,
    historyWarning,
    showResumeDialog,
    isResuming,
    isSoloGame,
    canJumpToHistory,
    canResumeFromHistory,
    totalMoves,
    playerSeats,
    soloUndoRemaining,
    multiplayerUndoRemaining,
    undoPending,
    recentUndoableActions,
    undoNotice,
    undoRequest,
    undoVotes,
    undoVoteSecondsRemaining,
    setIsHistoryOpen,
    setShowResumeDialog,
    setHistoryWarning,
    pushUndoAction,
    requestJumpToMove,
    returnToPresent,
    confirmResumeFromHere,
    requestSoloUndo,
    requestUndoVote,
    voteUndo,
    clearPendingUndoOnError,
    handleServerEvent,
  };
}
