import { useEffect, useMemo, useState } from 'react';
import type { MoveHistorySummary } from '@/types/bindings/generated/MoveHistorySummary';

interface HistoryControlsProps {
  moves: MoveHistorySummary[];
  currentMove: number;
  viewingMove?: number;
  isViewingHistory: boolean;
  onJumpToMove: (moveNumber: number) => void;
  onReturnToPresent: () => void;
  onResumeFromHistory: () => void;
}

export function HistoryControls({
  moves,
  currentMove,
  viewingMove,
  isViewingHistory,
  onJumpToMove,
  onReturnToPresent,
  onResumeFromHistory,
}: HistoryControlsProps) {
  const maxMove = useMemo(
    () => (moves.length > 0 ? moves[moves.length - 1].move_number : 0),
    [moves]
  );
  const activeMove = isViewingHistory && viewingMove !== undefined ? viewingMove : currentMove;
  const [jumpValue, setJumpValue] = useState(String(activeMove));
  const hasMoves = moves.length > 0;

  useEffect(() => {
    setJumpValue(String(activeMove));
  }, [activeMove]);

  const handleJump = () => {
    const parsed = Number(jumpValue);
    if (!Number.isFinite(parsed)) return;
    onJumpToMove(parsed);
  };

  const handleSliderChange = (value: string) => {
    setJumpValue(value);
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      onJumpToMove(parsed);
    }
  };

  const canPrev = hasMoves && activeMove > 0;
  const canNext = hasMoves && activeMove < maxMove;

  return (
    <div className="history-controls">
      <div className="history-controls-row">
        <button onClick={() => onJumpToMove(activeMove - 1)} disabled={!canPrev}>
          Prev
        </button>
        <button onClick={() => onJumpToMove(activeMove + 1)} disabled={!canNext}>
          Next
        </button>
        <button onClick={onReturnToPresent} disabled={!isViewingHistory}>
          Return to Present
        </button>
      </div>

      <div className="history-controls-row">
        <label className="history-control-label">
          Move
          <input
            type="number"
            min={0}
            max={maxMove}
            value={jumpValue}
            onChange={(event) => setJumpValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                handleJump();
              }
            }}
            disabled={!hasMoves}
          />
        </label>
        <button onClick={handleJump} disabled={!hasMoves}>
          Jump
        </button>
        {isViewingHistory && (
          <button onClick={onResumeFromHistory} className="history-resume">
            Resume from Here
          </button>
        )}
      </div>

      <div className="history-controls-row">
        <input
          type="range"
          min={0}
          max={maxMove}
          step={1}
          value={hasMoves ? activeMove : 0}
          onChange={(event) => handleSliderChange(event.target.value)}
          disabled={!hasMoves}
          className="history-slider"
        />
        <div className="history-slider-labels">
          <span>0</span>
          <span>{maxMove}</span>
        </div>
      </div>
    </div>
  );
}
