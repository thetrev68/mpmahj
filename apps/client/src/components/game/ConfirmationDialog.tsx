import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ConfirmationDialogProps {
  isOpen: boolean;
  isLoading: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  testId?: string;
  role?: 'alertdialog' | 'dialog';
  ariaLabel?: string;
  ariaDescribedBy?: string;
  confirmButtonAriaLabel?: string;
  confirmButtonClassName?: string;
  cancelButtonClassName?: string;
  confirmButtonTestId?: string;
  cancelButtonTestId?: string;
  children?: ReactNode;
}

export function ConfirmationDialog({
  isOpen,
  isLoading,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  testId,
  role = 'alertdialog',
  ariaLabel,
  ariaDescribedBy,
  confirmButtonAriaLabel,
  confirmButtonClassName,
  cancelButtonClassName,
  confirmButtonTestId,
  cancelButtonTestId,
  children,
}: ConfirmationDialogProps) {
  if (!isOpen) return null;

  return (
    <Dialog open={isOpen}>
      <DialogContent
        data-testid={testId}
        role={role}
        aria-describedby={ariaDescribedBy}
        aria-label={ariaLabel}
      >
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {children}
        <DialogFooter>
          <Button
            onClick={onCancel}
            variant="outline"
            disabled={isLoading}
            data-testid={cancelButtonTestId}
            className={cancelButtonClassName}
          >
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            aria-label={confirmButtonAriaLabel}
            className={confirmButtonClassName}
            data-testid={confirmButtonTestId}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

ConfirmationDialog.displayName = 'ConfirmationDialog';
