import type { FC, ReactNode } from 'react';
import { BOARD_LAYERS } from './boardLayers';

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
  <div
    className={`relative ${BOARD_LAYERS.gameplay} w-full px-3 pb-2 pt-3 lg:px-4`}
    data-testid={testId}
    data-board-region="south-interaction-region"
    data-board-layer={BOARD_LAYERS.gameplay}
  >
    <div
      className="mx-auto grid w-full max-w-full gap-3 lg:grid-cols-[minmax(0,auto)_minmax(var(--player-zone-actions-min),var(--player-zone-actions-max))] lg:justify-center"
      data-testid="player-zone-layout"
    >
      <div
        className="flex min-w-0 items-start justify-start"
        data-testid="player-zone-staging-slot"
        data-board-region="staging-region"
      >
        {staging}
      </div>
      <div
        className="flex min-w-0 flex-col items-stretch justify-start self-start lg:justify-start"
        data-testid="player-zone-actions-slot"
        data-board-region="action-region"
      >
        {actions}
      </div>
      <div
        className="flex w-full items-center justify-center px-4 lg:col-span-2 lg:px-12"
        data-testid="player-zone-rack-slot"
        data-board-region="rack-region"
      >
        {rack}
      </div>
    </div>
  </div>
);

PlayerZone.displayName = 'PlayerZone';
