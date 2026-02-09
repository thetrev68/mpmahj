/**
 * Private Event Handlers
 *
 * Pure functions for handling PrivateEvent messages from the server.
 * Each handler returns declarative actions (state updates, UI changes, side effects)
 * rather than executing them directly.
 *
 * Private events are sent to a single player or a courtesy pass pair.
 *
 * Related: GAMEBOARD_REFACTORING_PLAN.md Phase 2
 */

import type { PrivateEvent } from '@/types/bindings/generated/PrivateEvent';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { EventHandlerResult } from './types';
import { sortHand } from '@/lib/utils/tileUtils';

/**
 * Handle TilesPassed event (Charleston phase)
 *
 * Removes passed tiles from hand after server confirmation.
 * Shows auto-pass message if tiles were auto-submitted due to timeout.
 *
 * Original location: GameBoard.tsx lines 820-861
 * ```typescript
 * if ('TilesPassed' in event) {
 *   if (isCharleston && !hasSubmittedPass) {
 *     setBotPassMessage('Time expired - auto-passing 3 tiles from hand');
 *     // ... timeout logic
 *     setHasSubmittedPass(true);
 *   }
 *   const passedTiles = event.TilesPassed.tiles;
 *   // ... remove tiles from hand
 * }
 * ```
 *
 * @param event - TilesPassed event from server
 * @param gameState - Current game state (can be null)
 * @param hasSubmittedPass - Whether player already submitted pass (prevents duplicate message)
 * @returns Event handler result with state updates and UI actions
 */
export function handleTilesPassed(
  event: Extract<PrivateEvent, { TilesPassed: unknown }>,
  _gameState: GameStateSnapshot | null,
  hasSubmittedPass: boolean
): EventHandlerResult {
  const passedTiles = event.TilesPassed.tiles;
  const uiActions: EventHandlerResult['uiActions'] = [];
  const sideEffects: EventHandlerResult['sideEffects'] = [];

  // If not already submitted, show auto-pass message (timeout scenario)
  if (!hasSubmittedPass) {
    uiActions.push({ type: 'SET_HAS_SUBMITTED_PASS', value: true });
    uiActions.push({
      type: 'SET_BOT_PASS_MESSAGE',
      message: 'Time expired - auto-passing 3 tiles from hand',
    });

    // Schedule message clear
    sideEffects.push({
      type: 'TIMEOUT',
      id: 'bot-pass-message',
      ms: 3000,
      callback: () => {
        // Callback will be executed by SideEffectManager
        // Result: clear bot pass message
      },
    });
  }

  return {
    stateUpdates: [
      (prev) => {
        if (!prev) return null;

        const newHand = [...prev.your_hand];

        // Remove passed tiles (handle duplicates correctly)
        for (const tile of passedTiles) {
          const idx = newHand.indexOf(tile);
          if (idx !== -1) {
            newHand.splice(idx, 1);
          }
        }

        return {
          ...prev,
          your_hand: newHand,
        };
      },
    ],
    uiActions,
    sideEffects,
  };
}

/**
 * Handle TilesReceived event (Charleston phase)
 *
 * Adds received tiles to hand (sorted), highlights them, and shows incoming seat indicator.
 *
 * Original location: GameBoard.tsx lines 862-902
 * ```typescript
 * if ('TilesReceived' in event) {
 *   const receivedTiles = event.TilesReceived.tiles;
 *   setGameState((prev) => {
 *     if (!prev) return null;
 *     const newHand = sortHand([...prev.your_hand, ...receivedTiles]);
 *     // ... highlight logic
 *     return { ...prev, your_hand: newHand };
 *   });
 *   if (event.TilesReceived.from) {
 *     setIncomingFromSeat(event.TilesReceived.from);
 *     // ... timeout
 *   }
 * }
 * ```
 *
 * @param event - TilesReceived event from server
 * @param gameState - Current game state (can be null)
 * @returns Event handler result with state updates and UI actions
 */
export function handleTilesReceived(
  event: Extract<PrivateEvent, { TilesReceived: unknown }>,
  _gameState: GameStateSnapshot | null
): EventHandlerResult {
  const receivedTiles = event.TilesReceived.tiles;
  const fromSeat = event.TilesReceived.from;
  const uiActions: EventHandlerResult['uiActions'] = [];
  const sideEffects: EventHandlerResult['sideEffects'] = [];

  // Show incoming seat indicator (if not blind pass)
  if (fromSeat !== null) {
    uiActions.push({ type: 'SET_INCOMING_FROM_SEAT', seat: fromSeat });

    // Schedule incoming seat clear
    sideEffects.push({
      type: 'TIMEOUT',
      id: 'incoming-seat',
      ms: 350,
      callback: () => {
        // Callback will be executed by SideEffectManager
        // Result: clear incoming from seat
      },
    });
  }

  // Schedule highlight clear
  sideEffects.push({
    type: 'TIMEOUT',
    id: 'highlight-tiles',
    ms: 2000,
    callback: () => {
      // Callback will be executed by SideEffectManager
      // Result: clear highlighted tile IDs
    },
  });

  return {
    stateUpdates: [
      (prev) => {
        if (!prev) return null;

        // Add received tiles and sort
        const newHand = sortHand([...prev.your_hand, ...receivedTiles]);

        return {
          ...prev,
          your_hand: newHand,
        };
      },
    ],
    uiActions,
    sideEffects,
  };
}
