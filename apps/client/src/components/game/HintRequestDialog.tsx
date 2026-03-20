import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface HintRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestHint: () => void;
  hintsEnabled: boolean;
}

export function HintRequestDialog({
  open,
  onOpenChange,
  onRequestHint,
  hintsEnabled,
}: HintRequestDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="hint-request-dialog">
        <DialogHeader>
          <DialogTitle>Request AI Hint</DialogTitle>
          <DialogDescription>Request an AI analysis for the current board state.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Button
            onClick={onRequestHint}
            disabled={!hintsEnabled}
            data-testid="request-analysis-button"
          >
            Request Analysis
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
