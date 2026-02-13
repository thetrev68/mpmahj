import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
