/**
 * GameBoard Component
 *
 * Main game container that orchestrates all game components and manages
 * WebSocket communication with the backend.
 *
 * Related: All user stories - this is the main game container
 */

import React, { useState, useCallback, useEffect } from 'react';
import { DiceOverlay } from './DiceOverlay';
import { Wall } from './Wall';
import { WallCounter } from './WallCounter';
import { ActionBar } from './ActionBar';
import { ConcealedHand } from './ConcealedHand';
import { CharlestonTracker } from './CharlestonTracker';
import { useTileSelection } from '@/hooks/useTileSelection';
import { isJoker, sortHand } from '@/lib/utils/tileUtils';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { PrivateEvent } from '@/types/bindings/generated/PrivateEvent';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { Event as ServerEvent } from '@/types/bindings/generated/Event';

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
  const [charlestonWaitingMessage, setCharlestonWaitingMessage] = useState<string | undefined>();

  // Determine if we're in Charleston phase
  const isCharleston =
    gameState !== null &&
    typeof gameState.phase === 'object' &&
    'Charleston' in gameState.phase;

  const charlestonStage: CharlestonStage | undefined =
    isCharleston && typeof gameState!.phase === 'object' && 'Charleston' in gameState!.phase
      ? (gameState!.phase as { Charleston: CharlestonStage }).Charleston
      : undefined;

  // Tile selection for Charleston
  const jokerTiles = gameState?.your_hand.filter(isJoker) ?? [];
  const {
    selectedTiles,
    toggleTile,
    clearSelection,
  } = useTileSelection({
    maxSelection: 3,
    disabledTiles: jokerTiles,
  });

  // Helper to update setup phase
  const updateSetupPhase = useCallback((stage: 'RollingDice' | 'BreakingWall' | 'Dealing' | 'OrganizingHands') => {
    setGameState((prev) =>
      prev
        ? {
            ...prev,
            phase: { Setup: stage },
          }
        : null
    );
  }, []);

  const handlePublicEvent = useCallback((event: PublicEvent) => {
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
      setCharlestonWaitingMessage(undefined);
    }

    // PlayerReadyForPass event
    if ('PlayerReadyForPass' in event) {
      setReadyPlayers((prev) => {
        const player = event.PlayerReadyForPass.player;
        if (prev.includes(player)) return prev;
        return [...prev, player];
      });
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
  }, [clearSelection, updateSetupPhase]);

  // Handle private events
  const handlePrivateEvent = useCallback((event: PrivateEvent) => {
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
      setGameState((prev) => {
        if (!prev) return null;
        const newHand = [...prev.your_hand];
        for (const tile of passedTiles) {
          const idx = newHand.indexOf(tile);
          if (idx !== -1) newHand.splice(idx, 1);
        }
        return { ...prev, your_hand: newHand };
      });
    }

    // TilesReceived event - add received tiles to hand
    if ('TilesReceived' in event) {
      const receivedTiles = event.TilesReceived.tiles;
      setGameState((prev) => {
        if (!prev) return null;
        const newHand = sortHand([...prev.your_hand, ...receivedTiles]);
        return { ...prev, your_hand: newHand };
      });
    }
  }, [updateSetupPhase]);

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
      setCharlestonWaitingMessage('Waiting for other players...');
    }
  };

  // Handle dice overlay complete
  const handleDiceComplete = () => {
    setShowDiceOverlay(false);
  };

  // Handle tile selection in concealed hand
  const handleTileSelect = (tile: Tile) => {
    toggleTile(tile);
  };

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
        />
      )}

      {/* Player's Concealed Hand */}
      {gameState.your_hand.length > 0 && (
        <ConcealedHand
          tiles={gameState.your_hand}
          mode={isCharleston ? 'charleston' : 'view-only'}
          selectedTiles={selectedTiles}
          onTileSelect={handleTileSelect}
          disabled={hasSubmittedPass}
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
