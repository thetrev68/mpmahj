/**
 * @module LeaveConfirmationDialog
 *
 * Confirmation dialog for players leaving a game. Shows a warning that the player
 * will be marked disconnected and a bot will take over. Emphasizes consequences
 * if leaving during a critical phase (active turn).
 *
 * Typically triggered via a leave button/menu option in the UI.
 */

import type { FC } from 'react';
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
 * Props for the LeaveConfirmationDialog component.
 *
 * @interface LeaveConfirmationDialogProps
 * @property {boolean} isOpen - Whether the dialog is visible.
 * @property {boolean} isLoading - Whether a leave request is in flight (disables buttons).
 * @property {boolean} isCriticalPhase - True when player has an active turn (Charleston, discard, call).
 *   Shows an additional warning message.
 * @property {() => void} onConfirm - Callback fired when user clicks "Leave Game".
 * @property {() => void} onCancel - Callback fired when user clicks "Cancel" or closes dialog.
 */
interface LeaveConfirmationDialogProps {
  isOpen: boolean;
  isLoading: boolean;
  isCriticalPhase: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const LeaveConfirmationDialog: FC<LeaveConfirmationDialogProps> = ({
  isOpen,
  isLoading,
  isCriticalPhase,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen}>
      <DialogContent
        data-testid="leave-confirmation-dialog"
        role="alertdialog"
        aria-describedby="leave-warning-text"
        aria-label="Leave game confirmation"
      >
        <DialogHeader>
          <DialogTitle>Leave game?</DialogTitle>
          <DialogDescription>
            Leave game? You will be marked disconnected and returned to the lobby.
          </DialogDescription>
        </DialogHeader>
        <p id="leave-warning-text" className="text-sm text-muted-foreground">
          Your seat will be marked disconnected. A bot will take over play from your seat.
        </p>
        {isCriticalPhase && (
          <p className="text-sm font-semibold text-yellow-700 dark:text-yellow-300">
            Leaving now will forfeit your current action. You will be marked disconnected.
          </p>
        )}
        <DialogFooter>
          <Button onClick={onCancel} variant="outline" disabled={isLoading} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white"
            aria-label="Leave game now"
          >
            Leave Game
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

LeaveConfirmationDialog.displayName = 'LeaveConfirmationDialog';
