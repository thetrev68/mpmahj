/**
 * @module privateEventHandlers
 *
 * Pure event handler functions for PrivateEvent messages sent to individual players or pairs.
 * Private events contain sensitive game state (your hand, new tiles, etc.) and are never
 * broadcast to other players. Each handler returns declarative actions for state updates.
 *
 * Event types:
 * - **DealtToPlayer**: Initial hand dealt during Setup (13-14 tiles)
 * - **TilesReceived**: New tiles received during Charleston or during draw in Playing phase
 * - **TilesReturned**: Tiles returned after courtesy pass negotiation rejection
 * - Other future private events (e.g., AI analysis, observer-only events)
 *
 * Key algorithms:
 * - {@link buildNewTileIds} - Identifies which received tiles are "new" for animation highlighting
 * - {@link buildLeavingTileIds} - Marks tiles being passed for exit animation
 * - {@link buildTileInstances} - Creates unique TileInstance objects (for React keys)
 *
 * Pure handler benefits:
 * - **Testable**: Pure functions with clear inputs and outputs
 * - **Secure**: No accidental exposure of private data in logs
 * - **Isolated**: Private events don't affect public state directly
 * - **Replayable**: Event handlers can be re-run for state restoration
 *
 * @see {@link src/hooks/useGameEvents.ts} for event dispatch orchestration
 * @see {@link src/lib/game-events/types.ts} for return type definitions
 * @see {@link src/types/bindings/generated/PrivateEvent.ts} for event shapes
 */

import type { PrivateEvent } from '@/types/bindings/generated/PrivateEvent';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { EventHandlerResult } from './types';
import { EMPTY_RESULT } from './types';
import { sortHand } from '@/lib/utils/tileUtils';

/**
 * Represents a single tile with a unique identifier for React rendering and animation tracking.
 *
 * @typedef {Object} TileInstance
 * @property {string} id - Unique identifier (e.g., "5-2" = tile 5, index 2 in hand)
 * @property {number} tile - Tile index (0-43)
 */
type TileInstance = { id: string; tile: number };

/**
 * Converts a flat tile array to TileInstance objects with unique IDs for React keys.
 *
 * @internal
 * @param {number[]} hand - Flat array of tile indices
 * @returns {TileInstance[]} Array of tile instances with unique IDs
 */
const buildTileInstances = (hand: number[]): TileInstance[] =>
  hand.map((tile, index) => ({ id: `${tile}-${index}`, tile }));

/**
 * Identifies which newly received tiles are "new" (not in old hand) for highlighting animation.
 * Algorithm:
 * 1. Build target count map of tiles to highlight (tilesToMark)
 * 2. Count how many of each tile type exist in old hand
 * 3. Iterate through new hand, marking tiles as "new" when they exceed old count
 * 4. Return IDs of newly marked tiles in order
 *
 * Used for entry animation highlighting when tiles arrive (Charleston, draw).
 *
 * @internal
 * @param {number[]} oldHand - Previous hand tile array
 * @param {number[]} newHand - Updated hand tile array
 * @param {number[]} tilesToMark - Specific tiles to highlight as new (usually passed/received tiles)
 * @returns {string[]} IDs of newly marked tiles (ready for highlight animation)
 */
const buildNewTileIds = (oldHand: number[], newHand: number[], tilesToMark: number[]): string[] => {
  if (tilesToMark.length === 0) return [];

  const targetCounts = new Map<number, number>();
  tilesToMark.forEach((tile) => {
    targetCounts.set(tile, (targetCounts.get(tile) ?? 0) + 1);
  });

  const oldCounts = new Map<number, number>();
  oldHand.forEach((tile) => {
    oldCounts.set(tile, (oldCounts.get(tile) ?? 0) + 1);
  });

  const seenCounts = new Map<number, number>();
  const ids: string[] = [];
  const instances = buildTileInstances(newHand);

  for (const instance of instances) {
    const tile = instance.tile;
    const needed = targetCounts.get(tile) ?? 0;
    if (needed === 0) continue;

    const oldCount = oldCounts.get(tile) ?? 0;
    const seen = seenCounts.get(tile) ?? 0;

    if (seen >= oldCount) {
      ids.push(instance.id);
      if (needed === 1) {
        targetCounts.delete(tile);
      } else {
        targetCounts.set(tile, needed - 1);
      }
    }

    seenCounts.set(tile, seen + 1);
    if (ids.length === tilesToMark.length) break;
  }

  return ids;
};

/**
 * Identifies which tiles are leaving the hand (being passed) for exit animation.
 * Algorithm:
 * 1. Build tile instances with unique IDs from current hand
 * 2. For each tile to remove, find the first instance not already used
 * 3. Mark that instance's ID as "leaving"
 * 4. Return IDs in order for synchronized pass animation
 *
 * Used for exit animation when tiles are passed (Charleston) or discarded.
 *
 * @internal
 * @param {number[]} hand - Current hand tile array
 * @param {number[]} tilesToRemove - Tile indices to animate as leaving (e.g., 3 passing tiles)
 * @returns {string[]} IDs of tiles leaving (ready for exit animation)
 */
const buildLeavingTileIds = (hand: number[], tilesToRemove: number[]): string[] => {
  const instances = buildTileInstances(hand);
  const ids: string[] = [];
  const used = new Set<string>();

  tilesToRemove.forEach((tile) => {
    const match = instances.find((instance) => instance.tile === tile && !used.has(instance.id));
    if (match) {
      used.add(match.id);
      ids.push(match.id);
    }
  });

  return ids;
};

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
  gameState: GameStateSnapshot | null,
  hasSubmittedPass: boolean
): EventHandlerResult {
  const passedTiles = event.TilesPassed.tiles;
  const uiActions: EventHandlerResult['uiActions'] = [];
  const sideEffects: EventHandlerResult['sideEffects'] = [];
  const leavingIds = gameState ? buildLeavingTileIds(gameState.your_hand, passedTiles) : [];

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

  if (leavingIds.length > 0) {
    uiActions.push({ type: 'SET_LEAVING_TILE_IDS', ids: leavingIds });
    sideEffects.push({
      type: 'TIMEOUT',
      id: 'leaving-tiles',
      ms: 300,
      callback: () => {
        // Callback will be executed by SideEffectManager
        // Result: clear leaving tile IDs and selection
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
  gameState: GameStateSnapshot | null
): EventHandlerResult {
  const receivedTiles = event.TilesReceived.tiles;
  const fromSeat = event.TilesReceived.from;
  const uiActions: EventHandlerResult['uiActions'] = [];
  const sideEffects: EventHandlerResult['sideEffects'] = [];
  const newHand = gameState ? sortHand([...gameState.your_hand, ...receivedTiles]) : [];
  const highlightedIds = gameState
    ? buildNewTileIds(gameState.your_hand, newHand, receivedTiles)
    : [];

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
  if (highlightedIds.length > 0) {
    uiActions.push({ type: 'SET_HIGHLIGHTED_TILE_IDS', ids: highlightedIds });
    sideEffects.push({
      type: 'TIMEOUT',
      id: 'highlight-tiles',
      ms: 2000,
      callback: () => {
        // Callback will be executed by SideEffectManager
        // Result: clear highlighted tile IDs
      },
    });
  }

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

// ============================================================================
// Playing Phase Private Event Handlers
// ============================================================================

/**
 * Handle TileDrawnPrivate event (Playing phase)
 *
 * Adds drawn tile to hand and highlights it.
 *
 * Original location: GameBoard.tsx lines 933-990
 * ```typescript
 * if ('TileDrawnPrivate' in event) {
 *   const { tile, remaining_tiles } = event.TileDrawnPrivate;
 *   setGameState((prev) => {
 *     const newHand = sortHand([...prev.your_hand, tile]);
 *     const newHandInstances = newHand.map((t, index) => ({ id: `${t}-${index}`, tile: t }));
 *     const drawnTileId = newHandInstances.find((t) => t.tile === tile && !prev.hand_instances.some(...))?.id;
 *     setHighlightedTileIds(drawnTileId ? [drawnTileId] : []);
 *     return { ...prev, your_hand: newHand, wall_tiles_remaining: remaining_tiles };
 *   });
 * }
 * ```
 */
export function handleTileDrawnPrivate(
  event: Extract<PrivateEvent, { TileDrawnPrivate: unknown }>,
  gameState: GameStateSnapshot | null
): EventHandlerResult {
  const { tile, remaining_tiles } = event.TileDrawnPrivate;
  const newHand = gameState ? sortHand([...gameState.your_hand, tile]) : [];
  const highlightedIds = gameState ? buildNewTileIds(gameState.your_hand, newHand, [tile]) : [];

  return {
    stateUpdates: [
      (prev) => {
        if (!prev) return null;

        const newHand = sortHand([...prev.your_hand, tile]);

        return {
          ...prev,
          your_hand: newHand,
          wall_tiles_remaining: remaining_tiles,
        };
      },
    ],
    uiActions: [
      { type: 'CLEAR_PENDING_DRAW_RETRY' },
      ...(highlightedIds.length > 0
        ? [{ type: 'SET_HIGHLIGHTED_TILE_IDS' as const, ids: highlightedIds }]
        : []),
    ],
    sideEffects:
      highlightedIds.length > 0
        ? [
            {
              type: 'TIMEOUT',
              id: 'highlight-drawn-tile',
              ms: 2000,
              callback: () => {
                // Clear highlight after 2 seconds
              },
            },
          ]
        : [],
  };
}

export interface PrivateEventContext {
  gameState: GameStateSnapshot | null;
  hasSubmittedPass: boolean;
}

export function handlePrivateEvent(
  event: PrivateEvent,
  context: PrivateEventContext
): EventHandlerResult {
  if (typeof event !== 'object' || event === null) {
    return EMPTY_RESULT;
  }

  if ('TilesPassed' in event) {
    return handleTilesPassed(event, context.gameState, context.hasSubmittedPass);
  }

  if ('TilesReceived' in event) return handleTilesReceived(event, context.gameState);
  if ('TileDrawnPrivate' in event) return handleTileDrawnPrivate(event, context.gameState);

  return EMPTY_RESULT;
}
