/**
 * GameBoard Component
 *
 * Main game container that orchestrates all game components and manages
 * WebSocket communication with the backend.
 *
 * Related: All user stories - this is the main game container
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { DiceOverlay } from './DiceOverlay';
import { Wall } from './Wall';
import { WallCounter } from './WallCounter';
import { ActionBar } from './ActionBar';
import { ConcealedHand } from './ConcealedHand';
import { CharlestonTracker } from './CharlestonTracker';
import { PassAnimationLayer } from './PassAnimationLayer';
import { BlindPassPanel } from './BlindPassPanel';
import { IOUOverlay } from './IOUOverlay';
import { VotingPanel } from './VotingPanel';
import { VoteResultOverlay } from './VoteResultOverlay';
import { TurnIndicator } from './TurnIndicator';
import { DiscardPool } from './DiscardPool';
import { DiscardAnimationLayer } from './DiscardAnimationLayer';
import { CallWindowPanel } from './CallWindowPanel';
import { CallResolutionOverlay } from './CallResolutionOverlay';
import { ExposedMeldsArea } from './ExposedMeldsArea';
import { CharlestonPhase } from './phases/CharlestonPhase';
import { PlayingPhase } from './phases/PlayingPhase';
import { SetupPhase } from './phases/SetupPhase';
import { useTileSelection } from '@/hooks/useTileSelection';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { useGameSocket, type Envelope } from '@/hooks/useGameSocket';
import { useGameEvents } from '@/hooks/useGameEvents';
import { getTileName, isJoker, sortHand, TILE_INDICES } from '@/lib/utils/tileUtils';
import type { UIStateAction } from '@/lib/game-events/types';
import type { CallIntentSummary } from '@/types/bindings/generated/CallIntentSummary';
import type { CallResolution } from '@/types/bindings/generated/CallResolution';
import type { CallTieBreakReason } from '@/types/bindings/generated/CallTieBreakReason';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { PrivateEvent } from '@/types/bindings/generated/PrivateEvent';
import type { DiscardInfo } from '@/types/bindings/generated/DiscardInfo';
import type { PlayerStatus } from '@/types/bindings/generated/PlayerStatus';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';
import type { CharlestonState } from '@/types/bindings/generated/CharlestonState';
import type { TimerMode } from '@/types/bindings/generated/TimerMode';
import type { PassDirection } from '@/types/bindings/generated/PassDirection';
import type { Event as ServerEvent } from '@/types/bindings/generated/Event';
import type { Meld } from '@/types/bindings/generated/Meld';
import type { TileInstance } from './types';

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

type EventEnvelope = {
  kind: 'Event';
  payload: {
    event: ServerEvent;
  };
};

type StateSnapshotEnvelope = {
  kind: 'StateSnapshot';
  payload: {
    snapshot: GameState;
  };
};

type ErrorEnvelope = {
  kind: 'Error';
  payload: {
    code: string;
    message: string;
    context?: unknown;
  };
};

type IncomingEnvelope = EventEnvelope | StateSnapshotEnvelope | ErrorEnvelope;

/**
 * Feature flag: Use refactored CharlestonPhase component
 * Phase 2 of GAMEBOARD_REFACTORING_PLAN.md
 * When enabled, uses the extracted CharlestonPhase component instead of inline logic.
 * Default: false (no behavior change)
 */
const USE_CHARLESTON_PHASE_COMPONENT = true;

/**
 * Feature flag: Use refactored PlayingPhase component
 * Phase 3 of GAMEBOARD_REFACTORING_PLAN.md
 * When enabled, uses the extracted PlayingPhase component instead of inline logic.
 * Default: false (no behavior change)
 */
const USE_PLAYING_PHASE_COMPONENT = true;

/**
 * Feature flag: Use event bridge (useGameEvents)
 * Phase 4 of GAMEBOARD_REFACTORING_PLAN.md
 * When enabled, uses useGameEvents hook for event handling instead of inline logic.
 * Default: false (no behavior change)
 */
const USE_EVENT_BRIDGE = true;

const useCharlestonPhaseComponent = USE_CHARLESTON_PHASE_COMPONENT && !USE_EVENT_BRIDGE;
const usePlayingPhaseComponent = USE_PLAYING_PHASE_COMPONENT && !USE_EVENT_BRIDGE;

/**
 * GameBoard is the main game container
 */
export const GameBoard: React.FC<GameBoardProps> = ({ initialState, ws }) => {
  // WebSocket connection (Phase 4: Event Bridge)
  // If ws prop provided (testing), use it; otherwise use useGameSocket hook
  const socket = useGameSocket();

  // Local game state (used when USE_EVENT_BRIDGE is false)
  const [localGameState, setLocalGameState] = useState<GameState | null>(initialState || null);
  const setGameState = setLocalGameState;

  // UI state
  const [diceRoll, setDiceRoll] = useState<number | null>(null);
  const [showDiceOverlay, setShowDiceOverlay] = useState(false);

  // Charleston state
  const [readyPlayers, setReadyPlayers] = useState<Seat[]>([]);
  const [hasSubmittedPass, setHasSubmittedPass] = useState(false);
  const [selectionError, setSelectionError] = useState<{ tileId: string; message: string } | null>(
    null
  );
  const [leavingTileIds, setLeavingTileIds] = useState<string[]>([]);
  const [highlightedTileIds, setHighlightedTileIds] = useState<string[]>([]);
  const [incomingFromSeat, setIncomingFromSeat] = useState<Seat | null>(null);
  const [botPassMessage, setBotPassMessage] = useState<string | null>(null);
  const [passDirection, setPassDirection] = useState<PassDirection | null>(null);
  const [charlestonTimer, setCharlestonTimer] = useState<{
    stage: CharlestonStage;
    durationSeconds: number;
    startedAtMs: number;
    expiresAtMs: number;
    mode: TimerMode;
  } | null>(null);
  const [timerRemainingSeconds, setTimerRemainingSeconds] = useState<number | null>(null);
  const [blindPassCount, setBlindPassCount] = useState(0);
  const [hasSubmittedVote, setHasSubmittedVote] = useState(false);
  const [myVote, setMyVote] = useState<CharlestonVote | null>(null);
  const [votedPlayers, setVotedPlayers] = useState<Seat[]>([]);
  const [voteResult, setVoteResult] = useState<CharlestonVote | null>(null);
  const [voteBreakdown, setVoteBreakdown] = useState<Record<Seat, CharlestonVote> | null>(null);
  const [showVoteResultOverlay, setShowVoteResultOverlay] = useState(false);
  const [botVoteMessage, setBotVoteMessage] = useState<string | null>(null);
  const [pendingVoteCommand, setPendingVoteCommand] = useState<GameCommand | null>(null);
  const [voteRetryCount, setVoteRetryCount] = useState(0);
  const [pendingDrawCommand, setPendingDrawCommand] = useState<GameCommand | null>(null);
  const [drawRetryCount, setDrawRetryCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [iouState, setIouState] = useState<{
    active: boolean;
    debts: Array<[Seat, number]>;
    resolved: boolean;
    summary?: string;
  } | null>(null);
  // Playing phase state
  const [isProcessing, setIsProcessing] = useState(false);
  const [mostRecentDiscard, setMostRecentDiscard] = useState<Tile | null>(null);

  // Call window state (US-011)
  const [callWindowState, setCallWindowState] = useState<{
    active: boolean;
    tile: Tile;
    discardedBy: Seat;
    canCall: Seat[];
    canAct: Seat[];
    intents: CallIntentSummary[];
    timerStart: number;
    timerDuration: number;
    hasResponded: boolean;
    responseMessage?: string;
  } | null>(null);
  const [callWindowTimer, setCallWindowTimer] = useState<number | null>(null);
  const callWindowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [discardAnimationTile, setDiscardAnimationTile] = useState<Tile | null>(null);

  // Call resolution overlay state (US-012)
  const [resolutionOverlay, setResolutionOverlay] = useState<{
    resolution: CallResolution;
    tieBreak: CallTieBreakReason | null;
    allCallers: CallIntentSummary[];
    discardedBy: Seat;
  } | null>(null);

  // Store intents in ref for reliable access in CallResolved (avoid async state issues)
  const callIntentsRef = useRef<{
    intents: CallIntentSummary[];
    discardedBy: Seat | null;
  }>({ intents: [], discardedBy: null });
  const selectionErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incomingSeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botPassTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botVoteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voteRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDrawTurnRef = useRef<Seat | null>(null);
  const hasDrawnThisTurnRef = useRef(false);

  // Sound effects hook
  const { playSound } = useSoundEffects({ volume: 0.5, enabled: true });

  const clearSelectionError = useCallback(() => {
    if (selectionErrorTimeoutRef.current) {
      clearTimeout(selectionErrorTimeoutRef.current);
      selectionErrorTimeoutRef.current = null;
    }
    setSelectionError(null);
  }, []);

  /**
   * UI Action Dispatcher (Phase 4: Event Bridge)
   * Routes UIStateAction objects from event handlers to component state setters
   */
  const dispatchUIAction = useCallback((action: UIStateAction) => {
    switch (action.type) {
      // Setup phase
      case 'SET_DICE_ROLL':
        setDiceRoll(action.value);
        break;
      case 'SET_SHOW_DICE_OVERLAY':
        setShowDiceOverlay(action.value);
        break;
      case 'SET_SETUP_PHASE':
        setLocalGameState((prev) => (prev ? { ...prev, phase: { Setup: action.phase } } : null));
        break;

      // Charleston phase
      case 'RESET_CHARLESTON_STATE':
        setReadyPlayers([]);
        setHasSubmittedPass(false);
        setSelectionError(null);
        setLeavingTileIds([]);
        setHighlightedTileIds([]);
        setIncomingFromSeat(null);
        setBotPassMessage(null);
        setPassDirection(null);
        setCharlestonTimer(null);
        setTimerRemainingSeconds(null);
        setBlindPassCount(0);
        setHasSubmittedVote(false);
        setMyVote(null);
        setVotedPlayers([]);
        setVoteResult(null);
        setVoteBreakdown(null);
        setShowVoteResultOverlay(false);
        setBotVoteMessage(null);
        setPendingVoteCommand(null);
        setVoteRetryCount(0);
        setIouState(null);
        setErrorMessage(null);
        break;

      case 'SET_READY_PLAYERS':
        setReadyPlayers(action.value);
        break;
      case 'ADD_READY_PLAYER':
        setReadyPlayers((prev) => [...prev, action.seat]);
        break;
      case 'SET_HAS_SUBMITTED_PASS':
        setHasSubmittedPass(action.value);
        break;
      case 'SET_CHARLESTON_TIMER':
        setCharlestonTimer(action.timer);
        break;
      case 'SET_TIMER_REMAINING_SECONDS':
        setTimerRemainingSeconds(action.value);
        break;
      case 'SET_INCOMING_FROM_SEAT':
        setIncomingFromSeat(action.seat);
        break;
      case 'SET_BOT_PASS_MESSAGE':
        setBotPassMessage(action.message);
        break;
      case 'SET_PASS_DIRECTION':
        setPassDirection(action.direction);
        break;
      case 'SET_BLIND_PASS_COUNT':
        setBlindPassCount(action.count);
        break;
      case 'SET_HIGHLIGHTED_TILE_IDS':
        setHighlightedTileIds(action.ids);
        break;
      case 'SET_LEAVING_TILE_IDS':
        setLeavingTileIds(action.ids);
        break;

      // Charleston voting
      case 'SET_HAS_SUBMITTED_VOTE':
        setHasSubmittedVote(action.value);
        break;
      case 'SET_MY_VOTE':
        setMyVote(action.vote);
        break;
      case 'SET_VOTED_PLAYERS':
        setVotedPlayers(action.value);
        break;
      case 'ADD_VOTED_PLAYER':
        setVotedPlayers((prev) => [...prev, action.seat]);
        break;
      case 'SET_VOTE_RESULT':
        setVoteResult(action.result);
        break;
      case 'SET_VOTE_BREAKDOWN':
        setVoteBreakdown(action.breakdown);
        break;
      case 'SET_SHOW_VOTE_RESULT_OVERLAY':
        setShowVoteResultOverlay(action.value);
        break;
      case 'SET_BOT_VOTE_MESSAGE':
        setBotVoteMessage(action.message);
        break;

      // Playing phase
      case 'SET_CURRENT_TURN':
        setLocalGameState((prev) => (prev ? { ...prev, current_turn: action.seat } : null));
        break;
      case 'SET_TURN_STAGE':
        setLocalGameState((prev) => (prev ? { ...prev, phase: { Playing: action.stage } } : null));
        break;
      case 'SET_IS_PROCESSING':
        setIsProcessing(action.value);
        break;
      case 'SET_MOST_RECENT_DISCARD':
        setMostRecentDiscard(action.tile);
        break;
      case 'SET_DISCARD_ANIMATION_TILE':
        setDiscardAnimationTile(action.tile);
        break;

      // Call window
      case 'OPEN_CALL_WINDOW':
        setCallWindowState({
          active: true,
          tile: action.params.tile,
          discardedBy: action.params.discardedBy,
          canCall: action.params.canCall,
          canAct: action.params.canCall,
          intents: [],
          timerStart: action.params.timerStart,
          timerDuration: action.params.timerDuration,
          hasResponded: false,
        });
        break;
      case 'UPDATE_CALL_WINDOW_PROGRESS':
        setCallWindowState((prev) =>
          prev
            ? {
                ...prev,
                canAct: action.canAct,
                intents: action.intents,
              }
            : null
        );
        break;
      case 'CLOSE_CALL_WINDOW':
        setCallWindowState(null);
        setCallWindowTimer(null);
        break;
      case 'MARK_CALL_WINDOW_RESPONDED':
        setCallWindowState((prev) =>
          prev
            ? {
                ...prev,
                hasResponded: true,
                responseMessage: action.message,
              }
            : null
        );
        break;
      case 'SET_CALL_WINDOW_TIMER':
        setCallWindowTimer(action.remaining);
        break;
      case 'SHOW_RESOLUTION_OVERLAY':
        setResolutionOverlay(action.data);
        break;
      case 'DISMISS_RESOLUTION_OVERLAY':
        setResolutionOverlay(null);
        break;
      case 'SET_IOU_STATE':
        setIouState(action.state);
        break;
      case 'RESOLVE_IOU':
        setIouState((prev) =>
          prev
            ? { ...prev, resolved: true, summary: action.summary }
            : { active: true, debts: [], resolved: true, summary: action.summary }
        );
        break;
      case 'CLEAR_IOU':
        setIouState(null);
        break;

      // Error handling
      case 'SET_ERROR_MESSAGE':
        setErrorMessage(action.message);
        break;
      case 'CLEAR_SELECTION':
        clearSelection();
        break;
      case 'CLEAR_SELECTION_ERROR':
        setSelectionError(null);
        break;
      case 'CLEAR_PENDING_VOTE_RETRY':
        setPendingVoteCommand(null);
        setVoteRetryCount(0);
        if (voteRetryTimeoutRef.current) {
          clearTimeout(voteRetryTimeoutRef.current);
          voteRetryTimeoutRef.current = null;
        }
        break;
      case 'CLEAR_PENDING_DRAW_RETRY':
        setPendingDrawCommand(null);
        setDrawRetryCount(0);
        if (drawRetryTimeoutRef.current) {
          clearTimeout(drawRetryTimeoutRef.current);
          drawRetryTimeoutRef.current = null;
        }
        break;

      default:
        console.warn('[GameBoard] Unknown UI action:', action);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // clearSelection from useTileSelection is stable (memoized)

  const eventBridgeSocket = useMemo(() => {
    if (ws) {
      return {
        send: (envelope: Envelope) => {
          ws.send(JSON.stringify(envelope));
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

          ws.addEventListener('message', handler);
          return () => ws.removeEventListener('message', handler);
        },
      };
    }

    return {
      send: socket.send,
      subscribe: socket.subscribe,
    };
  }, [ws, socket.send, socket.subscribe]);

  const eventBridgeEnabled = USE_EVENT_BRIDGE && (!!ws || socket.connectionState === 'connected');

  const eventBridgeResult = useGameEvents({
    socket: eventBridgeSocket,
    initialState: initialState || null,
    dispatchUIAction,
    debug: import.meta.env.DEV,
    enabled: eventBridgeEnabled,
  });

  // Game state: from event bridge (if enabled) or local state
  const gameState = eventBridgeEnabled ? eventBridgeResult.gameState : localGameState;

  // Determine if we're in Charleston phase
  const isCharleston =
    gameState !== null && typeof gameState.phase === 'object' && 'Charleston' in gameState.phase;

  const charlestonStage: CharlestonStage | undefined =
    isCharleston && typeof gameState!.phase === 'object' && 'Charleston' in gameState!.phase
      ? (gameState!.phase as { Charleston: CharlestonStage }).Charleston
      : undefined;

  const isBlindPassStage = charlestonStage === 'FirstLeft' || charlestonStage === 'SecondRight';
  const isVotingStage = charlestonStage === 'VotingToContinue';
  const isDiscardingMyTurn =
    gameState !== null &&
    typeof gameState.phase === 'object' &&
    'Playing' in gameState.phase &&
    typeof gameState.phase.Playing === 'object' &&
    'Discarding' in gameState.phase.Playing &&
    gameState.phase.Playing.Discarding.player === gameState.your_seat;

  const tileInstances: TileInstance[] = useMemo(() => {
    if (!gameState) return [];
    return gameState.your_hand.map((tile, index) => ({
      id: `${tile}-${index}`,
      tile,
    }));
  }, [gameState]);

  const tileById = useMemo(() => {
    return new Map(tileInstances.map((instance) => [instance.id, instance.tile]));
  }, [tileInstances]);

  // Tile selection for Charleston
  const disabledTileIds = useMemo(() => {
    if (!isCharleston) return [];
    return tileInstances.filter((tile) => isJoker(tile.tile)).map((tile) => tile.id);
  }, [isCharleston, tileInstances]);

  const handMaxSelection = isDiscardingMyTurn ? 1 : isBlindPassStage ? 3 - blindPassCount : 3;

  const { selectedIds, toggleTile, clearSelection, selectTiles } = useTileSelection({
    maxSelection: handMaxSelection,
    disabledIds: disabledTileIds,
  });

  const selectedTiles = useMemo(
    () =>
      selectedIds.map((id) => tileById.get(id)).filter((tile): tile is Tile => tile !== undefined),
    [selectedIds, tileById]
  );

  const tileCounts = useMemo(() => {
    const counts = new Map<Tile, number>();
    if (!gameState) return counts;
    for (const tile of gameState.your_hand) {
      counts.set(tile, (counts.get(tile) ?? 0) + 1);
    }
    return counts;
  }, [gameState]);

  const callWindowRespondedSeats = useMemo(() => {
    if (!callWindowState) return [] as Seat[];
    return callWindowState.canCall.filter((seat) => !callWindowState.canAct.includes(seat));
  }, [callWindowState]);

  // Helper to update setup phase
  const updateSetupPhase = useCallback(
    (stage: 'RollingDice' | 'BreakingWall' | 'Dealing' | 'OrganizingHands') => {
      setGameState((prev) =>
        prev
          ? {
              ...prev,
              phase: { Setup: stage },
            }
          : null
      );
    },
    [setGameState]
  );

  const handlePublicEvent = useCallback(
    (event: PublicEvent) => {
      if (event === 'CallWindowClosed') {
        setCallWindowState(null);
        setCallWindowTimer(null);
        if (callWindowTimeoutRef.current) {
          clearTimeout(callWindowTimeoutRef.current);
          callWindowTimeoutRef.current = null;
        }
        return;
      }

      // String variants (e.g. "GameStarting", "CharlestonComplete") have no data to handle
      if (typeof event !== 'object' || event === null) return;

      // DiceRolled event
      if ('DiceRolled' in event) {
        setDiceRoll(event.DiceRolled.roll);
        setShowDiceOverlay(true);
        updateSetupPhase('BreakingWall');
      }

      // WallBroken event
      if ('WallBroken' in event) {
        setGameState((prev) =>
          prev
            ? {
                ...prev,
                wall_break_point: event.WallBroken.position,
              }
            : null
        );
        updateSetupPhase('Dealing');
      }

      // CharlestonPhaseChanged event
      if ('CharlestonPhaseChanged' in event) {
        setGameState((prev) =>
          prev
            ? {
                ...prev,
                phase: { Charleston: event.CharlestonPhaseChanged.stage },
              }
            : null
        );
        // Reset Charleston UI state for new stage
        clearSelection();
        setReadyPlayers([]);
        setHasSubmittedPass(false);
        setHasSubmittedVote(false);
        setMyVote(null);
        setVotedPlayers([]);
        setVoteResult(null);
        setVoteBreakdown(null);
        setShowVoteResultOverlay(false);
        setCharlestonTimer(null);
        setTimerRemainingSeconds(null);
        setIncomingFromSeat(null);
        setBotPassMessage(null);
        setBotVoteMessage(null);
        setBlindPassCount(0);
        setIouState(null);
        setErrorMessage(null);
        setPendingVoteCommand(null);
        setVoteRetryCount(0);
        clearSelectionError();
        if (botPassTimeoutRef.current) {
          clearTimeout(botPassTimeoutRef.current);
          botPassTimeoutRef.current = null;
        }
        if (botVoteTimeoutRef.current) {
          clearTimeout(botVoteTimeoutRef.current);
          botVoteTimeoutRef.current = null;
        }
        if (incomingSeatTimeoutRef.current) {
          clearTimeout(incomingSeatTimeoutRef.current);
          incomingSeatTimeoutRef.current = null;
        }
        if (errorMessageTimeoutRef.current) {
          clearTimeout(errorMessageTimeoutRef.current);
          errorMessageTimeoutRef.current = null;
        }
        if (voteRetryTimeoutRef.current) {
          clearTimeout(voteRetryTimeoutRef.current);
          voteRetryTimeoutRef.current = null;
        }
      }

      // CharlestonTimerStarted event
      if ('CharlestonTimerStarted' in event) {
        const timer = event.CharlestonTimerStarted;
        const expiresAtMs = Number(timer.started_at_ms) + timer.duration * 1000;
        setCharlestonTimer({
          stage: timer.stage,
          durationSeconds: timer.duration,
          startedAtMs: Number(timer.started_at_ms),
          expiresAtMs,
          mode: timer.timer_mode,
        });
      }

      // PlayerReadyForPass event
      if ('PlayerReadyForPass' in event) {
        setReadyPlayers((prev) => {
          const player = event.PlayerReadyForPass.player;
          if (prev.includes(player)) return prev;
          return [...prev, player];
        });

        const playerSeat = event.PlayerReadyForPass.player;
        const matchingPlayer = gameState?.players.find((player) => player.seat === playerSeat);
        if (matchingPlayer?.is_bot) {
          setBotPassMessage(`${playerSeat} (Bot) has passed tiles.`);
          if (botPassTimeoutRef.current) {
            clearTimeout(botPassTimeoutRef.current);
          }
          botPassTimeoutRef.current = setTimeout(() => setBotPassMessage(null), 2500);
        }
      }

      // TilesPassing event - show pass animation overlay
      if ('TilesPassing' in event) {
        setPassDirection(event.TilesPassing.direction);
        setTimeout(() => setPassDirection(null), 600);
      }

      // BlindPassPerformed event - public notification of blind pass
      if ('BlindPassPerformed' in event) {
        const { player, blind_count, hand_count } = event.BlindPassPerformed;
        const isMe = player === gameState?.your_seat;
        const isBot = gameState?.players.find((p) => p.seat === player)?.is_bot ?? false;
        const playerLabel = isBot ? `${player} (Bot)` : player;
        const message = isMe
          ? `You passed ${blind_count} tiles blindly and ${hand_count} from hand`
          : `${playerLabel} passed ${blind_count} blind, ${hand_count} from hand`;
        setBotPassMessage(message);
        if (botPassTimeoutRef.current) {
          clearTimeout(botPassTimeoutRef.current);
        }
        botPassTimeoutRef.current = setTimeout(() => setBotPassMessage(null), 3000);
      }

      // IOUDetected event
      if ('IOUDetected' in event) {
        setIouState({
          active: true,
          debts: event.IOUDetected.debts,
          resolved: false,
        });
      }

      // IOUResolved event
      if ('IOUResolved' in event) {
        setIouState((prev) =>
          prev ? { ...prev, resolved: true, summary: event.IOUResolved.summary } : null
        );
        // Auto-dismiss after 3 seconds
        setTimeout(() => setIouState(null), 3000);
      }

      // PlayerVoted event (US-005 AC-4, AC-9)
      if ('PlayerVoted' in event) {
        const votedSeat = event.PlayerVoted.player;
        setVotedPlayers((prev) => {
          if (prev.includes(votedSeat)) return prev;
          return [...prev, votedSeat];
        });

        // Bot vote message (AC-9)
        const matchingPlayer = gameState?.players.find((p) => p.seat === votedSeat);
        if (matchingPlayer?.is_bot) {
          setBotVoteMessage(`${votedSeat} (Bot) has voted`);
          if (botVoteTimeoutRef.current) {
            clearTimeout(botVoteTimeoutRef.current);
          }
          botVoteTimeoutRef.current = setTimeout(() => setBotVoteMessage(null), 2500);
        }

        // Clear pending vote command if we get our own ack (EC-7 retry)
        if (votedSeat === gameState?.your_seat) {
          setPendingVoteCommand(null);
          setVoteRetryCount(0);
          if (voteRetryTimeoutRef.current) {
            clearTimeout(voteRetryTimeoutRef.current);
            voteRetryTimeoutRef.current = null;
          }
        }
      }

      // VoteResult event (US-005 AC-5, AC-6, AC-10)
      if ('VoteResult' in event) {
        setVoteResult(event.VoteResult.result);
        setVoteBreakdown(event.VoteResult.votes as Record<Seat, CharlestonVote>);
        setShowVoteResultOverlay(true);
      }

      // CharlestonComplete event (US-005 AC-5)
      // String variant event - voting state will be reset when PhaseChanged arrives

      // PhaseChanged event (authoritative phase transitions)
      if ('PhaseChanged' in event) {
        setGameState((prev) =>
          prev
            ? {
                ...prev,
                phase: event.PhaseChanged.phase,
              }
            : null
        );
      }

      // TurnChanged event
      if ('TurnChanged' in event) {
        setGameState((prev) =>
          prev
            ? {
                ...prev,
                current_turn: event.TurnChanged.player,
                phase: { Playing: event.TurnChanged.stage },
              }
            : null
        );
      }

      // TileDrawnPublic event
      if ('TileDrawnPublic' in event) {
        setGameState((prev) =>
          prev
            ? {
                ...prev,
                wall_tiles_remaining: event.TileDrawnPublic.remaining_tiles,
              }
            : null
        );
      }

      // TileDiscarded event (US-010 AC-6)
      if ('TileDiscarded' in event) {
        const { player, tile } = event.TileDiscarded;
        setGameState((prev) => {
          if (!prev) return null;

          // If it's my discard, remove the tile from my hand
          const newHand =
            player === prev.your_seat
              ? prev.your_hand.filter((_t, index) => {
                  // Remove first occurrence of the discarded tile
                  const found = prev.your_hand.indexOf(tile);
                  return index !== found;
                })
              : prev.your_hand;

          // Add tile to discard pool
          const newDiscard: LocalDiscardInfo = {
            tile,
            discarded_by: player,
            player,
            turn: 0, // Turn number tracking deferred
            safe: false,
            called: false,
          };

          const discardPile = prev.discard_pile || [];

          return {
            ...prev,
            your_hand: newHand,
            discard_pile: [...discardPile, newDiscard],
          };
        });

        // Track most recent discard for highlighting
        setMostRecentDiscard(tile);
        setTimeout(() => setMostRecentDiscard(null), 2000);

        // Clear processing state and selection
        setIsProcessing(false);
        clearSelection();

        // Play discard sound effect
        playSound('tile-discard');
      }

      // WallExhausted event (US-009 AC-8)
      if ('WallExhausted' in event) {
        setGameState((prev) =>
          prev
            ? {
                ...prev,
                wall_tiles_remaining: event.WallExhausted.remaining_tiles,
              }
            : null
        );
        setErrorMessage('Wall exhausted - Draw game');
        if (errorMessageTimeoutRef.current) {
          clearTimeout(errorMessageTimeoutRef.current);
        }
        // Keep message visible longer for important game-ending event
        errorMessageTimeoutRef.current = setTimeout(() => setErrorMessage(null), 5000);
      }

      // CallWindowOpened event (US-011 AC-1, AC-10)
      if ('CallWindowOpened' in event) {
        const { tile, discarded_by, can_call, timer, started_at_ms } = event.CallWindowOpened;
        const isEligible = can_call.includes(gameState?.your_seat || 'East');

        // Initialize intents ref for US-012
        callIntentsRef.current = { intents: [], discardedBy: discarded_by };

        if (isEligible) {
          // AC-1: Show call window if I'm eligible
          setCallWindowState({
            active: true,
            tile,
            discardedBy: discarded_by,
            canCall: can_call,
            canAct: can_call,
            intents: [],
            timerStart: Number(started_at_ms),
            timerDuration: timer,
            hasResponded: false,
          });
          playSound('tile-draw'); // Use tile-draw sound for call window opening
        } else {
          const tileName = getTileName(tile);
          const callers = can_call.length > 0 ? can_call.join(', ') : 'No one';
          setErrorMessage(`${callers} can call ${tileName}`);
          if (errorMessageTimeoutRef.current) {
            clearTimeout(errorMessageTimeoutRef.current);
          }
          errorMessageTimeoutRef.current = setTimeout(() => setErrorMessage(null), 3000);
        }
        // AC-10: If not eligible, just wait for resolution
      }

      if ('CallWindowProgress' in event) {
        const { can_act, intents } = event.CallWindowProgress;
        // Store intents in ref for US-012 (reliable access in CallResolved)
        callIntentsRef.current.intents = intents;
        setCallWindowState((prev) =>
          prev
            ? {
                ...prev,
                canAct: can_act,
                intents,
              }
            : prev
        );
      }

      // CallResolved event (US-011 AC-6, AC-7; US-012 AC-1, AC-2, AC-3, AC-4)
      if ('CallResolved' in event) {
        const { resolution, tie_break } = event.CallResolved;

        // US-012: Show resolution overlay if there was competition
        // Use ref instead of state to avoid async state update issues
        const allCallers = callIntentsRef.current.intents;
        const discardedBy = callIntentsRef.current.discardedBy || 'East';

        if (resolution !== 'NoCall' && allCallers.length > 0) {
          // Show overlay for resolved calls with callers
          setResolutionOverlay({
            resolution,
            tieBreak: tie_break,
            allCallers,
            discardedBy,
          });
        } else {
          // NoCall or no intents - just show simple message
          let message = '';
          const tieNote = tie_break ? ' (closer to discarder)' : '';

          if (resolution === 'NoCall') {
            message = 'No one called the tile';
          } else if ('Mahjong' in resolution) {
            message = `${resolution.Mahjong} wins call for Mahjong${tieNote}`;
          } else if ('Meld' in resolution) {
            message = `${resolution.Meld.seat} wins call for ${resolution.Meld.meld.meld_type}${tieNote}`;
          }

          setErrorMessage(message);
          if (errorMessageTimeoutRef.current) {
            clearTimeout(errorMessageTimeoutRef.current);
          }
          errorMessageTimeoutRef.current = setTimeout(() => setErrorMessage(null), 3000);
        }

        // Close call window
        setCallWindowState(null);
        setCallWindowTimer(null);
        if (callWindowTimeoutRef.current) {
          clearTimeout(callWindowTimeoutRef.current);
          callWindowTimeoutRef.current = null;
        }
        // Clear intents ref after resolution processed
        setTimeout(() => {
          callIntentsRef.current = { intents: [], discardedBy: null };
        }, 100);
      }

      // CallWindowClosed event (US-011 AC-8)
      if ('CallWindowClosed' in event) {
        setCallWindowState(null);
        setCallWindowTimer(null);
        if (callWindowTimeoutRef.current) {
          clearTimeout(callWindowTimeoutRef.current);
          callWindowTimeoutRef.current = null;
        }
        // Clear intents ref
        callIntentsRef.current = { intents: [], discardedBy: null };
      }

      // TileCalled event (US-013 AC-1, AC-2, AC-3, AC-4, AC-5)
      if ('TileCalled' in event) {
        const { player, meld, called_tile, called_from } = event.TileCalled;

        setGameState((prev) => {
          if (!prev) return null;

          // Initialize exposed_melds if not present
          const exposedMelds = prev.exposed_melds || {
            East: [],
            South: [],
            West: [],
            North: [],
          };

          // Add meld to player's exposed melds
          const updatedExposedMelds = {
            ...exposedMelds,
            [player]: [...exposedMelds[player], { ...meld, called_from }],
          };

          // If it's my meld, remove tiles from hand
          let newHand = prev.your_hand;
          if (player === prev.your_seat) {
            // Remove tiles that were used to form the meld (excluding the called tile)
            const tilesToRemove = [...meld.tiles];
            // Remove one instance of called_tile since it came from discard
            const calledIndex = tilesToRemove.indexOf(called_tile);
            if (calledIndex !== -1) {
              tilesToRemove.splice(calledIndex, 1);
            }

            // Remove tiles from hand
            newHand = [...prev.your_hand];
            for (const tile of tilesToRemove) {
              const idx = newHand.indexOf(tile);
              if (idx !== -1) {
                newHand.splice(idx, 1);
              }
            }
            newHand = sortHand(newHand);
          }

          // Remove called tile from discard pool and mark previous discard as called
          const discardPile = prev.discard_pile || [];
          let calledTileIndex = -1;
          for (let i = discardPile.length - 1; i >= 0; i -= 1) {
            if (discardPile[i].tile === called_tile && !discardPile[i].called) {
              calledTileIndex = i;
              break;
            }
          }
          const newDiscardPile =
            calledTileIndex !== -1
              ? [
                  ...discardPile.slice(0, calledTileIndex),
                  ...discardPile.slice(calledTileIndex + 1),
                ]
              : discardPile;

          return {
            ...prev,
            your_hand: newHand,
            exposed_melds: updatedExposedMelds,
            discard_pile: newDiscardPile,
          };
        });

        // Play sound effect for meld exposed
        playSound('tile-draw'); // Use draw sound for meld exposure
      }
    },
    [clearSelection, updateSetupPhase, clearSelectionError, gameState, playSound, setGameState]
  );

  // Handle private events
  const handlePrivateEvent = useCallback(
    (event: PrivateEvent) => {
      if (typeof event !== 'object' || event === null) return;

      // TilesDealt event
      if ('TilesDealt' in event) {
        setGameState((prev) =>
          prev
            ? {
                ...prev,
                your_hand: event.TilesDealt.your_tiles,
              }
            : null
        );
        updateSetupPhase('OrganizingHands');
      }

      // TilesPassed event - remove passed tiles from hand
      if ('TilesPassed' in event) {
        if (isCharleston && !hasSubmittedPass) {
          setBotPassMessage('Time expired - auto-passing 3 tiles from hand');
          if (botPassTimeoutRef.current) {
            clearTimeout(botPassTimeoutRef.current);
          }
          botPassTimeoutRef.current = setTimeout(() => setBotPassMessage(null), 3000);
          setHasSubmittedPass(true);
        }
        const passedTiles = event.TilesPassed.tiles;

        const idsToRemove: string[] = [];
        const usedIds = new Set<string>();
        for (const tile of passedTiles) {
          const match = tileInstances.find(
            (instance) => instance.tile === tile && !usedIds.has(instance.id)
          );
          if (match) {
            usedIds.add(match.id);
            idsToRemove.push(match.id);
          }
        }

        setLeavingTileIds(idsToRemove);

        setTimeout(() => {
          setGameState((prev) => {
            if (!prev) return null;
            const newHand = [...prev.your_hand];
            for (const tile of passedTiles) {
              const idx = newHand.indexOf(tile);
              if (idx !== -1) newHand.splice(idx, 1);
            }
            return { ...prev, your_hand: newHand };
          });
          setLeavingTileIds([]);
          clearSelection();
        }, 300);
      }

      // TilesReceived event - add received tiles to hand
      if ('TilesReceived' in event) {
        const receivedTiles = event.TilesReceived.tiles;
        setGameState((prev) => {
          if (!prev) return null;
          const newHand = sortHand([...prev.your_hand, ...receivedTiles]);

          const newHandInstances = newHand.map((tile, index) => ({
            id: `${tile}-${index}`,
            tile,
          }));

          const ids: string[] = [];
          const used = new Set<string>();
          for (const tile of receivedTiles) {
            const match = newHandInstances.find(
              (instance) => instance.tile === tile && !used.has(instance.id)
            );
            if (match) {
              used.add(match.id);
              ids.push(match.id);
            }
          }

          if (highlightTimeoutRef.current) {
            clearTimeout(highlightTimeoutRef.current);
          }
          setHighlightedTileIds(ids);
          highlightTimeoutRef.current = setTimeout(() => setHighlightedTileIds([]), 2000);

          return { ...prev, your_hand: newHand };
        });

        if (event.TilesReceived.from) {
          setIncomingFromSeat(event.TilesReceived.from);
          if (incomingSeatTimeoutRef.current) {
            clearTimeout(incomingSeatTimeoutRef.current);
          }
          incomingSeatTimeoutRef.current = setTimeout(() => setIncomingFromSeat(null), 350);
        }
      }

      // TileDrawnPrivate event
      if ('TileDrawnPrivate' in event) {
        const { tile, remaining_tiles } = event.TileDrawnPrivate;
        setGameState((prev) => {
          if (!prev) return null;
          const newHand = sortHand([...prev.your_hand, tile]);

          const newHandInstances = newHand.map((t, index) => ({
            id: `${t}-${index}`,
            tile: t,
          }));

          // Find the ID of the newly drawn tile for highlighting
          const newIds: string[] = [];
          const used = new Set<string>();
          // (Wait, if I have multiple identical tiles, which one is the "new" one?)
          // For now, let's just find first one that wasn't used.
          const match = newHandInstances.find(
            (instance) => instance.tile === tile && !used.has(instance.id)
          );
          if (match) {
            newIds.push(match.id);
          }

          if (highlightTimeoutRef.current) {
            clearTimeout(highlightTimeoutRef.current);
          }
          setHighlightedTileIds(newIds);
          highlightTimeoutRef.current = setTimeout(() => setHighlightedTileIds([]), 2000);

          return {
            ...prev,
            your_hand: newHand,
            wall_tiles_remaining: remaining_tiles,
          };
        });

        // Clear pending draw retry (EC-3: successful draw acknowledgment)
        setPendingDrawCommand(null);
        setDrawRetryCount(0);
        hasDrawnThisTurnRef.current = true;
        if (drawRetryTimeoutRef.current) {
          clearTimeout(drawRetryTimeoutRef.current);
          drawRetryTimeoutRef.current = null;
        }

        // Play draw sound effect (US-009 AC-2)
        playSound('tile-draw');
      }
    },
    [
      updateSetupPhase,
      tileInstances,
      clearSelection,
      isCharleston,
      hasSubmittedPass,
      playSound,
      setGameState,
    ]
  );

  // Handle incoming WebSocket messages (only when event bridge disabled)
  useEffect(() => {
    if (eventBridgeEnabled || !ws) return;

    // Handle server events (public and private)
    const handleServerEvent = (event: ServerEvent) => {
      if (typeof event === 'object' && event !== null && 'Public' in event) {
        handlePublicEvent(event.Public);
      }

      if (typeof event === 'object' && event !== null && 'Private' in event) {
        handlePrivateEvent(event.Private);
      }
    };

    const handleMessage = (event: MessageEvent) => {
      try {
        const envelope = JSON.parse(event.data) as IncomingEnvelope;

        if (envelope.kind === 'Event') {
          handleServerEvent(envelope.payload.event);
        }

        if (envelope.kind === 'StateSnapshot') {
          setGameState(envelope.payload.snapshot);
        }

        if (envelope.kind === 'Error') {
          console.error('Server error:', envelope.payload.code, envelope.payload.message);
          setErrorMessage(envelope.payload.message);
          if (errorMessageTimeoutRef.current) {
            clearTimeout(errorMessageTimeoutRef.current);
          }
          errorMessageTimeoutRef.current = setTimeout(() => setErrorMessage(null), 3000);
          if (isCharleston && /blind pass/i.test(envelope.payload.message)) {
            clearSelection();
            setBlindPassCount(0);
            setHasSubmittedPass(false);
          }
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.addEventListener('message', handleMessage);

    return () => {
      ws.removeEventListener('message', handleMessage);
    };
  }, [
    ws,
    handlePublicEvent,
    handlePrivateEvent,
    clearSelection,
    isCharleston,
    setGameState,
    eventBridgeEnabled,
  ]);

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
        ws.send(JSON.stringify(envelope));
      }

      // Track pass submission for UI state
      if ('PassTiles' in command) {
        setHasSubmittedPass(true);
      }
      if ('VoteCharleston' in command) {
        setHasSubmittedVote(true);
        setMyVote(command.VoteCharleston.vote);
        // EC-7: Track pending vote for retry
        setPendingVoteCommand(command);
        setVoteRetryCount(0);
      }
      // Track discard submission for UI state (US-010)
      if ('DiscardTile' in command) {
        setIsProcessing(true);
        setDiscardAnimationTile(command.DiscardTile.tile);
      }
      if ('DrawTile' in command) {
        setPendingDrawCommand(command);
        setDrawRetryCount(0);
      }
    },
    [ws, eventBridgeEnabled, eventBridgeResult]
  );

  // Handle dice overlay complete
  const handleDiceComplete = () => {
    setShowDiceOverlay(false);
  };

  // Handle tile selection in concealed hand
  const handleTileSelect = (tileId: string) => {
    if (isDiscardingMyTurn && selectedIds.length === 1 && !selectedIds.includes(tileId)) {
      selectTiles([tileId]);
      return;
    }

    const result = toggleTile(tileId);
    if (result.status === 'blocked') {
      if (!isCharleston) return;
      const blockedTile = tileById.get(tileId);
      const isBlockedJoker = blockedTile !== undefined && isJoker(blockedTile);
      const message =
        result.reason === 'disabled' && isBlockedJoker
          ? 'Jokers cannot be passed'
          : 'No more than 3 tiles may be selected for passing';

      if (selectionErrorTimeoutRef.current) {
        clearTimeout(selectionErrorTimeoutRef.current);
      }
      setSelectionError({ tileId, message });
      selectionErrorTimeoutRef.current = setTimeout(() => {
        setSelectionError(null);
        selectionErrorTimeoutRef.current = null;
      }, 1500);
    } else {
      clearSelectionError();
    }
  };

  useEffect(() => {
    if (!charlestonTimer) {
      const timeout = setTimeout(() => setTimerRemainingSeconds(null), 0);
      return () => clearTimeout(timeout);
    }

    const updateRemaining = () => {
      const now = Date.now();
      const remainingMs = Math.max(0, charlestonTimer.expiresAtMs - now);
      setTimerRemainingSeconds(Math.ceil(remainingMs / 1000));
    };

    const immediate = setTimeout(updateRemaining, 0);
    const interval = setInterval(updateRemaining, 500);
    return () => {
      clearTimeout(immediate);
      clearInterval(interval);
    };
  }, [charlestonTimer]);

  // EC-7: Vote retry - if no PlayerVoted ack within 5 seconds, retry (max 3)
  useEffect(() => {
    if (!pendingVoteCommand || voteRetryCount >= 3) return;

    voteRetryTimeoutRef.current = setTimeout(() => {
      if (!ws || !pendingVoteCommand) return;

      const envelope: CommandEnvelope = {
        kind: 'Command',
        payload: { command: pendingVoteCommand },
      };
      ws.send(JSON.stringify(envelope));

      const nextCount = voteRetryCount + 1;
      setVoteRetryCount(nextCount);

      if (nextCount >= 3) {
        setErrorMessage('Failed to submit vote. Please try again.');
        if (errorMessageTimeoutRef.current) {
          clearTimeout(errorMessageTimeoutRef.current);
        }
        errorMessageTimeoutRef.current = setTimeout(() => setErrorMessage(null), 5000);
        setPendingVoteCommand(null);
        setHasSubmittedVote(false);
        setMyVote(null);
        return;
      }

      setErrorMessage(`Failed to submit vote. Retrying... (${nextCount}/3)`);
      if (errorMessageTimeoutRef.current) {
        clearTimeout(errorMessageTimeoutRef.current);
      }
      errorMessageTimeoutRef.current = setTimeout(() => setErrorMessage(null), 3000);
    }, 5000);

    return () => {
      if (voteRetryTimeoutRef.current) {
        clearTimeout(voteRetryTimeoutRef.current);
        voteRetryTimeoutRef.current = null;
      }
    };
  }, [pendingVoteCommand, voteRetryCount, ws]);

  // EC-3: Draw retry - if no TileDrawnPrivate ack within 5 seconds, retry (max 3)
  useEffect(() => {
    if (!pendingDrawCommand || drawRetryCount >= 3) return;

    drawRetryTimeoutRef.current = setTimeout(() => {
      if (!ws || !pendingDrawCommand) return;

      const envelope: CommandEnvelope = {
        kind: 'Command',
        payload: { command: pendingDrawCommand },
      };
      ws.send(JSON.stringify(envelope));

      const nextCount = drawRetryCount + 1;
      setDrawRetryCount(nextCount);

      if (nextCount >= 3) {
        setErrorMessage('Failed to draw tile. Please refresh the page.');
        if (errorMessageTimeoutRef.current) {
          clearTimeout(errorMessageTimeoutRef.current);
        }
        errorMessageTimeoutRef.current = setTimeout(() => setErrorMessage(null), 5000);
        setPendingDrawCommand(null);
        return;
      }

      setErrorMessage(`Failed to draw tile. Retrying... (${nextCount}/3)`);
      if (errorMessageTimeoutRef.current) {
        clearTimeout(errorMessageTimeoutRef.current);
      }
      errorMessageTimeoutRef.current = setTimeout(() => setErrorMessage(null), 3000);
    }, 5000);

    return () => {
      if (drawRetryTimeoutRef.current) {
        clearTimeout(drawRetryTimeoutRef.current);
        drawRetryTimeoutRef.current = null;
      }
    };
  }, [pendingDrawCommand, drawRetryCount, ws]);

  useEffect(() => {
    if (!gameState) return;

    // Auto-draw logic (US-009)
    const isMyTurn = gameState.current_turn === gameState.your_seat;
    const isDrawingStage =
      typeof gameState.phase === 'object' &&
      'Playing' in gameState.phase &&
      typeof gameState.phase.Playing === 'object' &&
      'Drawing' in gameState.phase.Playing &&
      gameState.phase.Playing.Drawing.player === gameState.your_seat;

    if (!isDrawingStage) {
      hasDrawnThisTurnRef.current = false;
      lastDrawTurnRef.current = null;
      return;
    }

    if (lastDrawTurnRef.current !== gameState.current_turn) {
      lastDrawTurnRef.current = gameState.current_turn;
      hasDrawnThisTurnRef.current = false;
    }

    if (isMyTurn && isDrawingStage && !hasDrawnThisTurnRef.current) {
      const timer = setTimeout(() => {
        const drawCommand = { DrawTile: { player: gameState.your_seat } };
        sendCommand(drawCommand);
        // Track pending command for retry logic (EC-3)
        setPendingDrawCommand(drawCommand);
        setDrawRetryCount(0);
        hasDrawnThisTurnRef.current = true;
      }, 500); // 500ms delay for visual transition
      return () => clearTimeout(timer);
    }
  }, [gameState, sendCommand]);

  // Call window timer update (US-011)
  useEffect(() => {
    if (!callWindowState) {
      const clearTimer = setTimeout(() => setCallWindowTimer(null), 0);
      return () => clearTimeout(clearTimer);
    }

    const updateTimer = () => {
      const now = Date.now();
      const elapsed = (now - callWindowState.timerStart) / 1000;
      const remaining = Math.max(0, callWindowState.timerDuration - elapsed);
      setCallWindowTimer(Math.ceil(remaining));

      // AC-9: Auto-pass on timeout (EC-3)
      if (remaining <= 0 && !callWindowState.hasResponded && gameState) {
        sendCommand({ Pass: { player: gameState.your_seat } });
        setCallWindowState((prev) => (prev ? { ...prev, hasResponded: true } : null));
        setErrorMessage('Time expired - auto-passed');
        if (errorMessageTimeoutRef.current) {
          clearTimeout(errorMessageTimeoutRef.current);
        }
        errorMessageTimeoutRef.current = setTimeout(() => setErrorMessage(null), 3000);
      }
    };

    const immediate = setTimeout(updateTimer, 0);
    const interval = setInterval(updateTimer, 500);

    return () => {
      clearTimeout(immediate);
      clearInterval(interval);
    };
  }, [callWindowState, sendCommand, gameState]);

  useEffect(() => {
    return () => {
      if (selectionErrorTimeoutRef.current) {
        clearTimeout(selectionErrorTimeoutRef.current);
      }
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
      if (incomingSeatTimeoutRef.current) {
        clearTimeout(incomingSeatTimeoutRef.current);
      }
      if (botPassTimeoutRef.current) {
        clearTimeout(botPassTimeoutRef.current);
      }
      if (botVoteTimeoutRef.current) {
        clearTimeout(botVoteTimeoutRef.current);
      }
      if (errorMessageTimeoutRef.current) {
        clearTimeout(errorMessageTimeoutRef.current);
      }
      if (voteRetryTimeoutRef.current) {
        clearTimeout(voteRetryTimeoutRef.current);
      }
      if (drawRetryTimeoutRef.current) {
        clearTimeout(drawRetryTimeoutRef.current);
      }
      if (callWindowTimeoutRef.current) {
        clearTimeout(callWindowTimeoutRef.current);
      }
    };
  }, []);

  const charlestonWaitingMessage = useMemo(() => {
    if (!hasSubmittedPass || !isCharleston || !gameState) return undefined;

    const allSeats = gameState.players.map((player) => player.seat);
    const missingSeats = allSeats.filter((seat) => !readyPlayers.includes(seat));

    if (missingSeats.length === 0) return 'All players are ready.';
    return `Waiting for ${missingSeats.join(', ')}...`;
  }, [hasSubmittedPass, isCharleston, gameState, readyPlayers]);

  const normalizeDiscard = useCallback((discard: DiscardInfo | LocalDiscardInfo) => {
    const discardedBy = 'player' in discard ? discard.player : discard.discarded_by;
    const turn = 'turn' in discard ? discard.turn : 0;
    const safe = 'safe' in discard ? discard.safe : false;
    const called = 'called' in discard ? discard.called : false;

    return {
      tile: discard.tile,
      discardedBy,
      turn,
      safe,
      called,
    };
  }, []);

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

  const timerDetails =
    charlestonTimer && timerRemainingSeconds !== null
      ? {
          remainingSeconds: timerRemainingSeconds,
          durationSeconds: charlestonTimer.durationSeconds,
          mode: charlestonTimer.mode,
        }
      : null;

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
  const isMyTurn = gameState.current_turn === gameState.your_seat;

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

      {/* Turn Indicator (US-009) - Original implementation */}
      {!usePlayingPhaseComponent && isPlaying && (
        <TurnIndicator currentSeat={gameState.current_turn} stage={turnStage} isMyTurn={isMyTurn} />
      )}

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

      {/* Setup Phase - Extracted Component (Phase 4: Event Bridge) */}
      {USE_EVENT_BRIDGE && isSetupPhase && setupStage && (
        <SetupPhase
          gameState={gameState}
          stage={setupStage}
          sendCommand={sendCommand}
          diceRoll={diceRoll}
          showDiceOverlay={showDiceOverlay}
          onDiceOverlayClose={handleDiceComplete}
        />
      )}

      {/* Dice Overlay - Original implementation (when event bridge disabled) */}
      {!USE_EVENT_BRIDGE && showDiceOverlay && diceRoll !== null && (
        <DiceOverlay
          isOpen={showDiceOverlay}
          rollTotal={diceRoll}
          durationMs={500}
          onComplete={handleDiceComplete}
        />
      )}

      {/* Discard Pool (US-010) - Original implementation */}
      {!usePlayingPhaseComponent &&
        gameState.discard_pile &&
        gameState.discard_pile.length > 0 && (
          <DiscardPool
            discards={gameState.discard_pile.map(normalizeDiscard)}
            mostRecentTile={mostRecentDiscard || undefined}
            callableTile={callWindowState?.active ? callWindowState.tile : undefined}
          />
        )}

      {discardAnimationTile !== null && !usePlayingPhaseComponent && (
        <DiscardAnimationLayer
          tile={discardAnimationTile}
          duration={400}
          onComplete={() => setDiscardAnimationTile(null)}
        />
      )}

      {/* Playing Phase - Refactored Component (Phase 3) */}
      {usePlayingPhaseComponent && isPlaying && turnStage && gameState && (
        <PlayingPhase
          gameState={gameState}
          turnStage={turnStage}
          currentTurn={gameState.current_turn}
          sendCommand={sendCommand}
        />
      )}

      {/* Charleston Phase - Refactored Component (Phase 2) */}
      {useCharlestonPhaseComponent && isCharleston && charlestonStage && gameState && (
        <CharlestonPhase gameState={gameState} stage={charlestonStage} sendCommand={sendCommand} />
      )}

      {/* Charleston Phase - Original Implementation (will be removed in Phase 5) */}
      {!useCharlestonPhaseComponent && (
        <>
          {/* Charleston Tracker */}
          {isCharleston && charlestonStage && (
            <CharlestonTracker
              stage={charlestonStage}
              readyPlayers={readyPlayers}
              waitingMessage={charlestonWaitingMessage}
              statusMessage={botPassMessage || undefined}
              timer={timerDetails}
            />
          )}

          {errorMessage && (
            <div
              className="fixed top-[135px] left-1/2 -translate-x-1/2 bg-red-900/80 text-red-100 text-sm px-4 py-2 rounded"
              data-testid="charleston-error-message"
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          {/* Blind Pass Panel (FirstLeft / SecondRight only) */}
          {isCharleston && isBlindPassStage && !hasSubmittedPass && (
            <BlindPassPanel
              blindCount={blindPassCount}
              onBlindCountChange={(count) => {
                setBlindPassCount(count);
                // Clear hand selection if it would exceed new max
                if (selectedIds.length > 3 - count) {
                  clearSelection();
                }
              }}
              handSelectionCount={selectedIds.length}
              totalRequired={3}
              disabled={hasSubmittedPass}
            />
          )}
        </>
      )}

      {/* Player's Concealed Hand */}
      {gameState.your_hand.length > 0 &&
        !useCharlestonPhaseComponent &&
        !(usePlayingPhaseComponent && isPlaying) && (
          <ConcealedHand
            tiles={tileInstances}
            mode={
              isCharleston && !isVotingStage
                ? 'charleston'
                : isPlaying &&
                    typeof gameState.phase === 'object' &&
                    'Playing' in gameState.phase &&
                    typeof gameState.phase.Playing === 'object' &&
                    'Discarding' in gameState.phase.Playing &&
                    gameState.phase.Playing.Discarding.player === gameState.your_seat
                  ? 'discard'
                  : 'view-only'
            }
            selectedTileIds={selectedIds}
            onTileSelect={handleTileSelect}
            maxSelection={handMaxSelection}
            disabled={hasSubmittedPass || isVotingStage || isProcessing}
            disabledTileIds={disabledTileIds}
            selectionError={selectionError}
            highlightedTileIds={highlightedTileIds}
            incomingFromSeat={incomingFromSeat}
            leavingTileIds={leavingTileIds}
            blindPassCount={isBlindPassStage ? blindPassCount : undefined}
          />
        )}

      {/* Exposed Melds Area (US-013) - Original implementation */}
      {!usePlayingPhaseComponent &&
        'exposed_melds' in gameState &&
        gameState.exposed_melds &&
        gameState.exposed_melds[gameState.your_seat].length > 0 && (
          <div
            className="fixed bottom-32 left-1/2 -translate-x-1/2"
            data-testid="player-exposed-melds"
          >
            <ExposedMeldsArea
              melds={gameState.exposed_melds[gameState.your_seat]}
              ownerSeat={gameState.your_seat}
            />
          </div>
        )}

      {/* Action Bar */}
      {!(USE_EVENT_BRIDGE && isSetupPhase) &&
        !(usePlayingPhaseComponent && isPlaying) &&
        !(useCharlestonPhaseComponent && isCharleston) && (
        <ActionBar
          phase={gameState.phase}
          mySeat={gameState.your_seat}
          selectedTiles={selectedTiles}
          isProcessing={isProcessing}
          blindPassCount={isBlindPassStage ? blindPassCount : undefined}
          hasSubmittedPass={hasSubmittedPass}
          onCommand={sendCommand}
        />
      )}

      {/* Voting Panel (US-005) - Original implementation */}
      {!useCharlestonPhaseComponent &&
        charlestonStage === 'VotingToContinue' &&
        !showVoteResultOverlay && (
          <VotingPanel
            onVote={(vote) =>
              sendCommand({ VoteCharleston: { player: gameState.your_seat, vote } })
            }
            disabled={hasSubmittedVote}
            hasVoted={hasSubmittedVote}
            myVote={myVote || undefined}
            voteCount={votedPlayers.length}
            totalPlayers={4}
            votedPlayers={votedPlayers}
            allPlayers={gameState.players.map((p) => ({ seat: p.seat, is_bot: p.is_bot }))}
            botVoteMessage={botVoteMessage || undefined}
          />
        )}

      {/* Vote Result Overlay (US-005) - Original implementation */}
      {!useCharlestonPhaseComponent && showVoteResultOverlay && voteResult && (
        <VoteResultOverlay
          result={voteResult}
          votes={voteBreakdown || undefined}
          onDismiss={() => setShowVoteResultOverlay(false)}
          myVote={myVote || undefined}
        />
      )}

      {/* Call Window Panel (US-011) - Original implementation */}
      {!usePlayingPhaseComponent &&
        callWindowState &&
        callWindowState.active &&
        callWindowTimer !== null && (
          <CallWindowPanel
            callableTile={callWindowState.tile}
            discardedBy={callWindowState.discardedBy}
            canCallForPung={
              (tileCounts.get(callWindowState.tile) ?? 0) +
                (tileCounts.get(TILE_INDICES.JOKER) ?? 0) >=
              2
            }
            canCallForKong={
              (tileCounts.get(callWindowState.tile) ?? 0) +
                (tileCounts.get(TILE_INDICES.JOKER) ?? 0) >=
              3
            }
            canCallForQuint={
              (tileCounts.get(callWindowState.tile) ?? 0) +
                (tileCounts.get(TILE_INDICES.JOKER) ?? 0) >=
              4
            }
            canCallForSextet={
              (tileCounts.get(callWindowState.tile) ?? 0) +
                (tileCounts.get(TILE_INDICES.JOKER) ?? 0) >=
              5
            }
            canCallForMahjong={true}
            onCallIntent={(intent) => {
              if (!gameState) return;
              const responseMessage =
                intent === 'Mahjong'
                  ? 'Declared Mahjong. Waiting for validation...'
                  : `Declared intent to call for ${intent}. Waiting for others...`;

              const callIntent =
                intent === 'Mahjong'
                  ? ('Mahjong' as const)
                  : (() => {
                      const meldType = intent;
                      const tile = callWindowState.tile;
                      const meldSize =
                        meldType === 'Pung'
                          ? 3
                          : meldType === 'Kong'
                            ? 4
                            : meldType === 'Quint'
                              ? 5
                              : 6;
                      const requiredFromHand = meldSize - 1;
                      const matchingInHand = tileCounts.get(tile) ?? 0;
                      const jokersInHand = tileCounts.get(TILE_INDICES.JOKER) ?? 0;
                      const available = matchingInHand + jokersInHand;

                      if (available < requiredFromHand) {
                        setErrorMessage('Not enough tiles to call that meld');
                        if (errorMessageTimeoutRef.current) {
                          clearTimeout(errorMessageTimeoutRef.current);
                        }
                        errorMessageTimeoutRef.current = setTimeout(
                          () => setErrorMessage(null),
                          3000
                        );
                        return null;
                      }

                      const useNatural = Math.min(matchingInHand, requiredFromHand);
                      const useJokers = requiredFromHand - useNatural;
                      const meldTiles: number[] = [
                        tile,
                        ...Array(useNatural).fill(tile),
                        ...Array(useJokers).fill(TILE_INDICES.JOKER),
                      ];
                      return {
                        Meld: {
                          meld_type: meldType,
                          tiles: meldTiles,
                          called_tile: callWindowState.tile,
                          joker_assignments: {},
                        },
                      } as const;
                    })();

              if (!callIntent) {
                return;
              }

              sendCommand({
                DeclareCallIntent: {
                  player: gameState.your_seat,
                  intent: callIntent,
                },
              });
              setCallWindowState((prev) =>
                prev ? { ...prev, hasResponded: true, responseMessage } : null
              );
            }}
            onPass={() => {
              if (!gameState) return;
              sendCommand({ Pass: { player: gameState.your_seat } });
              setCallWindowState(null);
              setCallWindowTimer(null);
              const tileName = getTileName(callWindowState.tile);
              setErrorMessage(`Passed on ${tileName}`);
              if (errorMessageTimeoutRef.current) {
                clearTimeout(errorMessageTimeoutRef.current);
              }
              errorMessageTimeoutRef.current = setTimeout(() => setErrorMessage(null), 3000);
            }}
            timerRemaining={callWindowTimer}
            timerDuration={callWindowState.timerDuration}
            disabled={callWindowState.hasResponded}
            responseMessage={callWindowState.responseMessage}
            respondedSeats={callWindowRespondedSeats}
            intentSummaries={callWindowState.intents}
          />
        )}

      {/* Call Resolution Overlay (US-012) - Original implementation */}
      {!usePlayingPhaseComponent && resolutionOverlay && (
        <CallResolutionOverlay
          resolution={resolutionOverlay.resolution}
          tieBreak={resolutionOverlay.tieBreak}
          allCallers={resolutionOverlay.allCallers}
          discardedBy={resolutionOverlay.discardedBy}
          onDismiss={() => setResolutionOverlay(null)}
        />
      )}

      {/* IOU Overlay */}
      {iouState && (
        <IOUOverlay
          debts={iouState.debts}
          resolved={iouState.resolved}
          summary={iouState.summary}
        />
      )}

      {/* Charleston pass animation - Original implementation */}
      {!useCharlestonPhaseComponent && passDirection && (
        <PassAnimationLayer direction={passDirection} />
      )}

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
