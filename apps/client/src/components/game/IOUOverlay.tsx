/**
 * IOUOverlay Component
 *
 * Displays an overlay when all 4 players attempt full blind pass (3 tiles each)
 * during Charleston. Shows detection, player debts, and resolution summary.
 *
 * Related: US-004 (Charleston First Left - Blind Pass), AC-10
 */

import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Seat } from '@/types/bindings/generated/Seat';

interface IOUOverlayProps {
  /** Player debts from IOUDetected event */
  debts: Array<[Seat, number]>;
  /** Whether the IOU has been resolved */
  resolved: boolean;
  /** Resolution summary from IOUResolved event */
  summary?: string;
}

export const IOUOverlay: React.FC<IOUOverlayProps> = ({ debts, resolved, summary }) => {
  return (
    <div
      className={cn(
        'fixed inset-0 z-50 flex items-center justify-center',
        'bg-black/80 backdrop-blur-sm'
      )}
      data-testid="iou-overlay"
      role="alertdialog"
      aria-label="IOU Scenario"
      aria-modal="true"
    >
      <div className="bg-gray-900 border border-amber-500/50 rounded-xl px-8 py-6 max-w-md text-center shadow-2xl">
        <h2 className="text-xl font-bold text-amber-300 mb-4">IOU Scenario Detected!</h2>

        <p className="text-gray-300 text-sm mb-4">
          All 4 players attempted to blind pass 3 tiles. Per NMJL rules, IOU resolution is
          triggered.
        </p>

        {/* Debt list */}
        <div className="flex justify-center gap-4 mb-4">
          {debts.map(([seat, count]) => (
            <div key={seat} className="text-center">
              <div className="text-xs text-gray-400">{seat}</div>
              <div className="text-lg font-bold text-amber-200" data-testid={`iou-debt-${seat}`}>
                {count}
              </div>
            </div>
          ))}
        </div>

        {/* Resolving state */}
        {!resolved && (
          <div className="flex items-center justify-center gap-2 text-gray-300">
            <Loader2 className="h-4 w-4 animate-spin" data-testid="iou-resolving-spinner" />
            <span>Resolving IOU...</span>
          </div>
        )}

        {/* Resolved state */}
        {resolved && summary && (
          <div className="text-emerald-300 text-sm" data-testid="iou-summary">
            {summary}
          </div>
        )}
      </div>
    </div>
  );
};

IOUOverlay.displayName = 'IOUOverlay';
