import { useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useGameStore } from '@/store/gameStore';
import { useCommandSender } from '@/utils/commands';
import { tileToString, tileToCode } from '@/utils/tileFormatter';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import './BlankExchangeDialog.css';

export function BlankExchangeDialog({ sendCommand }: { sendCommand: (command: GameCommand) => boolean }) {
  const showDialog = useUIStore((state) => state.showBlankExchangeDialog);
  const setShowDialog = useUIStore((state) => state.setBlankExchangeDialog);
  const discardPile = useGameStore((state) => state.discardPile);
  const houseRules = useGameStore((state) => state.houseRules);
  const yourHand = useGameStore((state) => state.yourHand);
  const addError = useUIStore((state) => state.addError);

  const [selectedDiscardIndex, setSelectedDiscardIndex] = useState<number | null>(null);

  const { exchangeBlank } = useCommandSender();

  if (!showDialog) return null;

  // Check if blank exchange is enabled and player has a blank
  const hasBlank = yourHand.includes(36);
  const isEnabled = houseRules?.ruleset.blank_exchange_enabled ?? false;

  if (!hasBlank || !isEnabled) {
    return (
      <div className="dialog-overlay">
        <div className="dialog">
          <h2>Blank Exchange</h2>
          <p>
            {!hasBlank && 'You do not have a Blank tile.'}
            {hasBlank && !isEnabled && 'Blank exchange is not enabled in this game.'}
          </p>
          <div className="dialog-actions">
            <button onClick={() => setShowDialog(false)} className="action-neutral">
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleExchange = () => {
    if (selectedDiscardIndex === null) {
      addError('Select a tile from the discard pile');
      return;
    }

    const result = exchangeBlank(selectedDiscardIndex);
    if (!result.command) {
      addError(result.error || 'Cannot exchange blank');
      return;
    }

    sendCommand(result.command);
    setShowDialog(false);
    setSelectedDiscardIndex(null);
  };

  const handleClose = () => {
    setShowDialog(false);
    setSelectedDiscardIndex(null);
  };

  const selectedTile = selectedDiscardIndex !== null ? discardPile[selectedDiscardIndex] : null;

  return (
    <div className="dialog-overlay">
      <div className="dialog blank-exchange-dialog">
        <h2>Exchange Blank Tile</h2>
        <p>Select a tile from the discard pile to exchange for your Blank:</p>

        <div className="discard-pile-grid">
          {discardPile.length === 0 && <p className="empty-pile">Discard pile is empty</p>}
          {discardPile.map((discardInfo, index) => (
            <button
              key={index}
              onClick={() => setSelectedDiscardIndex(index)}
              className={`discard-tile ${selectedDiscardIndex === index ? 'selected' : ''}`}
              title={`${tileToString(discardInfo.tile)} (discarded by ${discardInfo.discarded_by})`}
            >
              <div className="tile-code">{tileToCode(discardInfo.tile)}</div>
              <div className="tile-name">{tileToString(discardInfo.tile)}</div>
            </button>
          ))}
        </div>

        {selectedTile && (
          <div className="selection-info">
            <p>Selected: <strong>{tileToString(selectedTile.tile)}</strong></p>
          </div>
        )}

        <div className="dialog-actions">
          <button
            onClick={handleExchange}
            disabled={selectedDiscardIndex === null}
            className="action-primary"
          >
            Exchange Blank
          </button>
          <button onClick={handleClose} className="action-neutral">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
