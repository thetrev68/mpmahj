/**
 * Abandon Dialog
 *
 * Allows player to propose abandoning the game early.
 * According to current backend: no voting exists, game ends immediately.
 */

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { Commands } from '@/utils/commands';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { AbandonReason } from '@/types/bindings/generated/AbandonReason';
import './JokerExchangeDialog.css';

const ABANDON_REASONS: Array<{ value: AbandonReason; label: string; description: string }> = [
  {
    value: 'InsufficientPlayers',
    label: 'Too Many Disconnections / Insufficient Players',
    description: 'Not enough active players remain to finish the game',
  },
  {
    value: 'Timeout',
    label: 'Game Timeout / Stalling',
    description: 'Game pace is too slow or appears stuck',
  },
  {
    value: 'MutualAgreement',
    label: 'Mutual Agreement',
    description: 'All players agree to end the game now',
  },
  {
    value: 'Forfeit',
    label: 'Treat as Forfeit (no winner)',
    description: 'Use abandonment when a forfeit should not award a win',
  },
  {
    value: 'AllPlayersDead',
    label: 'All Players Dead',
    description: 'No player can realistically win',
  },
];

export function AbandonDialog({ sendCommand }: { sendCommand: (command: GameCommand) => boolean }) {
  // UI state
  const showDialog = useUIStore((state) => state.showAbandonDialog);
  const setShowAbandonDialog = useUIStore((state) => state.setShowAbandonDialog);
  const setShowGameMenu = useUIStore((state) => state.setShowGameMenu);

  // Game state
  const yourSeat = useGameStore((state) => state.yourSeat);

  // Local state
  const [selectedReason, setSelectedReason] = useState<AbandonReason | null>(null);

  if (!showDialog || !yourSeat) {
    return null;
  }

  const handleAbandon = () => {
    if (!selectedReason) {
      return;
    }

    const command = Commands.abandonGame(yourSeat, selectedReason);
    sendCommand(command);
    setShowAbandonDialog(false);
    setShowGameMenu(false);
    setSelectedReason(null);
  };

  const handleCancel = () => {
    setShowAbandonDialog(false);
    setSelectedReason(null);
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <div className="dialog-header">
          <h3>Abandon Game</h3>
        </div>

        <div className="dialog-body">
          <p style={{ marginBottom: '16px' }}>
            Select a reason to abandon the game. The game will end immediately with no winner.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {ABANDON_REASONS.map((reason) => (
              <label
                key={reason.value}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  cursor: 'pointer',
                  padding: '12px',
                  border: selectedReason === reason.value ? '2px solid #007bff' : '1px solid #ccc',
                  borderRadius: '4px',
                  backgroundColor: selectedReason === reason.value ? '#e7f3ff' : 'white',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="radio"
                    name="abandon-reason"
                    value={reason.value}
                    checked={selectedReason === reason.value}
                    onChange={(e) => setSelectedReason(e.target.value as AbandonReason)}
                    style={{ marginRight: '8px' }}
                  />
                  <strong>{reason.label}</strong>
                </div>
                <div
                  style={{ marginLeft: '24px', fontSize: '14px', color: '#666', marginTop: '4px' }}
                >
                  {reason.description}
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleAbandon} disabled={!selectedReason}>
            Abandon Game
          </button>
        </div>
      </div>
    </div>
  );
}
