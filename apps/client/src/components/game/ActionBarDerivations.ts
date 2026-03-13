import { CHARLESTON_PASS_COUNT } from '@/lib/constants';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { Seat } from '@/types/bindings/generated/Seat';

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
  return courtesyPassCount !== undefined && selectedTilesCount === courtesyPassCount && !isBusy;
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

export function getInstructionText(
  phase: GamePhase,
  mySeat: Seat,
  selectedCount: number,
  courtesyPassCount?: number,
  callWindowInstruction?: string
): string {
  if (typeof phase === 'object' && phase !== null && 'Setup' in phase) {
    if (phase.Setup === 'RollingDice') {
      return mySeat === 'East' ? 'Roll dice to start the game' : 'Waiting for East to roll dice';
    }
    return 'Setting up game...';
  }

  if (typeof phase === 'object' && phase !== null && 'Charleston' in phase) {
    if (phase.Charleston === 'CourtesyAcross') {
      const n = courtesyPassCount ?? selectedCount;
      return `Courtesy pass. Select ${n} ${n === 1 ? 'tile' : 'tiles'} for your across partner, then press Proceed.`;
    }

    if (phase.Charleston === 'VotingToContinue') {
      return 'Round vote. Stage 3 tiles to continue. Stage 0 tiles to stop. Press Proceed when ready.';
    }

    if (phase.Charleston === 'FirstLeft' || phase.Charleston === 'SecondRight') {
      return 'Charleston Blind Pass: Choose 3 tiles to pass using your rack, the blind incoming tiles, or both. Then press Proceed.';
    }

    const direction = getCharlestonDirectionLabel(phase.Charleston);
    if (direction) {
      return `Charleston. Select ${CHARLESTON_PASS_COUNT} tiles to pass ${direction}, then press Proceed.`;
    }

    return 'Charleston. Stage tiles, then press Proceed.';
  }

  if (typeof phase === 'object' && phase !== null && 'Playing' in phase) {
    const stage = phase.Playing;
    if (typeof stage === 'object' && stage !== null) {
      if ('Drawing' in stage) {
        return 'Drawing tile...';
      }

      if ('Discarding' in stage) {
        return stage.Discarding.player === mySeat
          ? 'Select 1 tile to discard, then press Proceed. If you are Mahjong, press Mahjong.'
          : `Waiting for ${stage.Discarding.player} to discard.`;
      }

      if ('CallWindow' in stage) {
        return (
          callWindowInstruction ??
          'Press Proceed to skip, or stage matching tiles and press Proceed to claim. Mahjong stays separate.'
        );
      }

      if ('AwaitingMahjong' in stage) {
        return `Waiting for ${stage.AwaitingMahjong.caller} to confirm Mahjong`;
      }
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
