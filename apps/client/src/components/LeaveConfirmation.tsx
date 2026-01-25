/**
 * Leave Confirmation Dialog
 *
 * Simple confirmation dialog for leaving the game.
 * Players will be marked as disconnected but the game continues.
 */

import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { Commands } from '@/utils/commands';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import './JokerExchangeDialog.css';

export function LeaveConfirmation({
  sendCommand,
  leaveRoom,
}: {
  sendCommand: (command: GameCommand) => boolean;
  leaveRoom: () => boolean;
}) {
  // UI state
  const showDialog = useUIStore((state) => state.showLeaveConfirmation);
  const setShowLeaveConfirmation = useUIStore((state) => state.setShowLeaveConfirmation);
  const setShowGameMenu = useUIStore((state) => state.setShowGameMenu);

  // Game state
  const yourSeat = useGameStore((state) => state.yourSeat);

  if (!showDialog || !yourSeat) {
    return null;
  }

  const handleLeave = () => {
    const command = Commands.leaveGame(yourSeat);
    sendCommand(command);
    setShowLeaveConfirmation(false);
    setShowGameMenu(false);
    // Leave the room via WebSocket
    leaveRoom();
  };

  const handleCancel = () => {
    setShowLeaveConfirmation(false);
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <div className="dialog-header">
          <h3>Leave Game</h3>
        </div>

        <div className="dialog-body">
          <p>Are you sure you want to leave?</p>
          <p style={{ marginTop: '8px', fontSize: '14px', color: '#666' }}>
            You will be marked as disconnected. The game may continue with the remaining players.
          </p>
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleLeave}>
            Leave Game
          </button>
        </div>
      </div>
    </div>
  );
}
