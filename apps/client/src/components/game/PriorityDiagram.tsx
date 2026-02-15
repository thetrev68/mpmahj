/**
 * PriorityDiagram Component
 *
 * Visualizes clockwise call priority from the discarder.
 * Highlights the winning seat and (optionally) tied contenders.
 *
 * Related: US-012 (Call Priority Resolution)
 */

import { Fragment, useMemo, type FC } from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { Seat } from '@/types/bindings/generated/Seat';

interface PriorityDiagramProps {
  /** Seat that discarded the tile */
  discardedBy: Seat;
  /** Seat that won the call */
  winner: Seat;
  /** Optional tied contenders (ordered by seat priority) */
  contenders?: Seat[];
}

const SEAT_ORDER: Seat[] = ['East', 'South', 'West', 'North'];

function getPriorityOrder(discardedBy: Seat): Seat[] {
  const startIndex = SEAT_ORDER.indexOf(discardedBy);
  const order: Seat[] = [];
  for (let i = 1; i <= 3; i += 1) {
    order.push(SEAT_ORDER[(startIndex + i) % SEAT_ORDER.length]);
  }
  return order;
}

/**
 * PriorityDiagram renders a compact priority order view.
 */
export const PriorityDiagram: FC<PriorityDiagramProps> = ({
  discardedBy,
  winner,
  contenders,
}) => {
  const priorityOrder = useMemo(() => getPriorityOrder(discardedBy), [discardedBy]);
  const contenderSet = useMemo(() => new Set(contenders ?? []), [contenders]);

  return (
    <div
      className="bg-slate-50 border border-slate-200 rounded-md p-3 mb-4 text-sm"
      data-testid="priority-diagram"
      role="note"
      aria-label="Call priority order"
    >
      <div className="font-semibold text-slate-800 mb-2">Priority Diagram</div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-slate-600">Discarder:</span>
        <Badge
          className="bg-slate-200 text-slate-800"
          data-testid="priority-discarder"
          data-discarder="true"
        >
          {discardedBy}
        </Badge>
      </div>

      <div className="mt-2">
        <div className="text-slate-600 mb-1">Priority order (clockwise):</div>
        <div className="flex items-center gap-2 flex-wrap">
          {priorityOrder.map((seat, index) => {
            const isWinner = seat === winner;
            const isContender = contenderSet.has(seat);
            return (
              <Fragment key={`priority-${seat}`}>
                <Badge
                  className={cn(
                    'px-2 py-1',
                    isWinner
                      ? 'bg-green-600 text-white'
                      : isContender
                        ? 'bg-amber-100 text-amber-900 border border-amber-300'
                        : 'bg-slate-100 text-slate-800'
                  )}
                  data-testid={`priority-seat-${seat.toLowerCase()}`}
                  data-winner={isWinner ? 'true' : 'false'}
                  data-contender={isContender ? 'true' : 'false'}
                >
                  {seat}
                  {isWinner && ' (winner)'}
                </Badge>
                {index < priorityOrder.length - 1 && (
                  <span className="text-slate-400" aria-hidden="true">
                    -&gt;
                  </span>
                )}
              </Fragment>
            );
          })}
        </div>
      </div>

      {contenders && contenders.length > 0 && (
        <div className="mt-2 text-xs text-slate-500" data-testid="priority-contenders">
          Contenders: {contenders.join(', ')}
        </div>
      )}
    </div>
  );
};

PriorityDiagram.displayName = 'PriorityDiagram';
