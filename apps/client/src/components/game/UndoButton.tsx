/**
 * @module UndoButton
 *
 * Action button for initiating an undo request. Shows remaining undo count and
 * displays a tooltip with recent actions. Disabled when undo is unavailable or
 * a request is in flight.
 *
 * Pairs with {@link src/components/game/UndoVotePanel.tsx} which handles the
 * vote UI after an undo is requested.
 *
 * @see {@link src/components/game/UndoVotePanel.tsx} for undo voting UI
 */

import type { FC } from 'react';
import { RotateCcw, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Props for the UndoButton component.
 *
 * @interface UndoButtonProps
 * @property {boolean} available - Whether undo is currently available (game state allows it).
 * @property {number} remaining - Number of undos remaining in this game.
 * @property {number} max - Maximum total undos allowed per game (for display).
 * @property {boolean} [isLoading=false] - Whether an undo request is in flight. Shows spinner.
 * @property {string[]} [recentActions=[]] - Human-readable list of recent actions (max 3 shown in tooltip).
 * @property {() => void} onUndo - Callback fired when user clicks the button.
 */
interface UndoButtonProps {
  available: boolean;
  remaining: number;
  max: number;
  isLoading?: boolean;
  recentActions?: string[];
  onUndo: () => void;
}

export const UndoButton: FC<UndoButtonProps> = ({
  available,
  remaining,
  max,
  isLoading = false,
  recentActions = [],
  onUndo,
}) => {
  const disabled = !available || isLoading;
  const label = `Undo (${remaining} available)`;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={onUndo}
            disabled={disabled}
            variant="outline"
            className="w-full border-blue-500/70 text-blue-100 hover:bg-blue-900/40"
            data-testid="undo-button"
            aria-label={label}
          >
            {isLoading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Undoing...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <RotateCcw className="h-4 w-4" />
                {label}
              </span>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-[240px] text-left" data-testid="undo-tooltip">
          <div className="font-semibold">Recent actions</div>
          {recentActions.length > 0 ? (
            <ul className="mt-1 list-disc pl-4">
              {recentActions.slice(0, 3).map((action, idx) => (
                <li key={`${action}-${idx}`}>{action}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-1">No recent actions.</p>
          )}
          <p className="mt-1 text-[11px] opacity-80">Limit: {max} total undos.</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

UndoButton.displayName = 'UndoButton';
