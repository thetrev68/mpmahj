import { CHARLESTON_PASS_COUNT } from '@/lib/constants';
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

export function getInstructionText(
  phase: GamePhase,
  mySeat: Seat,
  selectedCount: number,
  courtesyPassCount?: number
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
      return `Select ${n} ${n === 1 ? 'tile' : 'tiles'} for courtesy pass`;
    }
    return 'Select 3 tiles to pass';
  }

  if (typeof phase === 'object' && phase !== null && 'Playing' in phase) {
    const stage = phase.Playing;
    if (typeof stage === 'object' && stage !== null) {
      if ('Drawing' in stage) {
        return 'Drawing tile...';
      }

      if ('Discarding' in stage) {
        return stage.Discarding.player === mySeat
          ? 'Select a tile to discard'
          : `${stage.Discarding.player}'s turn to discard`;
      }

      if ('CallWindow' in stage) {
        return 'Choose a call or pass';
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
