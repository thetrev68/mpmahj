import type { FC, ReactNode } from 'react';

interface PlayerZoneProps {
  /** Staging strip (upper row, left — beside ActionBar) */
  staging: ReactNode;
  /** Player's tile rack (lower row, full width) */
  rack: ReactNode;
  /** Right-side content beside staging strip (ActionBar) */
  actions: ReactNode;
  'data-testid'?: string;
}

export const PlayerZone: FC<PlayerZoneProps> = ({
  staging,
  rack,
  actions,
  'data-testid': testId = 'player-zone',
}) => (
  <div className="absolute inset-x-0 bottom-0 z-20 pt-6 pb-4" data-testid={testId}>
    <div className="mx-auto flex w-full max-w-full flex-col gap-3">
      <div
        className="flex w-full flex-col items-stretch gap-4 px-[108px] lg:relative"
        data-testid="player-zone-upper-row"
      >
        <div
          className="flex min-w-0 items-center justify-center lg:pr-[296px]"
          data-testid="player-zone-staging-slot"
        >
          {staging}
        </div>
        <div
          className="flex min-w-0 flex-col items-stretch justify-start self-stretch py-2 lg:absolute lg:bottom-0 lg:right-[108px] lg:w-[280px] lg:py-0"
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
