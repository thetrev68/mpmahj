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
  <div className="relative z-20 w-full" data-testid={testId}>
    <div
      className="mx-auto grid w-full max-w-full gap-1.5 lg:grid-cols-[minmax(0,1fr)_280px]"
      data-testid="player-zone-layout"
    >
      {/* Row 1: staging and actions side-by-side in the same plane */}
      <div
        className="flex min-w-0 items-center justify-center"
        data-testid="player-zone-staging-slot"
      >
        {staging}
      </div>
      <div
        className="flex min-w-0 flex-col items-stretch justify-center self-stretch py-2"
        data-testid="player-zone-actions-slot"
      >
        {actions}
      </div>
      {/* Row 2: rack spans the full width */}
      <div
        className="flex w-full items-center justify-center lg:col-span-2"
        data-testid="player-zone-rack-slot"
      >
        {rack}
      </div>
    </div>
  </div>
);

PlayerZone.displayName = 'PlayerZone';
