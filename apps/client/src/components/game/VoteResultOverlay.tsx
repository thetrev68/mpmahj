/**
 * VoteResultOverlay Component
 *
 * Displays the Charleston vote result with breakdown and 3-second auto-dismiss (US-005)
 *
 * Related: US-005 AC-10
 */

import React, { useEffect } from 'react';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';
import type { Seat } from '@/types/bindings/generated/Seat';

export interface VoteResultOverlayProps {
  /** The vote result (Stop or Continue) */
  result: CharlestonVote;
  /** Individual votes by seat */
  votes?: Record<Seat, CharlestonVote>;
  /** Called after 3 seconds to dismiss overlay */
  onDismiss: () => void;
  /** The user's own vote */
  myVote?: CharlestonVote;
}

/**
 * VoteResultOverlay shows vote result with breakdown and auto-dismisses
 */
export const VoteResultOverlay: React.FC<VoteResultOverlayProps> = ({
  result,
  votes,
  onDismiss,
  myVote,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss();
    }, 3000);

    return () => clearTimeout(timer);
  }, [onDismiss]);

  const isStop = result === 'Stop';

  // Calculate counts if votes are provided
  const stopCount = votes ? Object.values(votes).filter((v) => v === 'Stop').length : (isStop ? 1 : 0);
  const continueCount = votes ? Object.values(votes).filter((v) => v === 'Continue').length : (isStop ? 3 : 4);

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
          <p className="text-sm text-gray-300" data-testid="vote-breakdown-counts">
            {stopCount} Stop, {continueCount} Continue
          </p>

          {/* Seat-by-seat breakdown */}
          {votes && (
            <div className="text-xs text-gray-400 grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
              {Object.entries(votes).map(([seat, vote]) => (
                <div key={seat} className="flex justify-between">
                  <span>{seat}:</span>
                  <span className={vote === 'Stop' ? 'text-red-400' : 'text-green-400'}>
                    {vote}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Show user's own vote if votes breakdown is missing */}
          {!votes && myVote && (
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
