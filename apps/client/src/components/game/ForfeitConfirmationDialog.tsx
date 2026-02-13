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

export interface ForfeitConfirmationDialogProps {
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
