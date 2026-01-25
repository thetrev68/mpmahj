import { useEffect, useMemo, useState } from 'react';
import type { MouseEvent } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useHistory } from '@/hooks/useHistory';
import { HistoryTimeline } from './HistoryTimeline';
import { HistoryControls } from './HistoryControls';
import { ResumeFromHistoryDialog } from './ResumeFromHistoryDialog';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import './HistoryPanel.css';

export function HistoryPanel({ sendCommand }: { sendCommand: (command: GameCommand) => boolean }) {
  const showHistoryPanel = useUIStore((state) => state.showHistoryPanel);
  const setShowHistoryPanel = useUIStore((state) => state.setShowHistoryPanel);
  const { history, requestHistory, jumpToMove, resumeFromHistory, returnToPresent } =
    useHistory(sendCommand);

  const [showResumeDialog, setShowResumeDialog] = useState(false);

  useEffect(() => {
    if (showHistoryPanel) {
      requestHistory();
    }
  }, [requestHistory, showHistoryPanel]);

  const lastMove = useMemo(() => {
    if (history.moves.length === 0) return 0;
    return history.moves[history.moves.length - 1].move_number;
  }, [history.moves]);

  if (!showHistoryPanel) {
    return null;
  }

  const handleClose = () => {
    setShowHistoryPanel(false);
  };

  const handleReturnToPresent = () => {
    returnToPresent();
    setShowHistoryPanel(false);
  };

  const handleResumeConfirm = () => {
    const moveNumber = history.viewingMove ?? history.currentMove;
    resumeFromHistory(moveNumber);
    setShowResumeDialog(false);
  };

  const handleBackdropClick = (event: MouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) {
      handleClose();
    }
  };

  return (
    <div className="history-panel-backdrop" onClick={handleBackdropClick}>
      <div className="history-panel">
        <div className="history-panel-header">
          <h3>Game History</h3>
          <button className="history-panel-close" onClick={handleClose}>
            X
          </button>
        </div>

        <HistoryTimeline
          moves={history.moves}
          currentMove={history.currentMove}
          viewingMove={history.viewingMove}
          isViewingHistory={history.isViewingHistory}
          onSelectMove={jumpToMove}
        />

        <HistoryControls
          moves={history.moves}
          currentMove={history.currentMove}
          viewingMove={history.viewingMove}
          isViewingHistory={history.isViewingHistory}
          onJumpToMove={jumpToMove}
          onReturnToPresent={handleReturnToPresent}
          onResumeFromHistory={() => setShowResumeDialog(true)}
        />
      </div>

      <ResumeFromHistoryDialog
        open={showResumeDialog}
        moveNumber={history.viewingMove ?? history.currentMove}
        lastMove={lastMove}
        onCancel={() => setShowResumeDialog(false)}
        onConfirm={handleResumeConfirm}
      />
    </div>
  );
}
