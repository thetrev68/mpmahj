import { CHARLESTON_PASS_COUNT } from '@/lib/constants';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';

export interface ActionBarPhaseMeta {
  isPlayingPhase: boolean;
  isCallWindow: boolean;
  isCriticalPhase: boolean;
}

export function getActionBarPhaseMeta(phase: GamePhase, mySeat: Seat): ActionBarPhaseMeta {
  const isPlayingPhase = typeof phase === 'object' && phase !== null && 'Playing' in phase;
  const isCallWindow =
    isPlayingPhase &&
    typeof phase.Playing === 'object' &&
    phase.Playing !== null &&
    'CallWindow' in phase.Playing;
  const isCriticalPhase =
    (isPlayingPhase &&
      typeof phase.Playing === 'object' &&
      phase.Playing !== null &&
      (('Drawing' in phase.Playing && phase.Playing.Drawing.player === mySeat) ||
        ('Discarding' in phase.Playing && phase.Playing.Discarding.player === mySeat) ||
        ('CallWindow' in phase.Playing && phase.Playing.CallWindow.can_act.includes(mySeat)))) ||
    (typeof phase === 'object' && phase !== null && 'Charleston' in phase);

  return {
    isPlayingPhase,
    isCallWindow,
    isCriticalPhase,
  };
}

interface CharlestonPassEligibilityInput {
  selectedTilesCount: number;
  blindPassCount?: number;
  hasSubmittedPass: boolean;
  isBusy: boolean;
}

export function canSubmitCharlestonPass({
  selectedTilesCount,
  blindPassCount,
  hasSubmittedPass,
  isBusy,
}: CharlestonPassEligibilityInput): boolean {
  const blind = blindPassCount ?? 0;
  const totalSelected = selectedTilesCount + blind;
  return totalSelected === CHARLESTON_PASS_COUNT && !isBusy && !hasSubmittedPass;
}

interface CourtesyPassEligibilityInput {
  selectedTilesCount: number;
  courtesyPassCount?: number;
  isBusy: boolean;
}

export function canSubmitCourtesyPass({
  selectedTilesCount,
  courtesyPassCount,
  isBusy,
}: CourtesyPassEligibilityInput): boolean {
  if (isBusy) {
    return false;
  }

  if (courtesyPassCount !== undefined) {
    return selectedTilesCount === courtesyPassCount;
  }

  return selectedTilesCount >= 0 && selectedTilesCount <= CHARLESTON_PASS_COUNT;
}

export function canDiscardSelectedTile(selectedTilesCount: number, isBusy: boolean): boolean {
  return selectedTilesCount === 1 && !isBusy;
}

export function canSubmitCharlestonVote(
  selectedTilesCount: number,
  hasSubmittedVote: boolean,
  isBusy: boolean
): boolean {
  return (
    (selectedTilesCount === 0 || selectedTilesCount === CHARLESTON_PASS_COUNT) &&
    !isBusy &&
    !hasSubmittedVote
  );
}

export function getCharlestonVoteChoice(selectedTilesCount: number): CharlestonVote | null {
  if (selectedTilesCount === 0) {
    return 'Stop';
  }

  if (selectedTilesCount === CHARLESTON_PASS_COUNT) {
    return 'Continue';
  }

  return null;
}

function getCharlestonDirectionLabel(stage: string): string | null {
  switch (stage) {
    case 'FirstRight':
    case 'SecondRight':
      return 'right';
    case 'FirstAcross':
    case 'SecondAcross':
    case 'CourtesyAcross':
      return 'across';
    case 'FirstLeft':
    case 'SecondLeft':
      return 'left';
    default:
      return null;
  }
}

function getCharlestonReceiveDirection(stage: CharlestonStage): string | null {
  switch (stage) {
    case 'FirstRight':
      return 'left';
    case 'FirstAcross':
    case 'SecondAcross':
      return 'across';
    case 'SecondLeft':
      return 'right';
    default:
      return null;
  }
}

function getCharlestonInstructionText(stage: CharlestonStage, hasSubmittedPass: boolean): string {
  if (stage === 'CourtesyAcross') {
    return hasSubmittedPass
      ? 'Courtesy pass submitted. Waiting for player across...'
      : 'Select 0–3 tiles to pass across, then press Proceed.';
  }

  if (stage === 'VotingToContinue') {
    return 'Round vote. Stage up to 3 tiles to continue. Stage 0 tiles to stop. Press Proceed when ready.';
  }

  if (stage === 'FirstLeft' || stage === 'SecondRight') {
    return 'Charleston Blind Pass: Choose 3 tiles to pass using your rack, the blind incoming tiles, or both. Then press Proceed.';
  }

  if (hasSubmittedPass) {
    const direction = getCharlestonDirectionLabel(stage);
    const receiveDirection = getCharlestonReceiveDirection(stage);
    if (direction && receiveDirection) {
      return `Passing 3 tiles ${direction}. Receiving 3 tiles from ${receiveDirection}.`;
    }
  }

  const direction = getCharlestonDirectionLabel(stage);
  if (direction) {
    return `Charleston. Select ${CHARLESTON_PASS_COUNT} tiles to pass ${direction}, then press Proceed.`;
  }

  return 'Charleston. Stage tiles, then press Proceed.';
}

function getPlayingInstructionText(
  turnStage: TurnStage,
  mySeat: Seat,
  callWindowInstruction?: string
): string | null {
  if ('Drawing' in turnStage) {
    return 'Drawing tile...';
  }

  if ('Discarding' in turnStage) {
    return turnStage.Discarding.player === mySeat
      ? 'Select 1 tile to discard, then press Proceed. If you are Mahjong, press Mahjong.'
      : `Waiting for ${turnStage.Discarding.player} to discard.`;
  }

  if ('CallWindow' in turnStage) {
    if (!turnStage.CallWindow.can_act.includes(mySeat)) {
      return null;
    }

    return callWindowInstruction ?? 'Press Proceed to pass, or add matching tiles to claim.';
  }

  if ('AwaitingMahjong' in turnStage) {
    return `Waiting for ${turnStage.AwaitingMahjong.caller} to confirm Mahjong`;
  }

  return 'No actions available';
}

export function getInstructionText(
  phase: GamePhase,
  mySeat: Seat,
  callWindowInstruction?: string,
  hasSubmittedPass = false
): string | null {
  if (typeof phase === 'object' && phase !== null && 'Setup' in phase) {
    if (phase.Setup === 'RollingDice') {
      return mySeat === 'East' ? 'Roll dice to start the game' : 'Waiting for East to roll dice';
    }
    return 'Setting up game...';
  }

  if (typeof phase === 'object' && phase !== null && 'Charleston' in phase) {
    return getCharlestonInstructionText(phase.Charleston, hasSubmittedPass);
  }

  if (typeof phase === 'object' && phase !== null && 'Playing' in phase) {
    const stage = phase.Playing;
    if (typeof stage === 'object' && stage !== null) {
      return getPlayingInstructionText(stage, mySeat, callWindowInstruction);
    }
  }

  if (phase === 'WaitingForPlayers') {
    return 'Waiting for players to join';
  }

  if (typeof phase === 'object' && phase !== null && 'Scoring' in phase) {
    return 'Scoring hand...';
  }

  if (typeof phase === 'object' && phase !== null && 'GameOver' in phase) {
    return 'Game over';
  }

  return 'No actions available';
}

export function getCharlestonVoteWaitingMessage(
  votedPlayers: Seat[],
  totalPlayers = 4
): string | null {
  if (votedPlayers.length === 0 || votedPlayers.length >= totalPlayers) {
    return null;
  }

  const waitingSeats = (['East', 'South', 'West', 'North'] as const).filter(
    (seat) => !votedPlayers.includes(seat)
  );

  if (waitingSeats.length === 0) {
    return null;
  }

  return `Waiting for ${waitingSeats.join(', ')}...`;
}

export function getGameplayStatusText(turnStage: TurnStage, mySeat: Seat): string {
  if ('Drawing' in turnStage) {
    return turnStage.Drawing.player === mySeat
      ? 'Your turn — Drawing'
      : `${turnStage.Drawing.player}'s turn — Drawing`;
  }

  if ('Discarding' in turnStage) {
    return turnStage.Discarding.player === mySeat
      ? 'Your turn — Select a tile to discard'
      : `Waiting for ${turnStage.Discarding.player} to discard`;
  }

  if ('CallWindow' in turnStage) {
    return turnStage.CallWindow.can_act.includes(mySeat)
      ? 'Call window open — Call or Pass'
      : 'Call window open — Waiting for call resolution';
  }

  return 'Gameplay in progress';
}

export function getCharlestonStatusText(
  stage: CharlestonStage,
  options: {
    hasSubmittedVote: boolean;
    myVote?: CharlestonVote;
    votedPlayers: Seat[];
    totalPlayers?: number;
    botVoteMessage?: string;
  }
): string {
  const totalPlayers = options.totalPlayers ?? 4;

  if (stage === 'VotingToContinue') {
    if (options.botVoteMessage) {
      return options.botVoteMessage;
    }

    if (options.hasSubmittedVote && options.myVote) {
      return `You voted to ${options.myVote.toUpperCase()} — waiting for other players`;
    }

    const waitingMessage = getCharlestonVoteWaitingMessage(options.votedPlayers, totalPlayers);
    if (waitingMessage) {
      return waitingMessage;
    }

    if (options.votedPlayers.length > 0) {
      return `${options.votedPlayers.length}/${totalPlayers} players voted`;
    }

    return 'Charleston vote — Continue or stop';
  }

  if (stage === 'CourtesyAcross') {
    return 'Charleston — Courtesy pass';
  }

  const direction = getCharlestonDirectionLabel(stage);
  if (direction) {
    return `Charleston — Pass ${direction}`;
  }

  return 'Charleston in progress';
}
