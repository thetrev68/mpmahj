/**
 * @module UndoVotePanel
 *
 * Shows an undo request voting panel with per-player status (Requester/Approved/Denied/Pending)
 * and a countdown timer. The requester sees only a status display; other players see Approve/Deny buttons.
 * Panel is hidden when no request is active.
 *
 * Pairs with {@link src/components/game/UndoButton.tsx} (initiates undo request).
 *
 * @see {@link src/components/game/UndoButton.tsx} for undo request initiation
 */

import type { FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Seat } from '@/types/bindings/generated/Seat';

/**
 * Props for the UndoVotePanel component.
 *
 * @interface UndoVotePanelProps
 * @property {Object | null} undoRequest - Active undo request. Null hides the panel.
 *   @property {Seat} undoRequest.requester - Player who initiated the request.
 *   @property {number} undoRequest.target_move - Move number to undo to (1-indexed).
 * @property {Seat} currentSeat - Current player's seat (to determine if they're the requester).
 * @property {Seat[]} seats - All player seats in vote order.
 * @property {Partial<Record<Seat, boolean | null>>} votes - Vote map: Seat → true (approved),
 *   false (denied), null (pending), or undefined (not yet voted).
 * @property {(approve: boolean) => void} onVote - Callback fired when user votes. Called with true/false.
 * @property {number} [timeRemaining] - Seconds remaining to vote. Displays countdown; typically auto-hides after 0.
 */
interface UndoVotePanelProps {
  undoRequest: { requester: Seat; target_move: number } | null;
  currentSeat: Seat;
  seats: Seat[];
  votes: Partial<Record<Seat, boolean | null>>;
  onVote: (approve: boolean) => void;
  timeRemaining?: number;
}

export const UndoVotePanel: FC<UndoVotePanelProps> = ({
  undoRequest,
  currentSeat,
  seats,
  votes,
  onVote,
  timeRemaining,
}) => {
  if (!undoRequest) return null;

  const hasVoted = votes[currentSeat] !== null && votes[currentSeat] !== undefined;
  const isRequester = currentSeat === undoRequest.requester;
  const expired = typeof timeRemaining === 'number' && timeRemaining <= 0;
  const disableVoting = hasVoted || isRequester || expired;

  const renderVoteStatus = (seat: Seat) => {
    if (seat === undoRequest.requester) {
      return (
        <Badge variant="secondary" className="text-xs">
          Requester
        </Badge>
      );
    }

    const vote = votes[seat];
    if (vote === true) {
      return (
        <Badge variant="default" className="text-xs bg-emerald-600">
          Approved
        </Badge>
      );
    }
    if (vote === false) {
      return (
        <Badge variant="destructive" className="text-xs">
          Denied
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-xs">
        Pending
      </Badge>
    );
  };

  return (
    <Card
      className="fixed left-1/2 top-24 z-40 w-[360px] -translate-x-1/2 bg-black/90 text-white"
      data-testid="undo-vote-panel"
      role="alertdialog"
      aria-label="Undo vote panel"
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Undo Request</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div data-testid="undo-vote-summary">
          {undoRequest.requester} requested undo to move #{undoRequest.target_move}
        </div>
        <div className="space-y-1" data-testid="undo-vote-list">
          {seats.map((seat) => (
            <div key={seat} className="flex items-center justify-between">
              <span>{seat}</span>
              {renderVoteStatus(seat)}
            </div>
          ))}
        </div>
        <div className="text-xs text-slate-300" aria-live="polite" data-testid="undo-vote-timer">
          {typeof timeRemaining === 'number'
            ? `Time remaining: ${Math.max(0, timeRemaining)}s`
            : 'Time remaining: --'}
        </div>
        {isRequester ? (
          <div className="text-xs text-slate-300">Waiting for other players to vote...</div>
        ) : (
          <div className="flex gap-2">
            <Button
              onClick={() => onVote(true)}
              disabled={disableVoting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700"
              data-testid="undo-vote-approve"
              aria-label="Approve undo request"
            >
              Approve
            </Button>
            <Button
              onClick={() => onVote(false)}
              disabled={disableVoting}
              variant="destructive"
              className="flex-1"
              data-testid="undo-vote-deny"
              aria-label="Deny undo request"
            >
              Deny
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

UndoVotePanel.displayName = 'UndoVotePanel';
