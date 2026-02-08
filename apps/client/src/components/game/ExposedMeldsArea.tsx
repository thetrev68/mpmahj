/**
 * ExposedMeldsArea Component
 *
 * Container for displaying all exposed melds for a player.
 * Shows melds in order of exposure, left to right.
 *
 * Related: US-013 (Calling Pung/Kong/Quint/Sextet)
 */

import React from 'react';
import { MeldDisplay } from './MeldDisplay';
import { cn } from '@/lib/utils';
import type { Meld } from '@/types/bindings/generated/Meld';
import type { Seat } from '@/types/bindings/generated/Seat';

export interface ExposedMeldsAreaProps {
  /** Array of exposed melds */
  melds: Array<Meld & { called_from?: Seat }>;
  /** Display melds in compact mode */
  compact?: boolean;
  /** Seat that owns these melds */
  ownerSeat?: Seat;
}

export const ExposedMeldsArea: React.FC<ExposedMeldsAreaProps> = ({
  melds,
  compact = false,
  ownerSeat,
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
        melds.map((meld, index) => (
          <MeldDisplay key={`meld-${index}`} meld={meld} compact={compact} ownerSeat={ownerSeat} />
        ))
      )}
    </div>
  );
};

ExposedMeldsArea.displayName = 'ExposedMeldsArea';
