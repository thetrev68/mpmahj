/**
 * @module ForfeitConfirmationDialog
 *
 * Confirmation dialog for players forfeiting a game. Shows the point penalty and
 * allows an optional reason (e.g., connection issues). Game ends immediately upon confirmation.
 *
 * Typically triggered via a forfeit option in the game menu or action bar.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

/**
 * Props for the ForfeitConfirmationDialog component.
 *
 * @interface ForfeitConfirmationDialogProps
 * @property {boolean} isOpen - Whether the dialog is visible.
 * @property {boolean} isLoading - Whether a forfeit request is in flight (disables inputs/buttons).
 * @property {number} penaltyPoints - Point penalty for forfeiting (shown in warning text).
 * @property {string | null} reason - Optional reason text. Null or empty string if not set.
 * @property {(value: string | null) => void} onReasonChange - Callback when reason input changes.
 *   Called with null if input is empty, or the text value if non-empty.
 * @property {() => void} onConfirm - Callback fired when user clicks "Forfeit Game".
 * @property {() => void} onCancel - Callback fired when user clicks "Cancel" or closes dialog.
 */
interface ForfeitConfirmationDialogProps {
  isOpen: boolean;
  isLoading: boolean;
  penaltyPoints: number;
  reason: string | null;
  onReasonChange: (value: string | null) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ForfeitConfirmationDialog: React.FC<ForfeitConfirmationDialogProps> = ({
  isOpen,
  isLoading,
  penaltyPoints,
  reason,
  onReasonChange,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen}>
      <DialogContent
        data-testid="forfeit-confirmation-dialog"
        role="alertdialog"
        aria-describedby="forfeit-warning-text"
        aria-label="Forfeit game confirmation"
      >
        <DialogHeader>
          <DialogTitle>Forfeit game?</DialogTitle>
          <DialogDescription>
            Forfeit game? You will lose immediately with a -{penaltyPoints} point penalty.
          </DialogDescription>
        </DialogHeader>
        <p id="forfeit-warning-text" className="text-sm text-muted-foreground">
          The game will end immediately with you marked as the forfeiting player.
        </p>
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium" htmlFor="forfeit-reason-input">
            Reason
          </label>
          <Input
            id="forfeit-reason-input"
            aria-label="Reason"
            placeholder="Optional reason (e.g., Poor connection)"
            value={reason ?? ''}
            onChange={(e) => onReasonChange(e.target.value.length > 0 ? e.target.value : null)}
            disabled={isLoading}
          />
        </div>
        <DialogFooter>
          <Button onClick={onCancel} variant="outline" disabled={isLoading} className="flex-1">
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 bg-red-600 hover:bg-red-500 text-white"
            aria-label="Forfeit game now"
          >
            Forfeit Game
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

ForfeitConfirmationDialog.displayName = 'ForfeitConfirmationDialog';
