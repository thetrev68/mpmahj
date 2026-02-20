/**
 * CourtesyPassPanel Component
 *
 * Tile count selector for courtesy pass negotiation (0-3 tiles).
 * Related: US-007 (Courtesy Pass Negotiation), AC-2
 */

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Seat } from '@/types/bindings/generated/Seat';

interface CourtesyPassPanelProps {
  /** Callback when user proposes a tile count */
  onPropose: (count: number) => void;
  /** The seat of the across partner */
  acrossPartnerSeat: Seat;
  /** Whether waiting for partner's proposal */
  isPending?: boolean;
  /** User's proposed count (when isPending is true) */
  proposedCount?: number;
}

export function CourtesyPassPanel({
  onPropose,
  acrossPartnerSeat,
  isPending = false,
  proposedCount,
}: CourtesyPassPanelProps) {
  const counts = [0, 1, 2, 3] as const;

  return (
    <Card data-testid="courtesy-pass-panel" className="p-4 bg-slate-900/90 border-slate-700">
      <div className="space-y-4">
        {/* Instruction or waiting message */}
        {isPending && proposedCount !== undefined ? (
          <p className="text-sm text-slate-300 text-center">
            Proposed {proposedCount} tiles. Waiting for {acrossPartnerSeat}...
          </p>
        ) : (
          <p className="text-sm text-slate-300 text-center">
            Negotiate with {acrossPartnerSeat} - select 0-3 tiles
          </p>
        )}

        {/* Tile count buttons */}
        <div className="flex gap-2 justify-center">
          {counts.map((count) => (
            <Button
              key={count}
              data-testid={`courtesy-count-${count}`}
              onClick={() => onPropose(count)}
              disabled={isPending}
              variant={count === 0 ? 'outline' : 'default'}
              size="lg"
              className="min-w-[60px]"
            >
              {count === 0 ? 'Skip' : `${count}`}
            </Button>
          ))}
        </div>
      </div>
    </Card>
  );
}
