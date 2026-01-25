/**
 * Meld Upgrade Dialog
 *
 * Allows player to upgrade an exposed meld by adding a tile from their hand.
 * Pung → Kong, Kong → Quint, Quint → Sextet
 */

import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { Commands } from '@/utils/commands';
import { tileToString, formatMeld } from '@/utils/tileFormatter';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import './JokerExchangeDialog.css';

export function MeldUpgradeDialog({
  sendCommand,
}: {
  sendCommand: (command: GameCommand) => boolean;
}) {
  // UI state
  const showDialog = useUIStore((state) => state.showMeldUpgradeDialog);
  const meldIndex = useUIStore((state) => state.meldUpgradeIndex);
  const setMeldUpgradeDialog = useUIStore((state) => state.setMeldUpgradeDialog);

  // Game state
  const yourSeat = useGameStore((state) => state.yourSeat);
  const yourHand = useGameStore((state) => state.yourHand);
  const players = useGameStore((state) => state.players);

  if (!showDialog || meldIndex === null || !yourSeat) {
    return null;
  }

  const yourInfo = players[yourSeat];
  if (!yourInfo) {
    return null;
  }

  const meld = yourInfo.exposed_melds[meldIndex];
  if (!meld) {
    return null;
  }

  // Determine what tile can upgrade this meld
  // The upgrade tile must match the tiles in the meld
  // For a meld with jokers, we need to check joker_assignments or called_tile
  let targetTile: number | null = null;

  // Find a non-joker tile in the meld
  for (let i = 0; i < meld.tiles.length; i++) {
    const tile = meld.tiles[i];
    if (tile !== 35) {
      // Not a joker
      targetTile = tile;
      break;
    }
  }

  // If all tiles are jokers, use called_tile or joker_assignments
  if (targetTile === null) {
    if (meld.called_tile !== null) {
      targetTile = meld.called_tile;
    } else if (meld.joker_assignments && Object.keys(meld.joker_assignments).length > 0) {
      // Get first joker assignment
      const firstAssignment = Object.values(meld.joker_assignments)[0];
      targetTile = firstAssignment ?? null;
    }
  }

  if (targetTile === null) {
    return null;
  }

  // Check if player has the required tile (can be joker or matching tile)
  const matchingTiles = yourHand.filter((t) => t === targetTile || t === 35);
  const hasUpgradeTile = matchingTiles.length > 0;

  // Determine next meld type
  const nextMeldType =
    meld.meld_type === 'Pung'
      ? 'Kong'
      : meld.meld_type === 'Kong'
        ? 'Quint'
        : meld.meld_type === 'Quint'
          ? 'Sextet'
          : null;

  if (!nextMeldType) {
    return null;
  }

  const handleUpgrade = (tile: number) => {
    const command = Commands.addToExposure(yourSeat, meldIndex, tile);
    sendCommand(command);
    setMeldUpgradeDialog(false);
  };

  const handleCancel = () => {
    setMeldUpgradeDialog(false);
  };

  return (
    <div className="dialog-overlay">
      <div className="dialog meld-upgrade-dialog">
        <div className="dialog-header">
          <h3>Upgrade Meld</h3>
        </div>

        <div className="dialog-body">
          <div className="upgrade-info">
            <p>
              <strong>Current Meld:</strong> {formatMeld(meld)}
            </p>
            <p>
              <strong>Upgrade to:</strong> {nextMeldType}
            </p>
            <p>
              <strong>Required Tile:</strong> {tileToString(targetTile)} or Joker
            </p>
          </div>

          {hasUpgradeTile ? (
            <div className="upgrade-options">
              <p>Select tile to add:</p>
              <div className="tile-list">
                {matchingTiles.map((tile, idx) => (
                  <button
                    key={idx}
                    className="btn btn-primary tile-button"
                    onClick={() => handleUpgrade(tile)}
                  >
                    {tileToString(tile)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="exchange-error">
              <p>
                You don't have the required tile ({tileToString(targetTile)} or Joker) in your hand.
              </p>
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
