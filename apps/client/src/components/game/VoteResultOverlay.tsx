/**
 * VoteResultOverlay Component
 *
 * Displays the Charleston vote result with breakdown and 3-second auto-dismiss (US-005)
 *
 * Related: US-005 AC-10
 */

import { useEffect, type FC } from 'react';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';
import type { Seat } from '@/types/bindings/generated/Seat';

interface VoteResultOverlayProps {
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
export const VoteResultOverlay: FC<VoteResultOverlayProps> = ({
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

  const seatOrder: Seat[] = ['East', 'South', 'West', 'North'];
  const voteEntries = votes
    ? seatOrder.flatMap((seat) => (votes[seat] ? [[seat, votes[seat]]] : []))
    : [];
  const hasVotes = voteEntries.length > 0;
  const stopCount = voteEntries.filter(([, vote]) => vote === 'Stop').length;
  const continueCount = voteEntries.filter(([, vote]) => vote === 'Continue').length;

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
          {hasVotes ? (
            <>
              <p className="text-sm text-gray-300" data-testid="vote-breakdown-counts">
                {stopCount} Stop, {continueCount} Continue
              </p>
              {voteEntries.length < 4 && (
                <p className="text-xs text-gray-400" data-testid="vote-breakdown-partial">
                  Votes reported: {voteEntries.length}/4
                </p>
              )}
              <div className="text-xs text-gray-400 grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                {voteEntries.map(([seat, vote]) => (
                  <div key={seat} className="flex justify-between">
                    <span>{seat}:</span>
                    <span className={vote === 'Stop' ? 'text-red-400' : 'text-green-400'}>
                      {vote}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-gray-300" data-testid="vote-breakdown-unavailable">
              Vote breakdown unavailable
            </p>
          )}

          {/* Show user's own vote if votes breakdown is missing */}
          {!hasVotes && myVote && (
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
