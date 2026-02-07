/**
 * VoteResultOverlay Component
 *
 * Displays the Charleston vote result with breakdown and 3-second auto-dismiss (US-005)
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
  /** The user's own vote */
  myVote?: CharlestonVote;
  /** Total players who voted */
  totalVoters?: number;
}

/**
 * Derive vote breakdown from the result.
 * - If Continue: all 4 must have voted Continue (unanimous required)
 * - If Stop: at least 1 voted Stop
 */
function getBreakdown(
  result: CharlestonVote,
  totalVoters: number
): { stopCount: number; continueCount: number } {
  if (result === 'Continue') {
    return { stopCount: 0, continueCount: totalVoters };
  }
  // For Stop, we know at least 1 voted Stop but can't determine exact count
  // without backend data. Show minimum known.
  return { stopCount: -1, continueCount: -1 };
}

/**
 * VoteResultOverlay shows vote result with breakdown and auto-dismisses
 */
export const VoteResultOverlay: React.FC<VoteResultOverlayProps> = ({
  result,
  onDismiss,
  myVote,
  totalVoters = 4,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const isStop = result === 'Stop';
  const breakdown = getBreakdown(result, totalVoters);
  const hasExactBreakdown = breakdown.stopCount >= 0;

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      role="alert"
      aria-live="assertive"
      data-testid="vote-result-overlay"
    >
      <div
        className={`bg-gray-800 border-4 rounded-lg p-8 shadow-2xl max-w-md text-center ${
          isStop ? 'border-red-500' : 'border-green-500'
        }`}
      >
        {/* Result Title */}
        <h2
          className={`text-3xl font-bold mb-4 ${isStop ? 'text-red-400' : 'text-green-400'}`}
          data-testid="vote-result-title"
        >
          {isStop ? 'Charleston STOPPED' : 'Charleston CONTINUES'}
        </h2>

        {/* Vote breakdown (AC-10) */}
        <div className="mb-4 space-y-2" data-testid="vote-breakdown">
          {hasExactBreakdown ? (
            <p className="text-sm text-gray-300" data-testid="vote-breakdown-counts">
              {breakdown.stopCount} Stop, {breakdown.continueCount} Continue
            </p>
          ) : (
            <p className="text-sm text-gray-300" data-testid="vote-breakdown-counts">
              Charleston STOPPED by vote
            </p>
          )}

          {/* Show user's own vote */}
          {myVote && (
            <p className="text-xs text-gray-400" data-testid="vote-my-vote">
              You voted: {myVote}
            </p>
          )}
        </div>

        {/* Result Message */}
        <p className="text-lg text-gray-300" data-testid="vote-result-message">
          {isStop ? 'Main game starting...' : 'Second Charleston starting...'}
        </p>
      </div>
    </div>
  );
};

VoteResultOverlay.displayName = 'VoteResultOverlay';
