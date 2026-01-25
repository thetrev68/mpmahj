import './ResumeFromHistoryDialog.css';

interface ResumeFromHistoryDialogProps {
  open: boolean;
  moveNumber: number;
  lastMove: number;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ResumeFromHistoryDialog({
  open,
  moveNumber,
  lastMove,
  onCancel,
  onConfirm,
}: ResumeFromHistoryDialogProps) {
  if (!open) {
    return null;
  }

  const hasFutureMoves = lastMove > moveNumber;
  const firstDeleted = moveNumber + 1;

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <div className="dialog-header">
          <h3>Resume from Move {moveNumber}?</h3>
        </div>

        <div className="dialog-body">
          <p style={{ marginTop: 0 }}>This will DELETE all moves after move {moveNumber}.</p>

          {hasFutureMoves ? (
            <p>
              Moves {firstDeleted}-{lastMove} will be permanently lost.
            </p>
          ) : (
            <p>No future moves will be deleted.</p>
          )}

          <p style={{ marginBottom: 0 }}>
            Practice Mode: Immediate effect
            <br />
            Multiplayer: Requires unanimous vote
          </p>
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            Resume from Here
          </button>
        </div>
      </div>
    </div>
  );
}
