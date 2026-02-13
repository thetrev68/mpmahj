import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { TimerMode } from '@/types/bindings/generated/TimerMode';

interface CharlestonTimerProps {
  remainingSeconds: number;
  durationSeconds: number;
  mode: TimerMode;
}

export const CharlestonTimer: React.FC<CharlestonTimerProps> = ({
  remainingSeconds,
  durationSeconds,
  mode,
}) => {
  if (mode === 'Hidden') return null;

  const isLow = remainingSeconds <= 10;

  return (
    <div
      className={cn('flex items-center gap-2', isLow && 'text-red-300')}
      data-testid="charleston-timer"
      aria-live="polite"
    >
      <Badge variant={isLow ? 'destructive' : 'secondary'}>Timer</Badge>
      <span className="text-sm">
        {remainingSeconds}s / {durationSeconds}s
      </span>
    </div>
  );
};

CharlestonTimer.displayName = 'CharlestonTimer';
