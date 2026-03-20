import type { FC } from 'react';
import { getCharlestonStatusText, getGameplayStatusText } from './ActionBarDerivations';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { Seat } from '@/types/bindings/generated/Seat';

interface GameplayStatusBarProps {
  phase: GamePhase;
  mySeat: Seat;
  readOnly: boolean;
  hasSubmittedVote?: boolean;
  myVote?: CharlestonVote;
  votedPlayers?: Seat[];
  totalPlayers?: number;
  botVoteMessage?: string;
  hasSubmittedPass?: boolean;
}

function getStatusText({
  phase,
  mySeat,
  hasSubmittedVote = false,
  myVote,
  votedPlayers = [],
  totalPlayers = 4,
  botVoteMessage,
  hasSubmittedPass,
}: Omit<GameplayStatusBarProps, 'readOnly'>): string | null {
  if (typeof phase === 'object' && phase !== null && 'Charleston' in phase) {
    return getCharlestonStatusText(phase.Charleston, {
      hasSubmittedVote,
      myVote,
      votedPlayers,
      totalPlayers,
      botVoteMessage,
      hasSubmittedPass,
    });
  }

  if (typeof phase === 'object' && phase !== null && 'Playing' in phase) {
    if (typeof phase.Playing === 'object' && phase.Playing !== null) {
      return getGameplayStatusText(phase.Playing, mySeat);
    }
  }

  return null;
}

export const GameplayStatusBar: FC<GameplayStatusBarProps> = (props) => {
  const statusText = getStatusText(props);

  if (statusText === null) {
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
      <span className="text-sm font-medium tracking-wide">{statusText}</span>
    </div>
  );
};

GameplayStatusBar.displayName = 'GameplayStatusBar';
