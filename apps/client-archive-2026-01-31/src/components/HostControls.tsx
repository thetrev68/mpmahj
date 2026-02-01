/**
 * Host Controls Component
 *
 * Displays pause/resume buttons only to the game host.
 */

import { useGameStore } from '@/store/gameStore';
import { Commands } from '@/utils/commands';
import { isWaitingForPlayers, isGameOver, isSetupPhase } from '@/utils/phaseHelpers';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

interface HostControlsProps {
  sendCommand: (command: GameCommand) => boolean;
}

export function HostControls({ sendCommand }: HostControlsProps) {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const isHost = useGameStore((state) => state.isHost());
  const isPaused = useGameStore((state) => state.isPaused);
  const phase = useGameStore((state) => state.phase);

  // Only show if we are the host
  if (!isHost || !yourSeat) {
    return null;
  }

  // Only show during active game (not WaitingForPlayers, Setup, or GameOver)
  const isActiveGame = !isWaitingForPlayers(phase) && !isSetupPhase(phase) && !isGameOver(phase);

  if (!isActiveGame) {
    return null;
  }

  const handlePause = () => {
    const command = Commands.pauseGame(yourSeat);
    sendCommand(command);
  };

  const handleResume = () => {
    const command = Commands.resumeGame(yourSeat);
    sendCommand(command);
  };

  return (
    <div style={{ marginTop: 8, marginBottom: 8 }}>
      {isPaused ? (
        <button onClick={handleResume}>Resume Game</button>
      ) : (
        <button onClick={handlePause}>Pause Game</button>
      )}
    </div>
  );
}
