import { useEffect, useMemo, useRef } from 'react';
import type { MoveHistorySummary } from '@/types/bindings/generated/MoveHistorySummary';

interface HistoryTimelineProps {
  moves: MoveHistorySummary[];
  currentMove: number;
  viewingMove?: number;
  isViewingHistory: boolean;
  onSelectMove: (moveNumber: number) => void;
}

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleTimeString();
};

export function HistoryTimeline({
  moves,
  currentMove,
  viewingMove,
  isViewingHistory,
  onSelectMove,
}: HistoryTimelineProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const activeMove = isViewingHistory && viewingMove !== undefined ? viewingMove : currentMove;

  const movesWithDisplay = useMemo(
    () =>
      moves.map((move) => ({
        ...move,
        displayTime: formatTimestamp(move.timestamp),
      })),
    [moves]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    const target = containerRef.current.querySelector(`[data-move="${activeMove}"]`);
    if (target instanceof HTMLElement) {
      target.scrollIntoView({ block: 'nearest' });
    }
  }, [activeMove, movesWithDisplay.length]);

  if (movesWithDisplay.length === 0) {
    return (
      <div className="history-timeline" ref={containerRef}>
        <p className="history-empty">No history entries yet.</p>
      </div>
    );
  }

  return (
    <div className="history-timeline" ref={containerRef}>
      <ul className="history-list">
        {movesWithDisplay.map((move) => {
          const isActive = move.move_number === activeMove;
          return (
            <li
              key={move.move_number}
              className={`history-entry${isActive ? ' active' : ''}`}
              data-move={move.move_number}
            >
              <button
                type="button"
                className="history-entry-button"
                onClick={() => onSelectMove(move.move_number)}
              >
                <div className="history-entry-title">
                  <span>Move {move.move_number}</span>
                  <span>{move.seat}</span>
                  <span>{move.displayTime}</span>
                </div>
                <div className="history-entry-desc">{move.description}</div>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
