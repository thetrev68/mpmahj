import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { SetupStage } from '@/types/bindings/generated/SetupStage';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { Meld } from '@/types/bindings/generated/Meld';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import { Commands, useCommandSender } from '@/utils/commands';
import { parseTileKey } from '@/utils/tileKey';
import { buildHand } from '@/utils/handBuilder';
import './TurnActions.css';

export function TurnActions({ sendCommand }: { sendCommand: (command: GameCommand) => boolean }) {
  const phase = useGameStore((state) => state.phase);
  const isActionablePhase =
    typeof phase === 'object' && ('Setup' in phase || 'Charleston' in phase || 'Playing' in phase);

  return (
    <div className="turn-actions">
      <h2>Actions</h2>
      <div className="actions-container">
        {typeof phase === 'object' && 'Setup' in phase && (
          <SetupActions stage={phase.Setup} sendCommand={sendCommand} />
        )}

        {typeof phase === 'object' && 'Charleston' in phase && (
          <CharlestonActions stage={phase.Charleston} sendCommand={sendCommand} />
        )}

        {typeof phase === 'object' && 'Playing' in phase && (
          <PlayingActions stage={phase.Playing} sendCommand={sendCommand} />
        )}

        {!isActionablePhase && <p className="no-actions">No actions available</p>}
      </div>
    </div>
  );
}

function SetupActions({
  stage,
  sendCommand,
}: {
  stage: SetupStage;
  sendCommand: (command: GameCommand) => boolean;
}) {
  if (stage === 'OrganizingHands') return <ReadyButton sendCommand={sendCommand} />;
  if (stage === 'RollingDice') return <RollDiceButton sendCommand={sendCommand} />;

  return <p>Setup in progress...</p>;
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
  stage,
  sendCommand,
}: {
  stage: TurnStage;
  sendCommand: (command: GameCommand) => boolean;
}) {
  const canDiscard = useGameStore((state) => state.canDiscard());
  const canCall = useGameStore((state) => state.canCall());
  const yourSeat = useGameStore((state) => state.yourSeat);

  // Check if we're in Drawing stage and it's our turn
  const canDraw =
    yourSeat !== null &&
    typeof stage === 'object' &&
    'Drawing' in stage &&
    stage.Drawing.player === yourSeat;

  return (
    <>
      {canDraw && <DrawTileButton sendCommand={sendCommand} />}
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

// ===== Setup Buttons =====

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

function RollDiceButton({ sendCommand }: { sendCommand: (command: GameCommand) => boolean }) {
  const yourSeat = useGameStore((state) => state.yourSeat);
  const dealer = useGameStore((state) => state.dealer);

  // Only East (dealer) can roll dice
  const canRoll = yourSeat !== null && yourSeat === dealer;

  const handleRollDice = () => {
    if (!yourSeat) return;
    sendCommand(Commands.rollDice(yourSeat));
  };

  if (!canRoll) {
    return <p>Waiting for East to roll dice...</p>;
  }

  return (
    <button onClick={handleRollDice} className="action-primary">
      Roll Dice
    </button>
  );
}

// ===== Playing Phase Buttons =====

function DrawTileButton({ sendCommand }: { sendCommand: (command: GameCommand) => boolean }) {
  const yourSeat = useGameStore((state) => state.yourSeat);

  const handleDraw = () => {
    if (!yourSeat) return;
    sendCommand(Commands.drawTile(yourSeat));
  };

  return (
    <button onClick={handleDraw} className="action-primary">
      Draw Tile
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

// ===== Call Buttons (Pung/Kong/Quint/Sextet) =====

function canFormPung(hand: Tile[], calledTile: Tile): boolean {
  const matchingTiles = hand.filter((t) => t === calledTile).length;
  const jokers = hand.filter((t) => t === 35).length;
  return matchingTiles + jokers >= 2;
}

function canFormKong(hand: Tile[], calledTile: Tile): boolean {
  const matchingTiles = hand.filter((t) => t === calledTile).length;
  const jokers = hand.filter((t) => t === 35).length;
  return matchingTiles + jokers >= 3;
}

function canFormQuint(hand: Tile[], calledTile: Tile): boolean {
  const matchingTiles = hand.filter((t) => t === calledTile).length;
  const jokers = hand.filter((t) => t === 35).length;
  return matchingTiles + jokers >= 4;
}

function canFormSextet(hand: Tile[], calledTile: Tile): boolean {
  const matchingTiles = hand.filter((t) => t === calledTile).length;
  const jokers = hand.filter((t) => t === 35).length;
  return matchingTiles + jokers >= 5;
}

function buildMeld(
  type: 'Pung' | 'Kong' | 'Quint' | 'Sextet',
  hand: Tile[],
  calledTile: Tile
): Meld {
  const needed = type === 'Pung' ? 2 : type === 'Kong' ? 3 : type === 'Quint' ? 4 : 5;
  const matching = hand.filter((t) => t === calledTile);
  const tiles = matching.slice(0, needed);

  // Add jokers if needed (NMJL allows all-joker melds)
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
  const canSextet = canFormSextet(yourHand, calledTile);

  const handleCall = (type: 'Pung' | 'Kong' | 'Quint' | 'Sextet') => {
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
      <button onClick={() => handleCall('Sextet')} disabled={!canSextet}>
        Call Sextet
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
