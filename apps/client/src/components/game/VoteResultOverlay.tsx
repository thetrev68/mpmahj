/**
 * VoteResultOverlay Component
 *
 * Displays the Charleston vote result with 3-second auto-dismiss (US-005)
 *
 * Related: US-005 AC-10
 */

import React, { useEffect } from 'react';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';

export interface VoteResultOverlayProps {
  /** The vote result (Stop or Continue) */
  result: CharlestonVote;
  /** Called after 3 seconds to dismiss overlay */
  onDismiss: () => void;
}

/**
 * VoteResultOverlay shows vote result and auto-dismisses
 */
export const VoteResultOverlay: React.FC<VoteResultOverlayProps> = ({ result, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const isStop = result === 'Stop';

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      role="alert"
      aria-live="assertive"
    >
      <div
        className={`bg-gray-800 border-4 rounded-lg p-8 shadow-2xl max-w-md text-center ${
          isStop ? 'border-red-500' : 'border-green-500'
        }`}
      >
        {/* Result Title */}
        <h2 className={`text-3xl font-bold mb-4 ${isStop ? 'text-red-400' : 'text-green-400'}`}>
          {isStop ? 'Charleston STOPPED' : 'Charleston CONTINUES'}
        </h2>

        {/* Result Message */}
        <p className="text-lg text-gray-300">
          {isStop ? 'Main game starting...' : 'Second Charleston starting...'}
        </p>
      </div>
    </div>
  );
};

VoteResultOverlay.displayName = 'VoteResultOverlay';
