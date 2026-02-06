/**
 * GameBoard Component
 *
 * Main game container that orchestrates all game components and manages
 * WebSocket communication with the backend.
 *
 * Related: All user stories - this is the main game container
 */

import React, { useState, useEffect } from 'react';
import { DiceOverlay } from './DiceOverlay';
import { Wall } from './Wall';
import { WallCounter } from './WallCounter';
import { ActionBar } from './ActionBar';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { PrivateEvent } from '@/types/bindings/generated/PrivateEvent';
import type { Tile } from '@/types/bindings/generated/Tile';

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
  players: Array<{
    seat: Seat;
    player_id: string;
    is_bot: boolean;
    status: string;
    tile_count: number;
  }>;
  remaining_tiles: number;
  wall_break_point: number | null;
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

/**
 * GameBoard is the main game container
 */
export const GameBoard: React.FC<GameBoardProps> = ({ initialState, ws }) => {
  // Game state
  const [gameState, setGameState] = useState<GameState | null>(initialState || null);

  // UI state
  const [diceRoll, setDiceRoll] = useState<number | null>(null);
  const [showDiceOverlay, setShowDiceOverlay] = useState(false);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const message = JSON.parse(event.data);

        // Handle Public Events
        if ('Public' in message) {
          handlePublicEvent(message.Public);
        }

        // Handle Private Events
        if ('Private' in message) {
          handlePrivateEvent(message.Private);
        }
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    ws.addEventListener('message', handleMessage);

    return () => {
      ws.removeEventListener('message', handleMessage);
    };
  }, [ws]);

  // Handle public events
  const handlePublicEvent = (event: PublicEvent) => {
    // DiceRolled event
    if ('DiceRolled' in event) {
      setDiceRoll(event.DiceRolled.roll);
      setShowDiceOverlay(true);
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
    }
  };

  // Handle private events
  const handlePrivateEvent = (event: PrivateEvent) => {
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
    }
  };

  // Send command to server
  const sendCommand = (command: GameCommand) => {
    if (ws) {
      ws.send(JSON.stringify(command));
    }
  };

  // Handle dice overlay complete
  const handleDiceComplete = () => {
    setShowDiceOverlay(false);
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
        totalTiles={152}
        isDeadWall={false}
      />

      {/* Walls */}
      <Wall position="north" stackCount={19} initialStacks={19} />
      <Wall position="south" stackCount={19} initialStacks={19} />
      <Wall position="east" stackCount={19} initialStacks={19} />
      <Wall position="west" stackCount={19} initialStacks={19} />

      {/* Action Bar */}
      <ActionBar
        phase={gameState.phase}
        mySeat={gameState.your_seat}
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
