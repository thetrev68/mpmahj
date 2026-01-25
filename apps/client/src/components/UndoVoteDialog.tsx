import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import { useCommandSender } from '@/utils/commands';
import { useUndoState } from '@/hooks/useUndoState';
import { useUIStore } from '@/store/uiStore';
import './JokerExchangeDialog.css';
import './UndoVoteDialog.css';

export function UndoVoteDialog({
  sendCommand,
}: {
  sendCommand: (command: GameCommand) => boolean;
}) {
  const { pendingRequest, yourSeat, seats } = useUndoState();
  const addError = useUIStore((state) => state.addError);
  const { voteUndo } = useCommandSender();

  if (!pendingRequest || !yourSeat) {
    return null;
  }

  if (pendingRequest.requestedBy === yourSeat) {
    return null;
  }

  const alreadyVoted =
    pendingRequest.votes[yourSeat] === true || pendingRequest.votes[yourSeat] === false;

  const approvals = seats.filter((seat) => pendingRequest.votes[seat] === true).length;
  const totalSeats = seats.length;

  const handleVote = (approve: boolean) => {
    if (alreadyVoted) return;
    const result = voteUndo(approve);
    if (!result.command) {
      addError(result.error || 'Unable to submit vote');
      return;
    }
    sendCommand(result.command);
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog undo-vote-dialog">
        <div className="dialog-header">
          <h3>Undo Request</h3>
        </div>
        <div className="dialog-body">
          <p>
            <strong>{pendingRequest.requestedBy}</strong> wants to undo:
          </p>
          <p className="undo-action">"{pendingRequest.action}"</p>
          <p>This will rewind the game to before this action.</p>

          <div className="undo-vote-actions">
            <button
              className="btn btn-primary"
              onClick={() => handleVote(true)}
              disabled={alreadyVoted}
            >
              Approve
            </button>
            <button
              className="btn btn-secondary"
              onClick={() => handleVote(false)}
              disabled={alreadyVoted}
            >
              Decline
            </button>
          </div>

          <div className="undo-vote-progress">
            Waiting for votes: {approvals}/{totalSeats} approved
          </div>

          <div className="undo-votes">
            {seats.map((seat) => {
              const vote = pendingRequest.votes[seat];
              const status = vote === true ? 'Y' : vote === false ? 'N' : '?';
              return (
                <div key={seat} className="undo-vote-item">
                  <span className="undo-vote-seat">{seat}</span>
                  <span className="undo-vote-status">{status}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
