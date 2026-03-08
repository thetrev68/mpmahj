/**
 * Custom hook for managing game move history, filtering, and export
 *
 * Provides access to server-side game move history with filtering by player and action type,
 * full-text search, and export to JSON/CSV/TXT formats. Automatically requests history on mount
 * and retries on failure (up to 3 attempts with 5s backoff).
 *
 * Listens to server events via eventBus to incrementally build move history in real time
 * as the game progresses. Stores expanded/pulsing UI state for highlighting recent moves.
 *
 * @see `../../types/bindings/generated/MoveHistorySummary.ts`
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTileName } from '@/lib/utils/tileUtils';
import type { ServerEventNotification } from '@/lib/game-events/types';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { MoveAction } from '@/types/bindings/generated/MoveAction';
import type { MoveHistorySummary } from '@/types/bindings/generated/MoveHistorySummary';
import type { Seat } from '@/types/bindings/generated/Seat';

/**
 * Action categories for history filtering.
 *
 * - `'Draw'` — tile draw from wall
 * - `'Discard'` — tile discard
 * - `'Call'` — meld call, Mahjong call, or call window event
 * - `'Charleston'` — tile pass or Charleston completion
 * - `'Special'` — Kong declaration, Joker exchange, pause/resume, etc.
 */
export type ActionFilter = 'Draw' | 'Discard' | 'Call' | 'Charleston' | 'Special';

/**
 * Hook options for initializing game history state.
 *
 * @property isOpen - Whether the history panel is visible (controls request lifecycle)
 * @property mySeat - Current player's seat for context in RequestHistory command
 * @property sendCommand - Function to send RequestHistory command to server
 * @property eventBus - Optional event bus for subscribing to real-time server events
 */
export interface UseHistoryDataOptions {
  isOpen: boolean;
  mySeat: Seat;
  sendCommand: (command: GameCommand) => void;
  eventBus?: {
    onServerEvent: (handler: (event: ServerEventNotification) => void) => () => void;
  };
}

/**
 * Return type for useHistoryData hook.
 *
 * @property moves - All moves received from server (including real-time updates)
 * @property filteredMoves - Moves after applying player, action, and search filters
 * @property isLoading - True while waiting for history response from server
 * @property error - Error message if history request failed (set by retry logic)
 * @property playerFilter - Current player filter ('All' or specific Seat)
 * @property actionFilters - Set of active action type filters
 * @property searchQuery - Current full-text search query
 * @property expandedMoves - Move numbers marked as expanded (UI state)
 * @property pulsingMoveNumber - Move number to highlight as most recent (UI state)
 * @property requestCount - Number of RequestHistory commands sent (for debugging retry logic)
 * @property setPlayerFilter - Update player filter
 * @property toggleActionFilter - Add/remove action type from filters (set-like toggle)
 * @property setSearchQuery - Update search query
 * @property toggleExpandedMove - Mark move as expanded/collapsed (UI toggle)
 * @property exportHistory - Download move history in specified format with filename
 * @property clearError - Clear error message from failed request
 */
export interface UseHistoryDataResult {
  moves: MoveHistorySummary[];
  filteredMoves: MoveHistorySummary[];
  isLoading: boolean;
  error: string | null;
  playerFilter: 'All' | Seat;
  actionFilters: Set<ActionFilter>;
  searchQuery: string;
  expandedMoves: Set<number>;
  pulsingMoveNumber: number | null;
  requestCount: number;
  setPlayerFilter: (filter: 'All' | Seat) => void;
  toggleActionFilter: (filter: ActionFilter) => void;
  setSearchQuery: (query: string) => void;
  toggleExpandedMove: (moveNumber: number) => void;
  exportHistory: (format: 'json' | 'csv' | 'txt', roomId: string) => void;
  clearError: () => void;
}

/**
 * Extract action discriminant key from MoveAction.
 * @internal
 */
function actionKind(action: MoveAction): string {
  if (typeof action === 'string') return action;
  return Object.keys(action)[0] ?? 'Unknown';
}

/**
 * Categorize a MoveAction into an ActionFilter bucket for UI filtering.
 *
 * @param action - Server-provided action (discriminated union or string)
 * @returns Filter category for this action
 */
export function getActionCategory(action: MoveAction): ActionFilter {
  const kind = actionKind(action);

  if (kind === 'DrawTile') return 'Draw';
  if (kind === 'DiscardTile') return 'Discard';
  if (kind === 'PassTiles' || kind === 'CharlestonCompleted') return 'Charleston';
  if (
    kind === 'MeldCalled' ||
    kind === 'MahjongByCall' ||
    kind === 'CallWindowOpened' ||
    kind === 'CallWindowClosed'
  ) {
    return 'Call';
  }

  return 'Special';
}

/**
 * Generate human-readable label for a MoveAction (for UI display).
 *
 * @param action - Server-provided action
 * @returns Display string like "Draw", "Call Mahjong", etc.
 */
export function getActionLabel(action: MoveAction): string {
  const kind = actionKind(action);

  if (kind === 'DrawTile') return 'Draw';
  if (kind === 'DiscardTile') return 'Discard';
  if (kind === 'MeldCalled') return 'Call Meld';
  if (kind === 'MahjongByCall') return 'Call Mahjong';
  if (kind === 'PassTiles') return 'Pass Tiles';
  if (kind === 'DeclareKong') return 'Declare Kong';
  if (kind === 'ExchangeJoker') return 'Exchange Joker';
  if (kind === 'DeclareWin') return 'Declare Win';
  if (kind === 'CallWindowOpened') return 'Call Window Opened';
  if (kind === 'CallWindowClosed') return 'Call Window Closed';
  if (kind === 'CharlestonCompleted') return 'Charleston Complete';
  if (kind === 'PauseGame') return 'Pause Game';
  if (kind === 'ResumeGame') return 'Resume Game';
  return kind;
}

/**
 * Check if a move matches a full-text search query.
 * Searches description, seat, and action label (case-insensitive).
 * @internal
 */
function moveMatchesSearch(move: MoveHistorySummary, query: string): boolean {
  if (!query) return true;
  const normalized = query.toLowerCase();

  return (
    move.description.toLowerCase().includes(normalized) ||
    move.seat.toLowerCase().includes(normalized) ||
    getActionLabel(move.action).toLowerCase().includes(normalized)
  );
}

/**
 * Escape double quotes in CSV value and wrap in quotes for safe CSV serialization.
 * @internal
 */
function toCsvSafe(value: string): string {
  const escaped = value.replaceAll('"', '""');
  return `"${escaped}"`;
}

/**
 * Trigger browser download of content as a file (client-side only).
 * @internal
 */
function triggerDownload(content: string, mimeType: string, filename: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Translate a narrowed server-event notification into a MoveHistorySummary for display.
 *
 * Maps server-event notifications (discards, call windows, tile passing)
 * to structured history moves with human-readable descriptions.
 *
 * @param event - Typed server notification from useGameEvents
 * @param nextMoveNumber - Sequence number for this move in history
 * @returns MoveHistorySummary if event is translatable, null otherwise
 *
 * @internal
 */
function eventToHistoryMove(
  event: ServerEventNotification,
  nextMoveNumber: number
): MoveHistorySummary | null {
  if (event.type === 'history-move-call-window-closed') {
    return {
      move_number: nextMoveNumber,
      timestamp: new Date().toISOString(),
      seat: 'East',
      action: 'CallWindowClosed',
      description: 'Call window closed',
    };
  }

  if (event.type === 'history-move-tile-discarded') {
    return {
      move_number: nextMoveNumber,
      timestamp: new Date().toISOString(),
      seat: event.player,
      action: { DiscardTile: { tile: event.tile } },
      description: `Discarded ${getTileName(event.tile)}`,
    };
  }

  if (event.type === 'history-move-call-window-opened') {
    return {
      move_number: nextMoveNumber,
      timestamp: new Date().toISOString(),
      seat: event.discardedBy,
      action: { CallWindowOpened: { tile: event.tile } },
      description: `Call window opened for ${getTileName(event.tile)}`,
    };
  }

  if (event.type === 'history-move-tiles-passing') {
    return {
      move_number: nextMoveNumber,
      timestamp: new Date().toISOString(),
      seat: 'East',
      action: { PassTiles: { direction: event.direction, count: 3 } },
      description: `Tiles passed ${event.direction.toLowerCase()}`,
    };
  }

  return null;
}

/**
 * Hook for managing game move history, filtering, and export.
 *
 * Requests historical move data from the server when the history panel opens.
 * Implements exponential backoff retry (up to 3 attempts, 5s interval). Listens to real-time
 * server events via eventBus to incrementally add new moves as the game progresses.
 * Provides filtering by player and action category, full-text search, and export to JSON/CSV/TXT.
 *
 * @param options - Configuration: isOpen, mySeat, sendCommand, eventBus
 * @returns State and mutations for history display and filtering
 *
 * @example
 * ```tsx
 * const history = useHistoryData({ isOpen, mySeat, sendCommand, eventBus });
 * history.setPlayerFilter('East');
 * history.toggleActionFilter('Draw');
 * const filtered = history.filteredMoves; // filtered by current selections
 * history.exportHistory('csv', roomId);
 * ```
 */
export function useHistoryData(options: UseHistoryDataOptions): UseHistoryDataResult {
  const { isOpen, mySeat, sendCommand, eventBus } = options;
  const [moves, setMoves] = useState<MoveHistorySummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [playerFilter, setPlayerFilter] = useState<'All' | Seat>('All');
  const [actionFilters, setActionFilters] = useState<Set<ActionFilter>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedMoves, setExpandedMoves] = useState<Set<number>>(new Set());
  const [pulsingMoveNumber, setPulsingMoveNumber] = useState<number | null>(null);
  const [requestCount, setRequestCount] = useState(0);
  const requestAttemptsRef = useRef(0);
  const hasReceivedHistoryRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearRetryTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const sendRequestHistory = useCallback(() => {
    requestAttemptsRef.current += 1;
    setRequestCount(requestAttemptsRef.current);
    sendCommand({ RequestHistory: { player: mySeat } });
  }, [mySeat, sendCommand]);

  useEffect(() => {
    if (!isOpen) {
      requestAttemptsRef.current = 0;
      hasReceivedHistoryRef.current = false;
      clearRetryTimeout();
      return;
    }

    const scheduleTimeout = () => {
      timeoutRef.current = setTimeout(() => {
        if (hasReceivedHistoryRef.current) return;

        if (requestAttemptsRef.current < 3) {
          setError('Failed to load history. Retrying...');
          sendRequestHistory();
          scheduleTimeout();
          return;
        }

        setIsLoading(false);
        setError('Failed to load history. Retrying...');
      }, 5000);
    };

    const bootstrapTimer = setTimeout(() => {
      hasReceivedHistoryRef.current = false;
      setIsLoading(true);
      setError(null);
      sendRequestHistory();
      scheduleTimeout();
    }, 0);

    return () => {
      clearTimeout(bootstrapTimer);
      clearRetryTimeout();
    };
  }, [clearRetryTimeout, isOpen, sendRequestHistory]);

  useEffect(() => {
    if (!eventBus) return;

    const unsubscribe = eventBus.onServerEvent((event) => {
      if (event.type === 'history-list') {
        hasReceivedHistoryRef.current = true;
        clearRetryTimeout();
        setMoves(event.entries);
        setIsLoading(false);
        setError(null);
        return;
      }

      if (event.type === 'history-error') {
        setError(event.message);
        setIsLoading(false);
        return;
      }

      if (event.type === 'history-truncated') {
        setMoves((prev) => prev.filter((move) => move.move_number < event.fromMove));
        return;
      }

      setMoves((prev) => {
        const nextMove = eventToHistoryMove(event, (prev[prev.length - 1]?.move_number ?? 0) + 1);
        if (!nextMove) return prev;

        setPulsingMoveNumber(nextMove.move_number);
        const pulseTimeout = setTimeout(() => setPulsingMoveNumber(null), 1000);
        void pulseTimeout;

        return [...prev, nextMove];
      });
    });

    return unsubscribe;
  }, [clearRetryTimeout, eventBus]);

  const toggleActionFilter = useCallback((filter: ActionFilter) => {
    setActionFilters((prev) => {
      const next = new Set(prev);
      if (next.has(filter)) {
        next.delete(filter);
      } else {
        next.add(filter);
      }
      return next;
    });
  }, []);

  const toggleExpandedMove = useCallback((moveNumber: number) => {
    setExpandedMoves((prev) => {
      const next = new Set(prev);
      if (next.has(moveNumber)) {
        next.delete(moveNumber);
      } else {
        next.add(moveNumber);
      }
      return next;
    });
  }, []);

  const filteredMoves = useMemo(() => {
    return [...moves].reverse().filter((move) => {
      if (playerFilter !== 'All' && move.seat !== playerFilter) {
        return false;
      }

      if (actionFilters.size > 0 && !actionFilters.has(getActionCategory(move.action))) {
        return false;
      }

      return moveMatchesSearch(move, searchQuery);
    });
  }, [actionFilters, moves, playerFilter, searchQuery]);

  const exportHistory = useCallback(
    (format: 'json' | 'csv' | 'txt', roomId: string) => {
      const filenameBase = `game-${roomId}-history`;

      if (format === 'json') {
        const content = JSON.stringify(
          {
            moves,
            exported_at: new Date().toISOString(),
          },
          null,
          2
        );
        triggerDownload(content, 'application/json', `${filenameBase}.json`);
        return;
      }

      if (format === 'csv') {
        const header = 'Move,Player,Action,Description,Timestamp\n';
        const rows = moves
          .map((move) => {
            return [
              move.move_number.toString(),
              toCsvSafe(move.seat),
              toCsvSafe(getActionLabel(move.action)),
              toCsvSafe(move.description),
              toCsvSafe(move.timestamp),
            ].join(',');
          })
          .join('\n');

        triggerDownload(`${header}${rows}`, 'text/csv', `${filenameBase}.csv`);
        return;
      }

      const lines = moves.map((move) => {
        return `#${move.move_number} ${move.seat}: ${move.description} (${move.timestamp})`;
      });
      triggerDownload(lines.join('\n'), 'text/plain', `${filenameBase}.txt`);
    },
    [moves]
  );

  return {
    moves,
    filteredMoves,
    isLoading,
    error,
    playerFilter,
    actionFilters,
    searchQuery,
    expandedMoves,
    pulsingMoveNumber,
    requestCount,
    setPlayerFilter,
    toggleActionFilter,
    setSearchQuery,
    toggleExpandedMove,
    exportHistory,
    clearError: () => setError(null),
  };
}
