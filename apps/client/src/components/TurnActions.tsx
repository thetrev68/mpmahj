import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { Meld } from '@/types/bindings/generated/Meld';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import { Commands, useCommandSender } from '@/utils/commands';
import { parseTileKey } from '@/utils/tileKey';
import { buildHand } from '@/utils/handBuilder';
import './TurnActions.css';

export function TurnActions({ sendCommand }: { sendCommand: (command: GameCommand) => boolean }) {
  const phase = useGameStore((state) => state.phase);

  return (
    <div className="turn-actions">
      <h2>Actions</h2>
      <div className="actions-container">
        {phase === 'WaitingForPlayers' && <ReadyButton sendCommand={sendCommand} />}

        {typeof phase === 'object' && 'Charleston' in phase && (
          <CharlestonActions stage={phase.Charleston} sendCommand={sendCommand} />
        )}

        {typeof phase === 'object' && 'Playing' in phase && (
          <PlayingActions stage={phase.Playing} sendCommand={sendCommand} />
        )}

        {!phase ||
          (typeof phase === 'string' && phase !== 'WaitingForPlayers' && (
            <p className="no-actions">No actions available</p>
          ))}
      </div>
    </div>
  );
}

function CharlestonActions({
  stage,
  sendCommand,
}: {
  stage: CharlestonStage;
  sendCommand: (command: GameCommand) => boolean;
}) {
  if (stage === 'VotingToContinue') return <CharlestonVoteButtons sendCommand={sendCommand} />;
  if (stage === 'Complete') return <p>Charleston complete</p>;

  return <CharlestonPassButton stage={stage} sendCommand={sendCommand} />;
}

function PlayingActions({
  sendCommand,
}: {
  stage: TurnStage;
  sendCommand: (command: GameCommand) => boolean;
}) {
  const canDiscard = useGameStore((state) => state.canDiscard());
  const canCall = useGameStore((state) => state.canCall());

  return (
    <>
      {canDiscard && <DiscardButton sendCommand={sendCommand} />}
      {canCall && (
        <>
          <CallButtons sendCommand={sendCommand} />
          <PassButton sendCommand={sendCommand} />
        </>
      )}
      <MahjongButton sendCommand={sendCommand} />
    </>
  );
}

// ===== Ready Button =====

function ReadyButton({ sendCommand }: { sendCommand: (command: GameCommand) => boolean }) {
  const yourSeat = useGameStore((state) => state.yourSeat);

  const handleReady = () => {
    if (!yourSeat) return;
    sendCommand(Commands.readyToStart(yourSeat));
  };

  return (
    <button onClick={handleReady} disabled={!yourSeat}>
      Ready to Start
    </button>
  );
}

// ===== Discard Button =====

function DiscardButton({ sendCommand }: { sendCommand: (command: GameCommand) => boolean }) {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const canDiscard = useGameStore((state) => state.canDiscard());
  const selectedTiles = useUIStore((state) => state.selectedTiles);
  const clearSelection = useUIStore((state) => state.clearSelection);
  const addError = useUIStore((state) => state.addError);
  const { discard } = useCommandSender();

  const selectedArray = Array.from(selectedTiles);
  const enabled = canDiscard && selectedArray.length === 1;

  const handleDiscard = () => {
    if (!yourSeat || selectedArray.length !== 1) {
      addError('Select exactly 1 tile to discard');
      return;
    }

    const parsed = parseTileKey(selectedArray[0]);
    if (!parsed) {
      addError('Invalid tile selection');
      return;
    }

    const { command, error } = discard(parsed.tile);
    if (!command) {
      addError(error || 'Cannot discard this tile');
      return;
    }

    sendCommand(command);
    clearSelection();
  };

  return (
    <button onClick={handleDiscard} disabled={!enabled} className="action-primary">
      Discard Tile
    </button>
  );
}

// ===== Call Buttons (Pung/Kong/Quint) =====

function canFormPung(hand: Tile[], calledTile: Tile): boolean {
  return hand.filter((t) => t === calledTile).length >= 2;
}

function canFormKong(hand: Tile[], calledTile: Tile): boolean {
  return hand.filter((t) => t === calledTile).length >= 3;
}

function canFormQuint(hand: Tile[], calledTile: Tile): boolean {
  const matchingTiles = hand.filter((t) => t === calledTile).length;
  const jokers = hand.filter((t) => t === 35).length;
  return matchingTiles + jokers >= 4;
}

function buildMeld(type: 'Pung' | 'Kong' | 'Quint', hand: Tile[], calledTile: Tile): Meld {
  const needed = type === 'Pung' ? 2 : type === 'Kong' ? 3 : 4;
  const matching = hand.filter((t) => t === calledTile);
  const tiles = matching.slice(0, needed);

  // Add jokers if needed for Quint
  if (tiles.length < needed) {
    const jokersNeeded = needed - tiles.length;
    const jokers = hand.filter((t) => t === 35).slice(0, jokersNeeded);
    tiles.push(...jokers);
  }

  tiles.push(calledTile); // Add called tile

  const joker_assignments: Record<number, Tile> = {};
  tiles.forEach((tile, index) => {
    if (tile === 35) joker_assignments[index] = calledTile;
  });

  return {
    meld_type: type,
    tiles,
    called_tile: calledTile,
    joker_assignments,
  };
}

function CallButtons({ sendCommand }: { sendCommand: (command: GameCommand) => boolean }) {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const yourHand = useGameStore((state) => state.yourHand);
  const phase = useGameStore((state) => state.phase);
  const canCall = useGameStore((state) => state.canCall());
  const addError = useUIStore((state) => state.addError);
  const { call } = useCommandSender();

  if (!canCall || typeof phase !== 'object' || !('Playing' in phase)) return null;

  const stage = phase.Playing;
  if (typeof stage !== 'object' || !('CallWindow' in stage)) return null;

  const calledTile = stage.CallWindow.tile;

  const canPung = canFormPung(yourHand, calledTile);
  const canKong = canFormKong(yourHand, calledTile);
  const canQuint = canFormQuint(yourHand, calledTile);

  const handleCall = (type: 'Pung' | 'Kong' | 'Quint') => {
    if (!yourSeat) return;
    const meld = buildMeld(type, yourHand, calledTile);
    const result = call(meld);
    if (!result.command) {
      addError(result.error || 'Cannot call');
      return;
    }
    sendCommand(result.command);
  };

  return (
    <>
      <button onClick={() => handleCall('Pung')} disabled={!canPung}>
        Call Pung
      </button>
      <button onClick={() => handleCall('Kong')} disabled={!canKong}>
        Call Kong
      </button>
      <button onClick={() => handleCall('Quint')} disabled={!canQuint}>
        Call Quint
      </button>
    </>
  );
}

// ===== Pass Button =====

function PassButton({ sendCommand }: { sendCommand: (command: GameCommand) => boolean }) {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const canCall = useGameStore((state) => state.canCall());
  const { pass } = useCommandSender();

  const handlePass = () => {
    if (!yourSeat) return;
    const result = pass();
    if (result.command) {
      sendCommand(result.command);
    }
  };

  return (
    <button onClick={handlePass} disabled={!canCall} className="action-neutral">
      Pass
    </button>
  );
}

// ===== Charleston Pass Button =====

function CharlestonPassButton({
  stage,
  sendCommand,
}: {
  stage: CharlestonStage;
  sendCommand: (command: GameCommand) => boolean;
}) {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const selectedTiles = useUIStore((state) => state.selectedTiles);
  const clearSelection = useUIStore((state) => state.clearSelection);
  const addError = useUIStore((state) => state.addError);
  const { charlestonPass } = useCommandSender();

  const isCourtesy = stage === 'CourtesyAcross';
  const selectedArray = Array.from(selectedTiles);
  const requiredCount = isCourtesy ? 'up to 3' : 'exactly 3';

  const enabled = isCourtesy ? selectedArray.length <= 3 : selectedArray.length === 3;

  const handlePass = () => {
    if (!yourSeat) return;

    if (!isCourtesy && selectedArray.length !== 3) {
      addError(`Select exactly 3 tiles to pass`);
      return;
    }

    // Parse tile keys to get tile values
    const tiles: Tile[] = selectedArray
      .map((key) => parseTileKey(key))
      .filter((parsed): parsed is { tile: Tile; index: number } => parsed !== null)
      .map((parsed) => parsed.tile);

    const result = charlestonPass(tiles);
    if (!result.command) {
      addError(result.error || 'Cannot pass tiles');
      return;
    }

    sendCommand(result.command);
    clearSelection();
  };

  return (
    <button onClick={handlePass} disabled={!enabled} className="action-primary">
      {isCourtesy ? 'Courtesy Pass' : 'Pass Tiles'} ({requiredCount})
    </button>
  );
}

// ===== Charleston Vote Buttons =====

function CharlestonVoteButtons({
  sendCommand,
}: {
  sendCommand: (command: GameCommand) => boolean;
}) {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const { charlestonVote } = useCommandSender();

  const handleVote = (vote: 'Continue' | 'Stop') => {
    if (!yourSeat) return;
    const result = charlestonVote(vote);
    if (result.command) {
      sendCommand(result.command);
    }
  };

  return (
    <>
      <button onClick={() => handleVote('Continue')}>Continue Charleston</button>
      <button onClick={() => handleVote('Stop')}>Stop Charleston</button>
    </>
  );
}

// ===== Mahjong Button =====

function MahjongButton({ sendCommand }: { sendCommand: (command: GameCommand) => boolean }) {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const yourHand = useGameStore((state) => state.yourHand);
  const players = useGameStore((state) => state.players);
  const phase = useGameStore((state) => state.phase);
  const { declareMahjong } = useCommandSender();

  if (typeof phase !== 'object' || !('Playing' in phase)) return null;

  const handleMahjong = () => {
    if (!yourSeat) return;

    const exposed = players[yourSeat]?.exposed_melds ?? [];
    const hand = buildHand(yourHand, exposed);
    const result = declareMahjong(hand, null);
    if (result.command) {
      sendCommand(result.command);
    }
  };

  return (
    <button onClick={handleMahjong} className="action-special">
      Declare Mahjong
    </button>
  );
}
