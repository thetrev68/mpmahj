/**
 * @module ResumeConfirmationDialog
 *
 * Confirmation dialog for resuming game play from a historical move state.
 * Shows warning about lost moves (moves after the resume point are deleted).
 * Used during history/replay browsing to transition from read-only to live play.
 *
 * Pairs with {@link src/components/game/HistoricalViewBanner.tsx} and
 * {@link src/components/game/HistoryPanel.tsx} for the history UI.
 *
 * @see {@link src/components/game/HistoricalViewBanner.tsx} for banner UI
 * @see {@link src/components/game/HistoryPanel.tsx} for history browsing
 */

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/**
 * Props for the ResumeConfirmationDialog component.
 *
 * @interface ResumeConfirmationDialogProps
 * @property {boolean} isOpen - Whether the dialog is visible.
 * @property {number} moveNumber - Move to resume from (1-indexed). Shown in title.
 * @property {number} currentMove - Current live move before resume. Used to calculate lost moves.
 * @property {boolean} isLoading - Whether a resume request is in flight (disables buttons).
 * @property {() => void} onConfirm - Callback fired when user clicks "Confirm Resume".
 *   Resume request should be sent to server to apply the state change.
 * @property {() => void} onCancel - Callback fired when user clicks "Cancel" or closes dialog.
 */
export interface ResumeConfirmationDialogProps {
  isOpen: boolean;
  moveNumber: number;
  currentMove: number;
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ResumeConfirmationDialog({
  isOpen,
  moveNumber,
  currentMove,
  isLoading,
  onConfirm,
  onCancel,
}: ResumeConfirmationDialogProps) {
  if (!isOpen) return null;
  const lostMoves = Math.max(0, currentMove - moveNumber);

  return (
    <Dialog open={isOpen}>
      <DialogContent
        role="alertdialog"
        aria-label={`Resume playing from move ${moveNumber}`}
        data-testid="resume-confirmation-dialog"
      >
        <DialogHeader>
          <DialogTitle>Resume Playing from Move #{moveNumber}?</DialogTitle>
          <DialogDescription>
            This will delete all moves after #{moveNumber} ({lostMoves} moves will be lost)
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Current move: #{currentMove} -&gt; New move: #{moveNumber}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} disabled={isLoading} data-testid="confirm-resume-button">
            Confirm Resume
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
