/**
 * @module ForfeitConfirmationDialog
 *
 * Confirmation dialog for players forfeiting a game. Shows the point penalty and
 * allows an optional reason (e.g., connection issues). Game ends immediately upon confirmation.
 *
 * Typically triggered via a forfeit option in the game menu or action bar.
 */

import type { FC } from 'react';
import { Input } from '@/components/ui/input';
import { ConfirmationDialog } from './ConfirmationDialog';

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

export const ForfeitConfirmationDialog: FC<ForfeitConfirmationDialogProps> = ({
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
    <ConfirmationDialog
      isOpen={isOpen}
      isLoading={isLoading}
      title="Forfeit game?"
      description={`Forfeit game? You will lose immediately with a -${penaltyPoints} point penalty.`}
      confirmLabel="Forfeit Game"
      onConfirm={onConfirm}
      onCancel={onCancel}
      testId="forfeit-confirmation-dialog"
      ariaLabel="Forfeit game confirmation"
      ariaDescribedBy="forfeit-warning-text"
      confirmButtonAriaLabel="Forfeit game now"
      confirmButtonClassName="flex-1 bg-red-600 hover:bg-red-500 text-white"
      cancelButtonClassName="flex-1"
    >
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
    </ConfirmationDialog>
  );
};

ForfeitConfirmationDialog.displayName = 'ForfeitConfirmationDialog';
