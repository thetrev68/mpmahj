import type { FC, ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PlayerZoneProps {
  /** Staging strip (upper row, left — beside ActionBar) */
  staging: ReactNode;
  /** Player's tile rack (lower row, full width) */
  rack: ReactNode;
  /** Right-side content beside staging strip (ActionBar) */
  actions: ReactNode;
  'data-testid'?: string;
}

const UPPER_ROW_SPLIT = {
  staging: 'lg:basis-[70%] lg:max-w-[70%]',
  actions: 'lg:basis-[30%] lg:max-w-[30%]',
} as const;

export const PlayerZone: FC<PlayerZoneProps> = ({
  staging,
  rack,
  actions,
  'data-testid': testId = 'player-zone',
}) => (
  <div className="absolute inset-x-0 bottom-0 z-20 px-4 pt-6 pb-4 sm:px-6" data-testid={testId}>
    <div className="mx-auto flex w-full max-w-full flex-col gap-3">
      <div
        className="flex w-full flex-col items-stretch gap-4 lg:flex-row lg:items-start"
        data-testid="player-zone-upper-row"
      >
        <div
          className={cn(
            'flex min-w-0 items-center justify-center lg:flex-1',
            UPPER_ROW_SPLIT.staging
          )}
          data-testid="player-zone-staging-slot"
        >
          {staging}
        </div>
        <div
          className={cn(
            'flex min-w-0 flex-col items-stretch justify-start self-stretch py-2 lg:w-[280px] lg:flex-none lg:pr-2',
            UPPER_ROW_SPLIT.actions
          )}
          data-testid="player-zone-actions-slot"
        >
          {actions}
        </div>
      </div>
      <div className="flex w-full items-center justify-center" data-testid="player-zone-rack-slot">
        {rack}
      </div>
    </div>
  </div>
);

PlayerZone.displayName = 'PlayerZone';
