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
import { useTileSelection } from '@/hooks/useTileSelection';
import { isJoker, sortHand } from '@/lib/utils/tileUtils';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { PrivateEvent } from '@/types/bindings/generated/PrivateEvent';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
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
  const [passDirection, setPassDirection] = useState<PassDirection | null>(null);
  const [charlestonTimer, setCharlestonTimer] = useState<{
    stage: CharlestonStage;
    durationSeconds: number;
    startedAtMs: number;
    expiresAtMs: number;
    mode: TimerMode;
  } | null>(null);
  const [timerRemainingSeconds, setTimerRemainingSeconds] = useState<number | null>(null);
  const selectionErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Determine if we're in Charleston phase
  const isCharleston =
    gameState !== null && typeof gameState.phase === 'object' && 'Charleston' in gameState.phase;

  const charlestonStage: CharlestonStage | undefined =
    isCharleston && typeof gameState!.phase === 'object' && 'Charleston' in gameState!.phase
      ? (gameState!.phase as { Charleston: CharlestonStage }).Charleston
      : undefined;

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

  const { selectedIds, toggleTile, clearSelection } = useTileSelection({
    maxSelection: 3,
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
        setCharlestonTimer(null);
        setTimerRemainingSeconds(null);
        clearSelectionError();
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
      }

      // TilesPassing event - show pass animation overlay
      if ('TilesPassing' in event) {
        setPassDirection(event.TilesPassing.direction);
        setTimeout(() => setPassDirection(null), 600);
      }

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
    },
    [clearSelection, updateSetupPhase, clearSelectionError]
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
      }
    },
    [updateSetupPhase, tileInstances, clearSelection]
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
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.addEventListener('message', handleMessage);

    return () => {
      ws.removeEventListener('message', handleMessage);
    };
  }, [ws, handlePublicEvent, handlePrivateEvent]);

  // Send command to server
  const sendCommand = (command: GameCommand) => {
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
  };

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
          timer={timerDetails}
        />
      )}

      {/* Player's Concealed Hand */}
      {gameState.your_hand.length > 0 && (
        <ConcealedHand
          tiles={tileInstances}
          mode={isCharleston ? 'charleston' : 'view-only'}
          selectedTileIds={selectedIds}
          onTileSelect={handleTileSelect}
          disabled={hasSubmittedPass}
          disabledTileIds={disabledTileIds}
          selectionError={selectionError}
          highlightedTileIds={highlightedTileIds}
          leavingTileIds={leavingTileIds}
        />
      )}

      {/* Action Bar */}
      <ActionBar
        phase={gameState.phase}
        mySeat={gameState.your_seat}
        selectedTiles={selectedTiles}
        hasSubmittedPass={hasSubmittedPass}
        onCommand={sendCommand}
      />

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
