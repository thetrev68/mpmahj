import type { FC } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { UndoButton } from './UndoButton';

interface ActionBarUndoControlsProps {
  readOnly: boolean;
  disabled: boolean;
  disableUndoControls: boolean;
  showSoloUndo: boolean;
  soloUndoRemaining: number;
  soloUndoLimit: number;
  undoRecentActions: string[];
  undoPending: boolean;
  onUndo?: () => void;
  showUndoVoteRequest: boolean;
  undoVoteRemaining: number;
  onRequestUndoVote?: () => void;
}

export const ActionBarUndoControls: FC<ActionBarUndoControlsProps> = ({
  readOnly,
  disabled,
  disableUndoControls,
  showSoloUndo,
  soloUndoRemaining,
  soloUndoLimit,
  undoRecentActions,
  undoPending,
  onUndo,
  showUndoVoteRequest,
  undoVoteRemaining,
  onRequestUndoVote,
}) => {
  if (readOnly || disableUndoControls) return null;

  if (showSoloUndo && onUndo) {
    return (
      <>
        <UndoButton
          available={!disabled && soloUndoRemaining > 0}
          remaining={soloUndoRemaining}
          max={soloUndoLimit}
          isLoading={undoPending}
          recentActions={undoRecentActions}
          onUndo={onUndo}
        />
        <div className="text-center text-xs text-slate-300" aria-live="polite">
          Press Ctrl+Z to undo last action
        </div>
      </>
    );
  }

  if (showUndoVoteRequest && onRequestUndoVote) {
    return (
      <Button
        onClick={onRequestUndoVote}
        disabled={disabled || undoPending || undoVoteRemaining <= 0}
        variant="outline"
        className="w-full border-blue-500/70 text-blue-100 hover:bg-blue-900/40"
        data-testid="request-undo-vote-button"
        aria-label={`Request undo vote (${undoVoteRemaining} remaining)`}
      >
        {undoPending ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Requesting...
          </span>
        ) : (
          `Request Undo Vote (${undoVoteRemaining} remaining)`
        )}
      </Button>
    );
  }

  return null;
};

ActionBarUndoControls.displayName = 'ActionBarUndoControls';
