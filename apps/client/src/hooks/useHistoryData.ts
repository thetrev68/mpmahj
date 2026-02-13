import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getTileName } from '@/lib/utils/tileUtils';
import type { Event as ServerEvent } from '@/types/bindings/generated/Event';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { MoveAction } from '@/types/bindings/generated/MoveAction';
import type { MoveHistorySummary } from '@/types/bindings/generated/MoveHistorySummary';
import type { Seat } from '@/types/bindings/generated/Seat';

export type ActionFilter = 'Draw' | 'Discard' | 'Call' | 'Charleston' | 'Special';

export interface UseHistoryDataOptions {
  isOpen: boolean;
  mySeat: Seat;
  sendCommand: (command: GameCommand) => void;
  eventBus?: {
    on: (event: string, handler: (data: unknown) => void) => () => void;
  };
}

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

function actionKind(action: MoveAction): string {
  if (typeof action === 'string') return action;
  return Object.keys(action)[0] ?? 'Unknown';
}

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
  if (kind === 'Forfeit') return 'Forfeit';

  return kind;
}

function moveMatchesSearch(move: MoveHistorySummary, query: string): boolean {
  if (!query) return true;
  const normalized = query.toLowerCase();

  return (
    move.description.toLowerCase().includes(normalized) ||
    move.seat.toLowerCase().includes(normalized) ||
    getActionLabel(move.action).toLowerCase().includes(normalized)
  );
}

function toCsvSafe(value: string): string {
  const escaped = value.replaceAll('"', '""');
  return `"${escaped}"`;
}

function triggerDownload(content: string, mimeType: string, filename: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function eventToHistoryMove(event: ServerEvent, nextMoveNumber: number): MoveHistorySummary | null {
  if (typeof event !== 'object' || event === null || !('Public' in event)) return null;
  const pub = event.Public;

  if (pub === 'CallWindowClosed') {
    return {
      move_number: nextMoveNumber,
      timestamp: new Date().toISOString(),
      seat: 'East',
      action: 'CallWindowClosed',
      description: 'Call window closed',
    };
  }

  if (typeof pub !== 'object' || pub === null) return null;

  if ('TileDiscarded' in pub) {
    return {
      move_number: nextMoveNumber,
      timestamp: new Date().toISOString(),
      seat: pub.TileDiscarded.player,
      action: { DiscardTile: { tile: pub.TileDiscarded.tile } },
      description: `Discarded ${getTileName(pub.TileDiscarded.tile)}`,
    };
  }

  if ('CallWindowOpened' in pub) {
    return {
      move_number: nextMoveNumber,
      timestamp: new Date().toISOString(),
      seat: pub.CallWindowOpened.discarded_by,
      action: { CallWindowOpened: { tile: pub.CallWindowOpened.tile } },
      description: `Call window opened for ${getTileName(pub.CallWindowOpened.tile)}`,
    };
  }

  if ('TilesPassing' in pub) {
    return {
      move_number: nextMoveNumber,
      timestamp: new Date().toISOString(),
      seat: 'East',
      action: { PassTiles: { direction: pub.TilesPassing.direction, count: 3 } },
      description: `Tiles passed ${pub.TilesPassing.direction.toLowerCase()}`,
    };
  }

  return null;
}

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

    const unsubscribe = eventBus.on('server-event', (payload: unknown) => {
      const event = payload as ServerEvent;
      if (typeof event !== 'object' || event === null || !('Public' in event)) return;
      const pub = event.Public;

      if (typeof pub === 'object' && pub !== null && 'HistoryList' in pub) {
        hasReceivedHistoryRef.current = true;
        clearRetryTimeout();
        setMoves(pub.HistoryList.entries);
        setIsLoading(false);
        setError(null);
        return;
      }

      if (typeof pub === 'object' && pub !== null && 'HistoryError' in pub) {
        setError(pub.HistoryError.message);
        setIsLoading(false);
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
