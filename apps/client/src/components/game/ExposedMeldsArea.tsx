/**
 * ExposedMeldsArea Component
 *
 * Container for displaying all exposed melds for a player.
 * Shows melds in order of exposure, left to right.
 *
 * Related: US-013 (Calling Pung/Kong/Quint/Sextet)
 */

import type { FC } from 'react';
import { MeldDisplay } from './MeldDisplay';
import { cn } from '@/lib/utils';
import type { Meld } from '@/types/bindings/generated/Meld';
import type { Seat } from '@/types/bindings/generated/Seat';

interface ExposedMeldsAreaProps {
  /** Array of exposed melds */
  melds: Array<Meld & { called_from?: Seat }>;
  /** Display melds in compact mode */
  compact?: boolean;
  /** Seat that owns these melds */
  ownerSeat?: Seat;
  /** Indices of melds that can be upgraded (US-016) */
  upgradeableMeldIndices?: number[];
  /** Called with the meld index when a meld is clicked (US-016) */
  onMeldClick?: (meldIndex: number) => void;
  /** Per-meld lookup of exchangeable Joker positions */
  exchangeableJokersByMeld?: Record<number, number[]>;
  /** Called when an exchangeable Joker tile is clicked */
  onJokerTileClick?: (meldIndex: number, tilePosition: number) => void;
}

export const ExposedMeldsArea: FC<ExposedMeldsAreaProps> = ({
  melds,
  compact = false,
  ownerSeat,
  upgradeableMeldIndices = [],
  onMeldClick,
  exchangeableJokersByMeld = {},
  onJokerTileClick,
}) => {
  const isEmpty = melds.length === 0;

  const ariaLabel = isEmpty
    ? 'Exposed melds'
    : `${melds.length} exposed meld${melds.length === 1 ? '' : 's'}`;

  return (
    <div
      className={cn(
        'flex items-center gap-4 p-3 bg-green-900/30 rounded-lg border border-green-700/30',
        isEmpty && 'justify-center min-h-[100px]'
      )}
      data-testid="exposed-melds-area"
      data-compact={compact}
      role="region"
      aria-label={ariaLabel}
    >
      {isEmpty ? (
        <div className="text-sm text-white/50 italic">No exposed melds</div>
      ) : (
        melds.map((meld, index) => {
          const isUpgradeable = upgradeableMeldIndices.includes(index);
          return (
            <div
              key={`meld-${index}`}
              className={cn(
                'relative',
                isUpgradeable &&
                  'cursor-pointer rounded-lg ring-2 ring-blue-400 ring-offset-1 ring-offset-transparent motion-safe:animate-pulse'
              )}
              data-testid={`meld-upgrade-wrapper-${index}`}
              data-upgradeable={isUpgradeable ? 'true' : undefined}
              onClick={() => isUpgradeable && onMeldClick?.(index)}
              role={isUpgradeable ? 'button' : undefined}
              aria-label={
                isUpgradeable ? `Upgradeable ${meld.meld_type} — click to upgrade` : undefined
              }
              tabIndex={isUpgradeable ? 0 : undefined}
              onKeyDown={
                isUpgradeable
                  ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onMeldClick?.(index);
                      }
                    }
                  : undefined
              }
            >
              {isUpgradeable && (
                <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-xs text-blue-300 whitespace-nowrap pointer-events-none">
                  Click to upgrade
                </span>
              )}
              <MeldDisplay
                meld={meld}
                compact={compact}
                ownerSeat={ownerSeat}
                exchangeableTilePositions={exchangeableJokersByMeld[index] ?? []}
                onJokerTileClick={
                  onJokerTileClick
                    ? (tilePosition) => onJokerTileClick(index, tilePosition)
                    : undefined
                }
              />
            </div>
          );
        })
      )}
    </div>
  );
};

ExposedMeldsArea.displayName = 'ExposedMeldsArea';
