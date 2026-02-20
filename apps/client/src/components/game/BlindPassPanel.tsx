/**
 * BlindPassPanel Component
 *
 * Controls for selecting blind pass count (0-3) during Charleston FirstLeft
 * and SecondRight stages. Players can choose to pass incoming tiles blindly
 * without looking at them.
 *
 * Related: US-004 (Charleston First Left - Blind Pass)
 */

import type { FC } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/lib/utils';

interface BlindPassPanelProps {
  /** Current blind pass count (0-3) */
  blindCount: number;
  /** Called when blind count changes */
  onBlindCountChange: (count: number) => void;
  /** Number of tiles currently selected from hand */
  handSelectionCount: number;
  /** Total tiles required (always 3 for Charleston) */
  totalRequired: number;
  /** Disable all controls */
  disabled?: boolean;
}

export const BlindPassPanel: FC<BlindPassPanelProps> = ({
  blindCount,
  onBlindCountChange,
  handSelectionCount,
  totalRequired,
  disabled = false,
}) => {
  const handTilesNeeded = totalRequired - blindCount;
  const total = handSelectionCount + blindCount;
  const handleSliderChange = (value: number[]) => {
    const next = Math.max(0, Math.min(totalRequired, value[0] ?? 0));
    onBlindCountChange(next);
  };

  return (
    <div
      className={cn(
        'bg-black/70 rounded-lg px-4 py-3',
        'flex flex-col gap-2',
        'text-white text-sm'
      )}
      data-testid="blind-pass-panel"
      aria-label="Blind pass options"
    >
      <div className="font-medium text-xs uppercase tracking-wide text-gray-300">
        Blind Pass — Incoming Tiles
      </div>

      <div className="text-xs text-gray-400 leading-snug">
        The next player&apos;s tiles arrive after you submit. Set how many to forward without
        looking.
      </div>

      <div className="text-xs text-gray-300" data-testid="blind-pass-label">
        Forward {blindCount} incoming tile{blindCount === 1 ? '' : 's'} without looking
      </div>

      <Slider
        min={0}
        max={totalRequired}
        step={1}
        value={[blindCount]}
        onValueChange={handleSliderChange}
        disabled={disabled}
        data-testid="blind-pass-slider"
        aria-label="Blind pass tile count"
      />

      {/* Increment/Decrement controls */}
      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onBlindCountChange(blindCount - 1)}
          disabled={disabled || blindCount <= 0}
          data-testid="blind-decrement"
          aria-label="Decrease blind pass count"
          className="h-7 w-7 p-0"
        >
          -
        </Button>

        <span
          className="text-lg font-bold min-w-[1.5rem] text-center"
          data-testid="blind-count-display"
        >
          {blindCount}
        </span>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onBlindCountChange(blindCount + 1)}
          disabled={disabled || blindCount >= totalRequired}
          data-testid="blind-increment"
          aria-label="Increase blind pass count"
          className="h-7 w-7 p-0"
        >
          +
        </Button>
      </div>

      {/* Hand tiles needed */}
      <div className="text-xs text-gray-300">
        Hand tiles needed: <span data-testid="hand-tiles-needed">{handTilesNeeded}</span>
      </div>

      {/* Total counter (only when blind > 0) */}
      {blindCount > 0 && (
        <div className="text-xs text-emerald-300" data-testid="total-counter">
          {handSelectionCount} hand + {blindCount} blind = {total} total
        </div>
      )}

      {/* Warning for full blind */}
      {blindCount >= totalRequired && (
        <div className="text-xs text-amber-300 mt-1" data-testid="blind-pass-warning" role="alert">
          If all 4 players blind pass 3 tiles, IOU will trigger
        </div>
      )}
    </div>
  );
};

BlindPassPanel.displayName = 'BlindPassPanel';
