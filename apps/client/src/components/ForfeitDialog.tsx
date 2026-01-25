/**
 * Forfeit Dialog
 *
 * Allows player to forfeit the game early with optional reason.
 * Game ends immediately with forfeiting player marked as loss.
 */

import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { Commands } from '@/utils/commands';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import './JokerExchangeDialog.css';

const PREDEFINED_REASONS = [
  'Personal emergency',
  'Connection issues',
  'Game is taking too long',
  'Other',
];

export function ForfeitDialog({ sendCommand }: { sendCommand: (command: GameCommand) => boolean }) {
  // UI state
  const showDialog = useUIStore((state) => state.showForfeitDialog);
  const setShowForfeitDialog = useUIStore((state) => state.setShowForfeitDialog);
  const setShowGameMenu = useUIStore((state) => state.setShowGameMenu);

  // Game state
  const yourSeat = useGameStore((state) => state.yourSeat);

  // Local state
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customReason, setCustomReason] = useState<string>('');

  if (!showDialog || !yourSeat) {
    return null;
  }

  const handleForfeit = () => {
    let finalReason: string | null = null;

    if (selectedReason === 'Other' && customReason.trim()) {
      finalReason = customReason.trim();
    } else if (selectedReason && selectedReason !== 'Other') {
      finalReason = selectedReason;
    }

    const command = Commands.forfeitGame(yourSeat, finalReason);
    sendCommand(command);
    setShowForfeitDialog(false);
    setShowGameMenu(false);
    setSelectedReason('');
    setCustomReason('');
  };

  const handleCancel = () => {
    setShowForfeitDialog(false);
    setSelectedReason('');
    setCustomReason('');
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog">
        <div className="dialog-header">
          <h3>Forfeit Game</h3>
        </div>

        <div className="dialog-body">
          <div
            style={{
              padding: '8px 0',
              marginBottom: '16px',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffc107',
              borderRadius: '4px',
            }}
          >
            <p style={{ margin: '8px 12px', fontSize: '14px' }}>
              <strong>Warning:</strong> This will end the game immediately and count as a loss for
              you.
            </p>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold' }}>
              Reason (optional):
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {PREDEFINED_REASONS.map((reason) => (
                <label
                  key={reason}
                  style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}
                >
                  <input
                    type="radio"
                    name="forfeit-reason"
                    value={reason}
                    checked={selectedReason === reason}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    style={{ marginRight: '8px' }}
                  />
                  {reason}
                </label>
              ))}
            </div>

            {selectedReason === 'Other' && (
              <div style={{ marginTop: '12px' }}>
                <label style={{ display: 'block', marginBottom: '4px', fontSize: '14px' }}>
                  Custom reason:
                </label>
                <input
                  type="text"
                  value={customReason}
                  onChange={(e) => setCustomReason(e.target.value)}
                  placeholder="Enter your reason..."
                  maxLength={200}
                  style={{
                    width: '100%',
                    padding: '8px',
                    border: '1px solid #ccc',
                    borderRadius: '4px',
                    fontSize: '14px',
                  }}
                />
              </div>
            )}
          </div>
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={handleForfeit}>
            Forfeit Game
          </button>
        </div>
      </div>
    </div>
  );
}
