/**
 * Pause Overlay Component
 *
 * Displays a full-screen overlay when the game is paused.
 * Shows different messages for host vs non-host players.
 */

import { useGameStore } from '@/store/gameStore';
import { Commands } from '@/utils/commands';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

interface PauseOverlayProps {
  sendCommand: (command: GameCommand) => boolean;
}

export function PauseOverlay({ sendCommand }: PauseOverlayProps) {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const isHost = useGameStore((state) => state.isHost());
  const isPaused = useGameStore((state) => state.isPaused);
  const pausedBy = useGameStore((state) => state.pausedBy);

  if (!isPaused) {
    return null;
  }

  const handleResume = () => {
    if (yourSeat) {
      const command = Commands.resumeGame(yourSeat);
      sendCommand(command);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '32px',
          borderRadius: '8px',
          textAlign: 'center',
          maxWidth: '400px',
        }}
      >
        <h2 style={{ marginTop: 0 }}>GAME PAUSED</h2>
        {pausedBy && <p>Paused by: {pausedBy}</p>}
        {isHost ? (
          <>
            <button onClick={handleResume} style={{ marginTop: '16px', fontSize: '16px' }}>
              Resume Game
            </button>
          </>
        ) : (
          <p>Waiting for host to resume...</p>
        )}
      </div>
    </div>
  );
}
