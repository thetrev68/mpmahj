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
      className="mx-auto grid w-full max-w-full gap-3 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end"
      data-testid="player-zone-layout"
    >
      <div className="grid min-w-0 gap-3" data-testid="player-zone-upper-row">
        <div
          className="flex min-w-0 items-center justify-center"
          data-testid="player-zone-staging-slot"
        >
          {staging}
        </div>
        <div
          className="flex w-full items-center justify-center"
          data-testid="player-zone-rack-slot"
        >
          {rack}
        </div>
      </div>
      <div
        className="flex min-w-0 flex-col items-stretch justify-end self-stretch"
        data-testid="player-zone-actions-column"
      >
        <div
          className="flex min-w-0 flex-col items-stretch justify-start self-stretch py-2"
          data-testid="player-zone-actions-slot"
        >
          {actions}
        </div>
      </div>
    </div>
  </div>
);

PlayerZone.displayName = 'PlayerZone';
