/**
 * VotingPanel Component
 *
 * Displays voting interface for Charleston Stop/Continue decision (US-005)
 *
 * Related: US-005 AC-1 through AC-4, AC-9
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';
import type { Seat } from '@/types/bindings/generated/Seat';

interface VotingPanelProps {
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
  /** Seats that have voted (AC-4 per-player indicators) */
  votedPlayers?: Seat[];
  /** All player seats in order */
  allPlayers?: Array<{ seat: Seat; is_bot: boolean }>;
  /** Bot vote status message (AC-9) */
  botVoteMessage?: string;
}

const SEAT_ORDER: Seat[] = ['East', 'South', 'West', 'North'];

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
  votedPlayers = [],
  allPlayers = [],
  botVoteMessage,
}) => {
  const [localDisabled, setLocalDisabled] = useState(false);
  const [clickedVote, setClickedVote] = useState<CharlestonVote | null>(null);

  const handleVote = (vote: CharlestonVote) => {
    setLocalDisabled(true);
    setClickedVote(vote);
    onVote(vote);
  };

  const isDisabled = disabled || localDisabled;
  const votedSet = new Set(votedPlayers);

  // Compute "Waiting for [PlayerName]..." message (AC-4)
  const waitingSeats = SEAT_ORDER.filter((seat) => !votedSet.has(seat));
  const waitingMessage =
    hasVoted && waitingSeats.length > 0 ? `Waiting for ${waitingSeats.join(', ')}...` : undefined;

  return (
    <Dialog open>
      <DialogContent
        className="min-w-[400px] rounded-lg border-2 border-yellow-500 bg-gray-800/95 p-6 shadow-2xl [&>button]:hidden"
        role="dialog"
        aria-label="Charleston voting panel"
        data-testid="vote-panel"
      >
        <div className="space-y-4 text-center">
          {/* Title */}
          <h2 className="text-2xl font-bold text-yellow-400">Vote: Stop or Continue?</h2>

          {/* Instructions (AC-1) */}
          {!hasVoted && (
            <p className="text-sm text-gray-300">Vote now - any Stop vote ends Charleston</p>
          )}

          {/* Vote status message (AC-2, AC-3) */}
          {hasVoted && myVote && (
            <div className="text-center space-y-2">
              <p className="text-lg font-semibold text-green-400" data-testid="vote-status-message">
                {myVote === 'Stop'
                  ? 'You voted to STOP. Waiting for other players...'
                  : 'You voted to CONTINUE. Waiting for other players...'}
              </p>
            </div>
          )}

          {/* Vote progress (AC-4) */}
          {voteCount !== undefined && voteCount > 0 && (
            <p className="text-sm text-gray-400" data-testid="vote-progress">
              {voteCount}/{totalPlayers} players voted
            </p>
          )}

          {/* Per-player vote indicators (AC-4) */}
          {(allPlayers.length > 0 || votedPlayers.length > 0) && (
            <div
              className="flex items-center justify-center gap-3 text-xs text-gray-300"
              data-testid="vote-indicators"
            >
              {SEAT_ORDER.map((seat) => {
                const hasVotedSeat = votedSet.has(seat);
                return (
                  <span
                    key={seat}
                    className={`flex items-center gap-1 ${hasVotedSeat ? 'text-emerald-300' : ''}`}
                    data-testid={`vote-indicator-${seat.toLowerCase()}`}
                    aria-label={`${seat} ${hasVotedSeat ? 'voted' : 'waiting'}`}
                  >
                    <span>{seat}</span>
                    <span>{hasVotedSeat ? '\u2713' : '\u2022'}</span>
                  </span>
                );
              })}
            </div>
          )}

          {/* Waiting for specific player (AC-4) */}
          {waitingMessage && (
            <p className="text-sm text-gray-400 italic" data-testid="vote-waiting-message">
              {waitingMessage}
            </p>
          )}

          {/* Bot vote message (AC-9) */}
          {botVoteMessage && (
            <p
              className="text-sm text-emerald-200"
              data-testid="bot-vote-message"
              aria-live="polite"
            >
              {botVoteMessage}
            </p>
          )}

          {/* Vote buttons (AC-2, AC-3) with loading spinner */}
          {!hasVoted && (
            <div className="flex gap-4 justify-center mt-6">
              <Button
                onClick={() => handleVote('Stop')}
                disabled={isDisabled}
                className="min-w-[140px] bg-red-600 px-6 py-3 font-bold text-white hover:bg-red-700"
                aria-label="Stop Charleston"
                data-testid="vote-stop-button"
              >
                {clickedVote === 'Stop' && (
                  <span
                    className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                    data-testid="vote-loading-spinner"
                    aria-hidden="true"
                  />
                )}
                Stop Charleston
              </Button>
              <Button
                onClick={() => handleVote('Continue')}
                disabled={isDisabled}
                className="min-w-[140px] bg-green-600 px-6 py-3 font-bold text-white hover:bg-green-700"
                aria-label="Continue Charleston"
                data-testid="vote-continue-button"
              >
                {clickedVote === 'Continue' && (
                  <span
                    className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                    data-testid="vote-loading-spinner"
                    aria-hidden="true"
                  />
                )}
                Continue Charleston
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

VotingPanel.displayName = 'VotingPanel';
