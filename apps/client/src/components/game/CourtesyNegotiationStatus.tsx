/**
 * CourtesyNegotiationStatus Component
 *
 * Displays the result of courtesy pass negotiation: agreement, mismatch, or zero.
 * Related: US-007 (Courtesy Pass Negotiation), AC-3, AC-4, AC-5
 */

import { Card } from '@/components/ui/card';
import type { Seat } from '@/types/bindings/generated/Seat';
import { cn } from '@/lib/utils';

interface CourtesyNegotiationStatusProps {
  /** Type of negotiation result */
  type: 'agreement' | 'mismatch' | 'zero';
  /** The agreed count (lower wins for mismatch) */
  agreedCount: number;
  /** The seat of the across partner */
  acrossPartnerSeat: Seat;
  /** My proposed count (for mismatch/zero) */
  myProposal?: number;
  /** Partner's proposed count (for mismatch/zero) */
  partnerProposal?: number;
}

export function CourtesyNegotiationStatus({
  type,
  agreedCount,
  acrossPartnerSeat,
  myProposal,
  partnerProposal,
}: CourtesyNegotiationStatusProps) {
  const borderColor = {
    agreement: 'border-green-500',
    mismatch: 'border-yellow-500',
    zero: 'border-slate-500',
  }[type];

  const tilePlural = agreedCount === 1 ? 'tile' : 'tiles';

  return (
    <Card
      data-testid="courtesy-negotiation-status"
      className={cn('p-3 bg-slate-800/80 border-2', borderColor)}
    >
      <div className="space-y-1">
        {type === 'agreement' && (
          <p className="text-sm text-green-400 text-center font-medium">
            Agreed to pass {agreedCount} {tilePlural} with {acrossPartnerSeat}
          </p>
        )}

        {type === 'mismatch' && myProposal !== undefined && partnerProposal !== undefined && (
          <>
            <p className="text-sm text-yellow-400 text-center font-medium">
              Mismatch! You proposed {myProposal}, {acrossPartnerSeat} proposed {partnerProposal}.
            </p>
            <p className="text-xs text-yellow-300 text-center">
              Agreed on {agreedCount} {tilePlural} (lower count wins)
            </p>
          </>
        )}

        {type === 'zero' && (
          <p className="text-sm text-slate-400 text-center">
            {myProposal === 0 && partnerProposal === 0
              ? `No courtesy pass with ${acrossPartnerSeat}`
              : myProposal === 0
                ? 'No courtesy pass (you proposed 0)'
                : partnerProposal === 0
                  ? `No courtesy pass (${acrossPartnerSeat} proposed 0)`
                  : `No courtesy pass with ${acrossPartnerSeat}`}
          </p>
        )}
      </div>
    </Card>
  );
}
