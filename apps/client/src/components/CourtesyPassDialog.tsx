import { useState } from 'react';
import { useUIStore } from '@/store/uiStore';
import { useCommandSender } from '@/utils/commands';
import { parseTileKey } from '@/utils/tileKey';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { Tile } from '@/types/bindings/generated/Tile';
import './CourtesyPassDialog.css';

export function CourtesyPassDialog({
  sendCommand,
}: {
  sendCommand: (command: GameCommand) => boolean;
}) {
  const showDialog = useUIStore((state) => state.showCourtesyPassDialog);
  const setShowDialog = useUIStore((state) => state.setCourtesyPassDialog);
  const courtesyPassProposal = useUIStore((state) => state.courtesyPassProposal);
  const partnerCourtesyProposal = useUIStore((state) => state.partnerCourtesyProposal);
  const courtesyPassAgreedCount = useUIStore((state) => state.courtesyPassAgreedCount);
  const setCourtesyPassProposal = useUIStore((state) => state.setCourtesyPassProposal);
  const selectedTiles = useUIStore((state) => state.selectedTiles);
  const clearSelection = useUIStore((state) => state.clearSelection);
  const addError = useUIStore((state) => state.addError);

  const [selectedCount, setSelectedCount] = useState<number>(0);

  const { proposeCourtesyPass, acceptCourtesyPass } = useCommandSender();

  if (!showDialog) return null;

  const handlePropose = () => {
    const result = proposeCourtesyPass(selectedCount);
    if (!result.command) {
      addError(result.error || 'Cannot propose courtesy pass');
      return;
    }
    sendCommand(result.command);
    setCourtesyPassProposal(selectedCount);
  };

  const handleSubmitTiles = () => {
    if (courtesyPassAgreedCount === null) return;

    const selectedArray = Array.from(selectedTiles);
    if (selectedArray.length !== courtesyPassAgreedCount) {
      addError(`Select exactly ${courtesyPassAgreedCount} tiles`);
      return;
    }

    // Parse tile keys to get tile values
    const tiles: Tile[] = selectedArray
      .map((key) => parseTileKey(key))
      .filter((parsed): parsed is { tile: Tile; index: number } => parsed !== null)
      .map((parsed) => parsed.tile);

    const result = acceptCourtesyPass(tiles, courtesyPassAgreedCount);
    if (!result.command) {
      addError(result.error || 'Cannot accept courtesy pass');
      return;
    }

    sendCommand(result.command);
    clearSelection();
  };

  const handleClose = () => {
    setShowDialog(false);
    clearSelection();
  };

  // State 1: Initial proposal selection (no one has proposed yet)
  if (courtesyPassProposal === null && partnerCourtesyProposal === null) {
    return (
      <div className="dialog-overlay">
        <div className="dialog">
          <h2>Courtesy Pass Proposal</h2>
          <p>Select how many tiles to pass to your across partner (0-3):</p>
          <div className="courtesy-count-selector">
            {[0, 1, 2, 3].map((count) => (
              <button
                key={count}
                onClick={() => setSelectedCount(count)}
                className={selectedCount === count ? 'selected' : ''}
              >
                {count}
              </button>
            ))}
          </div>
          <div className="dialog-actions">
            <button onClick={handlePropose} className="action-primary">
              Propose
            </button>
            <button onClick={handleClose} className="action-neutral">
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State 2: Waiting for partner to respond
  if (
    courtesyPassProposal !== null &&
    partnerCourtesyProposal === null &&
    courtesyPassAgreedCount === null
  ) {
    return (
      <div className="dialog-overlay">
        <div className="dialog">
          <h2>Courtesy Pass Proposal</h2>
          <p>You proposed: {courtesyPassProposal} tiles</p>
          <p>Waiting for partner to respond...</p>
        </div>
      </div>
    );
  }

  // State 3: Partner proposed, we need to respond
  if (
    courtesyPassProposal === null &&
    partnerCourtesyProposal !== null &&
    courtesyPassAgreedCount === null
  ) {
    return (
      <div className="dialog-overlay">
        <div className="dialog">
          <h2>Courtesy Pass Proposal</h2>
          <p>Partner proposed: {partnerCourtesyProposal} tiles</p>
          <p>Select your proposal (0-3):</p>
          <div className="courtesy-count-selector">
            {[0, 1, 2, 3].map((count) => (
              <button
                key={count}
                onClick={() => setSelectedCount(count)}
                className={selectedCount === count ? 'selected' : ''}
              >
                {count}
              </button>
            ))}
          </div>
          <div className="dialog-actions">
            <button onClick={handlePropose} className="action-primary">
              Propose
            </button>
          </div>
        </div>
      </div>
    );
  }

  // State 4: Agreement reached, select tiles
  if (courtesyPassAgreedCount !== null) {
    const selectedArray = Array.from(selectedTiles);
    const canSubmit = selectedArray.length === courtesyPassAgreedCount;

    return (
      <div className="dialog-overlay">
        <div className="dialog">
          <h2>Courtesy Pass - Select Tiles</h2>
          <p>Agreement reached: Pass {courtesyPassAgreedCount} tiles</p>
          <p>
            Selected: {selectedArray.length} / {courtesyPassAgreedCount}
          </p>
          <p className="instruction">Click tiles in your hand to select them</p>
          <div className="dialog-actions">
            <button onClick={handleSubmitTiles} disabled={!canSubmit} className="action-primary">
              Submit Tiles
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
