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
  staging: 'basis-[70%] max-w-[70%]',
  actions: 'basis-[30%] max-w-[30%]',
} as const;

export const PlayerZone: FC<PlayerZoneProps> = ({
  staging,
  rack,
  actions,
  'data-testid': testId = 'player-zone',
}) => (
  <div
    className="fixed bottom-0 left-0 right-0 px-4 pt-6 pb-4"
    style={{
      background:
        'linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.7) 80%, transparent 100%)',
    }}
    data-testid={testId}
  >
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-3">
      <div className="flex w-full items-start gap-4" data-testid="player-zone-upper-row">
        <div
          className={cn('flex min-w-0 items-center justify-center', UPPER_ROW_SPLIT.staging)}
          data-testid="player-zone-staging-slot"
        >
          {staging}
        </div>
        <div
          className={cn(
            'flex min-w-0 flex-col items-stretch justify-start self-stretch py-2 pr-2',
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
