import { useEffect, type FC } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { getTileName } from '@/lib/utils/tileUtils';
import type { ExchangeOpportunity } from '@/types/game/exchange';

interface JokerExchangeConfirmDialogProps {
  isOpen: boolean;
  opportunity: ExchangeOpportunity | null;
  isLoading: boolean;
  inlineError?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

export const JokerExchangeConfirmDialog: FC<JokerExchangeConfirmDialogProps> = ({
  isOpen,
  opportunity,
  isLoading,
  inlineError = null,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen || opportunity === null) {
    return null;
  }

  const tileName = getTileName(opportunity.representedTile);

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        className="flex max-w-[420px] flex-col gap-4 rounded-2xl border border-yellow-500/50 bg-gray-900 px-8 py-6 shadow-2xl [&>button]:hidden"
        data-testid="joker-exchange-confirm-dialog"
        role="dialog"
        aria-modal="true"
      >
        <DialogTitle className="text-xl font-bold text-yellow-300 text-center">
          Exchange Joker?
        </DialogTitle>
        <DialogDescription className="text-center text-sm text-gray-300">
          Exchange {tileName} with Joker from {opportunity.targetSeat}?
        </DialogDescription>

        {inlineError ? (
          <p
            className="rounded-md border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-200"
            data-testid="joker-exchange-inline-error"
            role="alert"
          >
            {inlineError}
          </p>
        ) : null}

        <div className="flex flex-col gap-3">
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="w-full bg-yellow-500 text-black hover:bg-yellow-400"
            aria-label={isLoading ? 'Exchanging' : 'Yes'}
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Exchanging...
              </span>
            ) : (
              'Yes'
            )}
          </Button>
          <Button onClick={onCancel} disabled={isLoading} variant="outline" className="w-full">
            No
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

JokerExchangeConfirmDialog.displayName = 'JokerExchangeConfirmDialog';
