/**
 * UpgradeConfirmationDialog Component (US-016)
 *
 * Modal dialog that confirms upgrading an exposed meld (Pung→Kong, Kong→Quint, etc.)
 * by adding a tile from the player's hand.
 *
 * Related: US-016 (Upgrading Meld)
 */

import { useEffect, type FC } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Loader2 } from 'lucide-react';
import { getTileName } from '@/lib/utils/tileUtils';
import type { MeldType } from '@/types/bindings/generated/MeldType';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

interface UpgradeConfirmationDialogProps {
  /** Whether the dialog is open */
  isOpen: boolean;
  /** Current meld type (e.g. "Pung") */
  meldType: MeldType;
  /** Meld type after upgrade (e.g. "Kong") */
  upgrade: MeldType;
  /** The tile from hand being added to the meld */
  tile: Tile;
  /** Index of the meld in exposed_melds array */
  meldIndex: number;
  /** The player performing the upgrade */
  mySeat: Seat;
  /** Whether the AddToExposure command is in-flight */
  isLoading: boolean;
  /** Called with the AddToExposure command when confirmed */
  onConfirm: (command: GameCommand) => void;
  /** Called when the user cancels */
  onCancel: () => void;
}

export const UpgradeConfirmationDialog: FC<UpgradeConfirmationDialogProps> = ({
  isOpen,
  meldType,
  upgrade,
  tile,
  meldIndex,
  mySeat,
  isLoading,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
        return;
      }
      if (e.key === 'Enter' && !isLoading) {
        e.preventDefault();
        onConfirm({ AddToExposure: { player: mySeat, meld_index: meldIndex, tile } });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, mySeat, meldIndex, tile, onConfirm, onCancel]);

  if (!isOpen) return null;

  const tileName = getTileName(tile);

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent
        className="flex max-w-[420px] flex-col gap-4 rounded-2xl border border-blue-500/50 bg-gray-900 px-8 py-6 shadow-2xl [&>button]:hidden"
        data-testid="upgrade-confirmation-dialog"
        role="dialog"
        aria-modal="true"
      >
        <DialogTitle
          className="text-xl font-bold text-blue-300 text-center"
          data-testid="upgrade-dialog-title"
        >
          Upgrade {meldType} to {upgrade}
        </DialogTitle>

        <DialogDescription className="text-center text-sm text-gray-300">
          Add your <span className="text-white font-semibold">{tileName}</span> to upgrade your{' '}
          {meldType} to a {upgrade}?
        </DialogDescription>

        {/* Screen reader announcement */}
        <p className="sr-only" aria-live="polite">
          Upgrade {meldType} to {upgrade} with your {tileName}.
        </p>

        <div className="flex flex-col gap-3 mt-2">
          <Button
            onClick={() =>
              onConfirm({ AddToExposure: { player: mySeat, meld_index: meldIndex, tile } })
            }
            disabled={isLoading}
            className="w-full bg-blue-600 hover:bg-blue-500 font-bold"
            data-testid="upgrade-confirm-button"
            aria-label={`Confirm upgrade ${meldType} to ${upgrade}`}
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Upgrading...
              </span>
            ) : (
              `Confirm Upgrade`
            )}
          </Button>

          <Button
            onClick={onCancel}
            variant="outline"
            disabled={isLoading}
            className="w-full"
            data-testid="upgrade-cancel-button"
            aria-label="Cancel upgrade"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

UpgradeConfirmationDialog.displayName = 'UpgradeConfirmationDialog';
