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
import { useTileSelection } from '@/hooks/useTileSelection';
import { isJoker, sortHand } from '@/lib/utils/tileUtils';
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
  const [showVoteResultOverlay, setShowVoteResultOverlay] = useState(false);
  const [botVoteMessage, setBotVoteMessage] = useState<string | null>(null);
  const [pendingVoteCommand, setPendingVoteCommand] = useState<GameCommand | null>(null);
  const [voteRetryCount, setVoteRetryCount] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [iouState, setIouState] = useState<{
    active: boolean;
    debts: Array<[Seat, number]>;
    resolved: boolean;
    summary?: string;
  } | null>(null);
  const selectionErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const incomingSeatTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botPassTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botVoteTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorMessageTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voteRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine if we're in Charleston phase
  const isCharleston =
    gameState !== null && typeof gameState.phase === 'object' && 'Charleston' in gameState.phase;

  const charlestonStage: CharlestonStage | undefined =
    isCharleston && typeof gameState!.phase === 'object' && 'Charleston' in gameState!.phase
      ? (gameState!.phase as { Charleston: CharlestonStage }).Charleston
      : undefined;

  const isBlindPassStage = charlestonStage === 'FirstLeft' || charlestonStage === 'SecondRight';
  const isVotingStage = charlestonStage === 'VotingToContinue';

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

  const handMaxSelection = isBlindPassStage ? 3 - blindPassCount : 3;

  const { selectedIds, toggleTile, clearSelection } = useTileSelection({
    maxSelection: handMaxSelection,
    disabledIds: disabledTileIds,
  });

  const selectedTiles = useMemo(
    () =>
      selectedIds.map((id) => tileById.get(id)).filter((tile): tile is Tile => tile !== undefined),
    [selectedIds, tileById]
  );

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
    },
    [clearSelection, updateSetupPhase, clearSelectionError, gameState]
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
      }
    },
    [updateSetupPhase, tileInstances, clearSelection, isCharleston, hasSubmittedPass]
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
    },
    [ws]
  );

  // Handle dice overlay complete
  const handleDiceComplete = () => {
    setShowDiceOverlay(false);
  };

  // Handle tile selection in concealed hand
  const handleTileSelect = (tileId: string) => {
    const result = toggleTile(tileId);
    if (result.status === 'blocked') {
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
        sendCommand({ DrawTile: { player: gameState.your_seat } });
      }, 500); // 500ms delay for visual transition
      return () => clearTimeout(timer);
    }
  }, [gameState, sendCommand]);

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
          mode={isCharleston && !isVotingStage ? 'charleston' : 'view-only'}
          selectedTileIds={selectedIds}
          onTileSelect={handleTileSelect}
          maxSelection={handMaxSelection}
          disabled={hasSubmittedPass || isVotingStage}
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
          onDismiss={() => setShowVoteResultOverlay(false)}
          myVote={myVote || undefined}
          totalVoters={4}
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
