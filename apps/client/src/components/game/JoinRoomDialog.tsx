/**
 * JoinRoomDialog Component
 *
 * Modal dialog for joining a room by invite code
 */

import type { FormEvent } from 'react';
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
import { Label } from '@/components/ui/label';

interface JoinRoomDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Current invite code input value */
  code: string;
  /** Whether a join request is in progress */
  isSubmitting?: boolean;
  /** Called when the invite code changes */
  onCodeChange: (code: string) => void;
  /** Called when user submits the form */
  onSubmit: (code: string) => void;
  /** Called when dialog is closed */
  onCancel: () => void;
}

const MIN_CODE_LENGTH = 5;
const MAX_CODE_LENGTH = 64;

const normalizeCode = (value: string) =>
  value
    .trim()
    .replace(/[^0-9A-Za-z-]/g, '')
    .slice(0, MAX_CODE_LENGTH);

export function JoinRoomDialog({
  isOpen,
  code,
  isSubmitting = false,
  onCodeChange,
  onSubmit,
  onCancel,
}: JoinRoomDialogProps) {
  const normalizedCode = normalizeCode(code);
  const isCodeValid = normalizedCode.length >= MIN_CODE_LENGTH;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!isCodeValid) {
      return;
    }
    onSubmit(normalizedCode);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Join Room</DialogTitle>
          <DialogDescription>Enter the invite code to join your room.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="join-code" className="text-right">
                Code
              </Label>
              <div className="col-span-3 space-y-1">
                <Input
                  id="join-code"
                  value={normalizedCode}
                  onChange={(event) => onCodeChange(normalizeCode(event.target.value))}
                  placeholder="Room code"
                  maxLength={MAX_CODE_LENGTH}
                  autoComplete="off"
                  disabled={isSubmitting}
                />
                {!isCodeValid && normalizedCode.length > 0 && (
                  <p className="text-sm text-destructive">Enter a valid room code.</p>
                )}
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !isCodeValid}>
              {isSubmitting ? 'Joining...' : 'Join'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
