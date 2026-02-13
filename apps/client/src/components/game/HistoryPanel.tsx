import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  getActionLabel,
  type ActionFilter,
  type UseHistoryDataResult,
} from '@/hooks/useHistoryData';
import { cn } from '@/lib/utils';
import type { Seat } from '@/types/bindings/generated/Seat';

export interface HistoryPanelProps {
  isOpen: boolean;
  roomId: string;
  onClose: () => void;
  history: UseHistoryDataResult;
  onJumpToMove?: (moveNumber: number) => void;
  activeMoveNumber?: number | null;
  dimmed?: boolean;
  overlayMessage?: string | null;
}

const PLAYER_FILTERS: Array<'All' | Seat> = ['All', 'East', 'South', 'West', 'North'];
const ACTION_FILTERS: ActionFilter[] = ['Draw', 'Discard', 'Call', 'Charleston', 'Special'];

function relativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const deltaMs = Date.now() - date.getTime();

  if (Number.isNaN(date.getTime())) return timestamp;
  if (deltaMs < 30_000) return 'just now';

  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function highlightText(text: string, query: string): ReactNode[] {
  if (!query) return [text];
  const normalized = query.toLowerCase();
  const source = text.toLowerCase();
  const chunks: ReactNode[] = [];

  let lastIndex = 0;
  let index = source.indexOf(normalized);

  while (index !== -1) {
    if (index > lastIndex) {
      chunks.push(text.slice(lastIndex, index));
    }

    const match = text.slice(index, index + query.length);
    chunks.push(
      <mark key={`${index}-${match}`} className="bg-yellow-200 px-0.5 text-black">
        {match}
      </mark>
    );

    lastIndex = index + query.length;
    index = source.indexOf(normalized, lastIndex);
  }

  if (lastIndex < text.length) {
    chunks.push(text.slice(lastIndex));
  }

  return chunks;
}

export function HistoryPanel(props: HistoryPanelProps) {
  if (!props.isOpen) return null;
  return <HistoryPanelContent {...props} />;
}

function HistoryPanelContent({
  isOpen,
  roomId,
  onClose,
  history,
  onJumpToMove,
  activeMoveNumber,
  dimmed = false,
  overlayMessage = null,
}: HistoryPanelProps) {
  const searchRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const {
    moves,
    filteredMoves,
    isLoading,
    error,
    playerFilter,
    actionFilters,
    searchQuery,
    expandedMoves,
    pulsingMoveNumber,
    setPlayerFilter,
    toggleActionFilter,
    setSearchQuery,
    toggleExpandedMove,
    exportHistory,
    clearError,
  } = history;

  const filterSummary = useMemo(() => {
    if (filteredMoves.length === moves.length) {
      return `Showing all ${moves.length} moves`;
    }

    const parts: string[] = [];
    if (playerFilter !== 'All') parts.push(playerFilter);
    if (actionFilters.size > 0) parts.push(Array.from(actionFilters).join(' + '));
    if (searchQuery) parts.push(`"${searchQuery}"`);

    const suffix = parts.length > 0 ? ` (${parts.join(', ')})` : '';
    return `Showing ${filteredMoves.length} of ${moves.length} moves${suffix}`;
  }, [actionFilters, filteredMoves.length, moves.length, playerFilter, searchQuery]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }

      if (event.key === '/') {
        event.preventDefault();
        searchRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!isOpen || !listRef.current) return;
    listRef.current.scrollTop = 0;
  }, [filteredMoves, isOpen]);

  return (
    <div className="fixed inset-0 z-40 pointer-events-auto" aria-hidden={false}>
      <div
        className="absolute inset-0 bg-black/35 transition-opacity duration-300 opacity-100"
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal="false"
        aria-label="Game move history"
        className={cn(
          'absolute right-0 top-0 h-full overflow-hidden border-l border-gray-700 bg-slate-900 text-slate-100 shadow-xl transition-transform duration-300',
          'w-[min(40vw,480px)] md:w-[min(30vw,560px)] min-w-[320px]',
          'translate-x-0',
          dimmed && 'opacity-70'
        )}
      >
        <div className="flex h-full flex-col" onClick={(event) => event.stopPropagation()}>
          <header className="border-b border-slate-700 p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Move History</h2>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportHistory('json', roomId)}
                  data-testid="history-export-json"
                >
                  JSON
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportHistory('csv', roomId)}
                  data-testid="history-export-csv"
                >
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportHistory('txt', roomId)}
                  data-testid="history-export-txt"
                >
                  Text
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  aria-label="Close history panel"
                >
                  X
                </Button>
              </div>
            </div>
            <p className="mt-2 text-xs text-slate-300">{filterSummary}</p>
          </header>

          <div className="space-y-3 border-b border-slate-700 p-4">
            <Input
              ref={searchRef}
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search moves..."
              aria-label="Search move history"
              disabled={moves.length === 0}
            />

            <div className="flex flex-wrap gap-2">
              {PLAYER_FILTERS.map((seat) => (
                <Button
                  key={seat}
                  size="sm"
                  variant={playerFilter === seat ? 'default' : 'outline'}
                  onClick={() => setPlayerFilter(seat)}
                  disabled={moves.length === 0}
                  data-testid={`history-player-filter-${seat.toLowerCase()}`}
                >
                  {seat}
                </Button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2">
              {ACTION_FILTERS.map((filter) => (
                <label
                  key={filter}
                  className="flex items-center gap-2 rounded border border-slate-700 px-2 py-1 text-xs"
                >
                  <Checkbox
                    checked={actionFilters.has(filter)}
                    onCheckedChange={() => toggleActionFilter(filter)}
                    disabled={moves.length === 0}
                    aria-label={`${filter} filter`}
                  />
                  <span>{filter}</span>
                </label>
              ))}
            </div>

            {error && (
              <div className="flex items-center justify-between rounded border border-red-700 bg-red-950/60 px-2 py-1 text-xs text-red-200">
                <span>{error}</span>
                <Button variant="ghost" size="sm" onClick={clearError}>
                  Dismiss
                </Button>
              </div>
            )}
          </div>

          <div
            ref={listRef}
            className="flex-1 space-y-2 overflow-y-auto p-4"
            role="region"
            aria-label="Move list"
            aria-live="polite"
          >
            {isLoading && <p className="text-sm text-slate-300">Loading move history...</p>}
            {!isLoading && moves.length === 0 && (
              <p className="text-sm text-slate-300">No moves yet. History will appear here.</p>
            )}
            {!isLoading && moves.length > 0 && filteredMoves.length === 0 && (
              <p className="text-sm text-slate-300">No moves matching filter.</p>
            )}

            {filteredMoves.map((move, index) => {
              const isExpanded = expandedMoves.has(move.move_number);
              const isMostRecent = index === 0;
              const isPulsing = pulsingMoveNumber === move.move_number;

              return (
                <article
                  key={move.move_number}
                  className={cn(
                    'rounded border border-slate-700 bg-slate-800 p-3 text-sm',
                    isMostRecent && 'ring-1 ring-cyan-400/70',
                    activeMoveNumber === move.move_number && 'ring-2 ring-blue-400',
                    isPulsing && 'animate-pulse'
                  )}
                  role="button"
                  tabIndex={0}
                  aria-expanded={isExpanded}
                  onClick={() => toggleExpandedMove(move.move_number)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      toggleExpandedMove(move.move_number);
                    }
                  }}
                  data-testid={`history-entry-${move.move_number}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        #{move.move_number} {move.seat}
                      </p>
                      <p>{highlightText(move.description, searchQuery)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="secondary">{getActionLabel(move.action)}</Badge>
                      <span className="text-xs text-slate-400" title={move.timestamp}>
                        {relativeTime(move.timestamp)}
                      </span>
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-2 space-y-2 border-t border-slate-700 pt-2">
                      <p className="text-xs text-slate-300">{move.description}</p>
                      <pre className="max-h-28 overflow-auto rounded bg-slate-950/80 p-2 text-[11px] text-slate-200">
                        {JSON.stringify(move.action, null, 2)}
                      </pre>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(event) => {
                          event.stopPropagation();
                          if (onJumpToMove) onJumpToMove(move.move_number);
                        }}
                        disabled={!onJumpToMove}
                      >
                        Jump to Move #{move.move_number}
                      </Button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {overlayMessage && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/60 px-4 text-center text-sm text-slate-100">
              {overlayMessage}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
