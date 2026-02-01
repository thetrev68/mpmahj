/**
 * Joker Exchange Dialog
 *
 * Allows player to exchange a Joker from an exposed meld with a matching tile from their hand.
 */

import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { Commands } from '@/utils/commands';
import { tileToString, formatMeld } from '@/utils/tileFormatter';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import './JokerExchangeDialog.css';

export function JokerExchangeDialog({
  sendCommand,
}: {
  sendCommand: (command: GameCommand) => boolean;
}) {
  // UI state
  const showDialog = useUIStore((state) => state.showJokerExchangeDialog);
  const jokerTarget = useUIStore((state) => state.jokerExchangeTarget);
  const setJokerExchangeDialog = useUIStore((state) => state.setJokerExchangeDialog);
  const addError = useUIStore((state) => state.addError);

  // Game state
  const yourSeat = useGameStore((state) => state.yourSeat);
  const yourHand = useGameStore((state) => state.yourHand);
  const players = useGameStore((state) => state.players);

  if (!showDialog || !jokerTarget || !yourSeat) {
    return null;
  }

  const targetPlayer = players[jokerTarget.seat];
  if (!targetPlayer) {
    return null;
  }

  const meld = targetPlayer.exposed_melds[jokerTarget.meldIndex];
  if (!meld) {
    return null;
  }

  // Find joker in the meld and determine what tile it represents
  const jokerIndex = meld.tiles.findIndex((t) => t === 35); // 35 is Joker
  if (jokerIndex === -1) {
    return null;
  }

  // Determine what tile the Joker represents
  let requiredTile: number | null = null;
  if (meld.joker_assignments && meld.joker_assignments[jokerIndex] !== undefined) {
    requiredTile = meld.joker_assignments[jokerIndex];
  } else if (meld.called_tile !== null) {
    requiredTile = meld.called_tile;
  }

  if (requiredTile === null) {
    return null;
  }

  // Check if player has the required tile
  const hasRequiredTile = yourHand.includes(requiredTile);

  const handleExchange = (tile: number) => {
    if (tile !== requiredTile) {
      addError('Must use the correct tile for replacement');
      return;
    }

    const command = Commands.exchangeJoker(yourSeat, jokerTarget.seat, jokerTarget.meldIndex, tile);
    sendCommand(command);
    setJokerExchangeDialog(false);
  };

  const handleCancel = () => {
    setJokerExchangeDialog(false);
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog joker-exchange-dialog">
        <div className="dialog-header">
          <h3>Exchange Joker</h3>
        </div>

        <div className="dialog-body">
          <div className="meld-info">
            <p>
              <strong>Target Meld:</strong> {formatMeld(meld)}
            </p>
            <p>
              <strong>Required Tile:</strong> {tileToString(requiredTile)}
            </p>
          </div>

          {hasRequiredTile ? (
            <div className="exchange-actions">
              <p>You have the required tile. Click to exchange:</p>
              <button className="btn btn-primary" onClick={() => handleExchange(requiredTile!)}>
                Exchange for {tileToString(requiredTile)}
              </button>
            </div>
          ) : (
            <div className="exchange-error">
              <p>You don't have the required tile ({tileToString(requiredTile)}) in your hand.</p>
            </div>
          )}
        </div>

        <div className="dialog-footer">
          <button className="btn btn-secondary" onClick={handleCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
