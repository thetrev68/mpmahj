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
import { useTileSelection } from '@/hooks/useTileSelection';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { getTileName, isJoker, sortHand } from '@/lib/utils/tileUtils';
import type { CallIntentSummary } from '@/types/bindings/generated/CallIntentSummary';
import type { CallResolution } from '@/types/bindings/generated/CallResolution';
import type { CallTieBreakReason } from '@/types/bindings/generated/CallTieBreakReason';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { PrivateEvent } from '@/types/bindings/generated/PrivateEvent';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';
import type { TimerMode } from '@/types/bindings/generated/TimerMode';
import type { PassDirection } from '@/types/bindings/generated/PassDirection';
import type { Event as ServerEvent } from '@/types/bindings/generated/Event';
import type { TileInstance } from './types';

export interface GameBoardProps {
  /** Initial game state (for testing) */
  initialState?: GameState;
  /** WebSocket instance (for testing) */
  ws?: WebSocketLike;
}

/**
 * Simplified game state for MVP
 */
export interface GameState {
  game_id: string;
  phase: GamePhase;
  current_turn: Seat;
  your_seat: Seat;
  your_hand: Tile[];
  house_rules: {
    ruleset: {
      blank_exchange_enabled: boolean;
    };
  };
  players: Array<{
    seat: Seat;
    player_id: string;
    is_bot: boolean;
    status: string;
    tile_count: number;
  }>;
  remaining_tiles: number;
  wall_seed: number;
  wall_draw_index: number;
  wall_break_point: number;
  wall_tiles_remaining: number;
  discard_pile?: Array<{
    tile: Tile;
    player: Seat;
    turn: number;
    safe?: boolean;
    called?: boolean;
  }>;
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
 * GameBoard is the main game container
 */
export const GameBoard: React.FC<GameBoardProps> = ({ initialState, ws }) => {
  // Game state
  const [gameState, setGameState] = useState<GameState | null>(initialState || null);

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

  // Sound effects hook
  const { playSound } = useSoundEffects({ volume: 0.5, enabled: true });

  const clearSelectionError = useCallback(() => {
    if (selectionErrorTimeoutRef.current) {
      clearTimeout(selectionErrorTimeoutRef.current);
      selectionErrorTimeoutRef.current = null;
    }
    setSelectionError(null);
  }, []);

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
    []
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
          const newDiscard = {
            tile,
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
    },
    [clearSelection, updateSetupPhase, clearSelectionError, gameState, playSound]
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
        if (drawRetryTimeoutRef.current) {
          clearTimeout(drawRetryTimeoutRef.current);
          drawRetryTimeoutRef.current = null;
        }

        // Play draw sound effect (US-009 AC-2)
        playSound('tile-draw');
      }
    },
    [updateSetupPhase, tileInstances, clearSelection, isCharleston, hasSubmittedPass, playSound]
  );

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!ws) return;

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
  }, [ws, handlePublicEvent, handlePrivateEvent, clearSelection, isCharleston]);

  // Send command to server
  const sendCommand = useCallback(
    (command: GameCommand) => {
      if (ws) {
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
    },
    [ws]
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

    if (isMyTurn && isDrawingStage) {
      const timer = setTimeout(() => {
        const drawCommand = { DrawTile: { player: gameState.your_seat } };
        sendCommand(drawCommand);
        // Track pending command for retry logic (EC-3)
        setPendingDrawCommand(drawCommand);
        setDrawRetryCount(0);
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

  // Determine turn stage for TurnIndicator
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

      {/* Turn Indicator (US-009) */}
      {isPlaying && (
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

      {/* Discard Pool (US-010) */}
      {gameState.discard_pile && gameState.discard_pile.length > 0 && (
        <DiscardPool
          discards={gameState.discard_pile.map((d) => ({
            tile: d.tile,
            discardedBy: d.player,
            turn: d.turn,
            safe: d.safe,
            called: d.called,
          }))}
          mostRecentTile={mostRecentDiscard || undefined}
          callableTile={callWindowState?.active ? callWindowState.tile : undefined}
        />
      )}

      {discardAnimationTile !== null && (
        <DiscardAnimationLayer
          tile={discardAnimationTile}
          duration={400}
          onComplete={() => setDiscardAnimationTile(null)}
        />
      )}

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

      {/* Player's Concealed Hand */}
      {gameState.your_hand.length > 0 && (
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

      {/* Action Bar */}
      <ActionBar
        phase={gameState.phase}
        mySeat={gameState.your_seat}
        selectedTiles={selectedTiles}
        isProcessing={isProcessing}
        blindPassCount={isBlindPassStage ? blindPassCount : undefined}
        hasSubmittedPass={hasSubmittedPass}
        onCommand={sendCommand}
      />

      {/* Voting Panel (US-005) */}
      {charlestonStage === 'VotingToContinue' && !showVoteResultOverlay && (
        <VotingPanel
          onVote={(vote) => sendCommand({ VoteCharleston: { player: gameState.your_seat, vote } })}
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

      {/* Vote Result Overlay (US-005) */}
      {showVoteResultOverlay && voteResult && (
        <VoteResultOverlay
          result={voteResult}
          votes={voteBreakdown || undefined}
          onDismiss={() => setShowVoteResultOverlay(false)}
          myVote={myVote || undefined}
        />
      )}

      {/* Call Window Panel (US-011) */}
      {callWindowState && callWindowState.active && callWindowTimer !== null && (
        <CallWindowPanel
          callableTile={callWindowState.tile}
          discardedBy={callWindowState.discardedBy}
          canCallForPung={(tileCounts.get(callWindowState.tile) ?? 0) >= 2}
          canCallForKong={(tileCounts.get(callWindowState.tile) ?? 0) >= 3}
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
                    const meldTiles: number[] =
                      intent === 'Kong'
                        ? [
                            callWindowState.tile,
                            callWindowState.tile,
                            callWindowState.tile,
                            callWindowState.tile,
                          ]
                        : [callWindowState.tile, callWindowState.tile, callWindowState.tile];
                    const meldType = intent === 'Kong' ? 'Kong' : 'Pung';
                    return {
                      Meld: {
                        meld_type: meldType,
                        tiles: meldTiles,
                        called_tile: callWindowState.tile,
                        joker_assignments: {},
                      },
                    } as const;
                  })();

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

      {/* Call Resolution Overlay (US-012) */}
      {resolutionOverlay && (
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

      {/* Dice Overlay */}
      {showDiceOverlay && diceRoll !== null && (
        <DiceOverlay
          isOpen={showDiceOverlay}
          rollTotal={diceRoll}
          durationMs={500}
          onComplete={handleDiceComplete}
        />
      )}

      {/* Charleston pass animation */}
      {passDirection && <PassAnimationLayer direction={passDirection} />}

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
