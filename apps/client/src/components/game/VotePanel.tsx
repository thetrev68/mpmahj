/**
 * VotePanel Component
 *
 * Displays Charleston voting options (Stop / Continue) after First Charleston.
 *
 * Related: US-004 (Charleston First Left), AC-12
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';

export interface VotePanelProps {
  /** Callback when a vote is selected */
  onVote: (vote: CharlestonVote) => void;
  /** Disable interaction after submitting */
  disabled?: boolean;
}

export const VotePanel: React.FC<VotePanelProps> = ({ onVote, disabled = false }) => {
  return (
    <div
      className={cn(
        'fixed top-[170px] left-1/2 -translate-x-1/2',
        'bg-black/85 text-white rounded-lg',
        'px-5 py-3',
        'flex flex-col items-center gap-3'
      )}
      data-testid="vote-panel"
      role="group"
      aria-label="Charleston vote"
    >
      <div className="text-sm font-semibold">Vote: Stop or Continue?</div>
      <div className="flex items-center gap-3">
        <Button
          onClick={() => onVote('Stop')}
          disabled={disabled}
          variant="destructive"
          size="sm"
          data-testid="vote-stop-button"
          aria-label="Vote to stop charleston"
        >
          Stop
        </Button>
        <Button
          onClick={() => onVote('Continue')}
          disabled={disabled}
          className="bg-emerald-600 hover:bg-emerald-700"
          size="sm"
          data-testid="vote-continue-button"
          aria-label="Vote to continue charleston"
        >
          Continue
        </Button>
      </div>
      {disabled && (
        <div className="text-xs text-gray-300" aria-live="polite">
          Vote submitted. Waiting for others...
        </div>
      )}
    </div>
  );
};

VotePanel.displayName = 'VotePanel';
