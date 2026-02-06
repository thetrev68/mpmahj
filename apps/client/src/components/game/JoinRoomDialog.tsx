/**
 * JoinRoomDialog Component
 *
 * Modal dialog for joining a room by invite code
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface JoinRoomDialogProps {
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

const CODE_LENGTH = 5;

const normalizeCode = (value: string) =>
  value
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '')
    .slice(0, CODE_LENGTH);

export function JoinRoomDialog({
  isOpen,
  code,
  isSubmitting = false,
  onCodeChange,
  onSubmit,
  onCancel,
}: JoinRoomDialogProps) {
  const normalizedCode = normalizeCode(code);
  const isCodeValid = normalizedCode.length === CODE_LENGTH;

  const handleSubmit = (event: React.FormEvent) => {
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
          <DialogDescription>
            Enter the 5-character invite code to join your room.
          </DialogDescription>
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
                  placeholder="ABCDE"
                  maxLength={CODE_LENGTH}
                  autoComplete="off"
                  disabled={isSubmitting}
                />
                {!isCodeValid && normalizedCode.length > 0 && (
                  <p className="text-sm text-destructive">Enter a 5-character invite code.</p>
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
