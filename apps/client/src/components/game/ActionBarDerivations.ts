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
