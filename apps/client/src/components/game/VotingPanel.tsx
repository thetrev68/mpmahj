/**
 * VotingPanel Component
 *
 * Displays voting interface for Charleston Stop/Continue decision (US-005)
 *
 * Related: US-005 AC-1 through AC-4
 */

import React, { useState } from 'react';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';

export interface VotingPanelProps {
  /** Called when user votes */
  onVote: (vote: CharlestonVote) => void;
  /** Whether voting is disabled (already voted) */
  disabled: boolean;
  /** Whether the user has voted */
  hasVoted?: boolean;
  /** The vote the user cast */
  myVote?: CharlestonVote;
  /** Number of players who have voted */
  voteCount?: number;
  /** Total number of players */
  totalPlayers?: number;
}

/**
 * VotingPanel shows Stop/Continue buttons and vote progress
 */
export const VotingPanel: React.FC<VotingPanelProps> = ({
  onVote,
  disabled,
  hasVoted = false,
  myVote,
  voteCount,
  totalPlayers = 4,
}) => {
  const [localDisabled, setLocalDisabled] = useState(false);

  const handleVote = (vote: CharlestonVote) => {
    setLocalDisabled(true);
    onVote(vote);
  };

  const isDisabled = disabled || localDisabled;

  return (
    <div
      className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-gray-800/95 border-2 border-yellow-500 rounded-lg p-6 shadow-2xl z-50 min-w-[400px]"
      role="dialog"
      aria-label="Charleston voting panel"
      data-testid="vote-panel"
    >
      <div className="text-center space-y-4">
        {/* Title */}
        <h2 className="text-2xl font-bold text-yellow-400">Vote: Stop or Continue?</h2>

        {/* Instructions (AC-1) */}
        {!hasVoted && (
          <p className="text-sm text-gray-300">Vote now - any Stop vote ends Charleston</p>
        )}

        {/* Vote status message (AC-2, AC-3, AC-4) */}
        {hasVoted && myVote && (
          <div className="text-center space-y-2">
            <p className="text-lg font-semibold text-green-400">
              {myVote === 'Stop'
                ? 'You voted to STOP. Waiting for other players...'
                : 'You voted to CONTINUE. Waiting for other players...'}
            </p>
          </div>
        )}

        {/* Vote progress (AC-4) */}
        {voteCount !== undefined && voteCount > 0 && (
          <p className="text-sm text-gray-400">
            {voteCount}/{totalPlayers} players voted
          </p>
        )}

        {/* Vote buttons (AC-2, AC-3) */}
        {!hasVoted && (
          <div className="flex gap-4 justify-center mt-6">
            <button
              onClick={() => handleVote('Stop')}
              disabled={isDisabled}
              className="px-6 py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors min-w-[140px]"
              aria-label="Stop Charleston"
              data-testid="vote-stop-button"
            >
              Stop Charleston
            </button>
            <button
              onClick={() => handleVote('Continue')}
              disabled={isDisabled}
              className="px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold rounded-lg transition-colors min-w-[140px]"
              aria-label="Continue Charleston"
              data-testid="vote-continue-button"
            >
              Continue Charleston
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

VotingPanel.displayName = 'VotingPanel';
