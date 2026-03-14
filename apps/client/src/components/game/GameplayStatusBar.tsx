import type { FC } from 'react';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';

interface GameplayStatusBarProps {
  turnStage: TurnStage;
  mySeat: Seat;
  readOnly: boolean;
}

function getStatusText(turnStage: TurnStage, mySeat: Seat): string {
  if ('Drawing' in turnStage) {
    return turnStage.Drawing.player === mySeat
      ? 'Your turn — Drawing'
      : `${turnStage.Drawing.player}'s turn — Drawing`;
  }

  if ('Discarding' in turnStage) {
    return turnStage.Discarding.player === mySeat
      ? 'Your turn — Select a tile to discard'
      : `Waiting for ${turnStage.Discarding.player} to discard`;
  }

  if ('CallWindow' in turnStage) {
    return turnStage.CallWindow.can_act.includes(mySeat)
      ? 'Call window open — Select claim tiles or press Proceed'
      : 'Call window open — Waiting for call resolution';
  }

  return 'Gameplay in progress';
}

export const GameplayStatusBar: FC<GameplayStatusBarProps> = ({ turnStage, mySeat, readOnly }) => {
  if (readOnly) {
    return null;
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-20 flex items-center gap-4 px-6 py-3 text-white"
      style={{
        background: 'linear-gradient(to right, rgba(12,35,18,0.97), rgba(18,52,28,0.97))',
        borderBottom: '1px solid rgba(80,160,100,0.3)',
      }}
      data-testid="gameplay-status-bar"
      role="status"
      aria-label="Gameplay status"
    >
      <span className="text-sm font-medium tracking-wide">{getStatusText(turnStage, mySeat)}</span>
    </div>
  );
};

GameplayStatusBar.displayName = 'GameplayStatusBar';
