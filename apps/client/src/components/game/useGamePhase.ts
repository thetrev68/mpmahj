import { useMemo } from 'react';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { SetupStage } from '@/types/bindings/generated/SetupStage';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';

/**
 * Derived game phase information and wall display values.
 * Computed from the server snapshot via useMemo.
 */
export interface GamePhaseInfo {
  /** True when the current phase is any Charleston sub-stage. */
  isCharleston: boolean;
  /** The current Charleston sub-stage, or undefined outside Charleston. */
  charlestonStage: CharlestonStage | undefined;
  /** True when the current phase is any Setup sub-stage. */
  isSetupPhase: boolean;
  /** The current Setup sub-stage, or null outside Setup. */
  setupStage: SetupStage | null;
  /** True when the current phase is Playing (any TurnStage). */
  isPlaying: boolean;
  /** The current TurnStage, or null outside Playing. */
  turnStage: TurnStage | null;
  /** True during Setup or Charleston — no tiles have been drawn from the wall yet. */
  isPrePlayPhase: boolean;
  /** True when the East seat player is a bot. */
  isEastBot: boolean;
  /** Total tiles in the game (152 standard, 160 with blank exchange). */
  totalTiles: number;
  /** Stacks per wall side at the start of the game. */
  stacksPerWallInitial: number;
  /** Stacks per wall side to display right now (full during pre-play, remaining during play). */
  stacksPerWallDisplay: number;
  /** Wall break point index, or undefined if not yet set. */
  wallBreakIndex: number | undefined;
  /** Current wall draw index, or undefined if no tiles drawn yet. */
  wallDrawIndex: number | undefined;
}

/**
 * Derives phase information and wall display values from the current game snapshot.
 * All values default to safe/empty state when gameState is null.
 */
export function useGamePhase(gameState: GameStateSnapshot | null): GamePhaseInfo {
  return useMemo(() => {
    if (!gameState) {
      return {
        isCharleston: false,
        charlestonStage: undefined,
        isSetupPhase: false,
        setupStage: null,
        isPlaying: false,
        turnStage: null,
        isPrePlayPhase: false,
        isEastBot: false,
        totalTiles: 152,
        stacksPerWallInitial: 19,
        stacksPerWallDisplay: 19,
        wallBreakIndex: undefined,
        wallDrawIndex: undefined,
      };
    }

    const { phase } = gameState;

    const isCharleston = typeof phase === 'object' && 'Charleston' in phase;
    const charlestonStage = isCharleston
      ? (phase as { Charleston: CharlestonStage }).Charleston
      : undefined;

    const isSetupPhase = typeof phase === 'object' && 'Setup' in phase;
    const setupStage = isSetupPhase ? (phase as { Setup: SetupStage }).Setup : null;

    const isPlaying = typeof phase === 'object' && 'Playing' in phase;
    const turnStage = isPlaying ? (phase as { Playing: TurnStage }).Playing : null;

    const isPrePlayPhase = isCharleston || isSetupPhase;

    const isEastBot = gameState.players.find((p) => p.seat === 'East')?.is_bot ?? false;

    const includeBlanks = gameState.house_rules.ruleset.blank_exchange_enabled;
    const totalTiles = includeBlanks ? 160 : 152;
    // Each wall side = 1/4 of total tiles, each stack = 2 tiles
    const stacksPerWallInitial = totalTiles / 8;
    const totalStacksRemaining = Math.max(0, Math.ceil(gameState.wall_tiles_remaining / 2));
    const stacksPerWallRemaining = Math.max(0, Math.floor(totalStacksRemaining / 4));
    // During Setup/Charleston no tiles have been drawn — show the full initial wall
    const stacksPerWallDisplay = isPrePlayPhase ? stacksPerWallInitial : stacksPerWallRemaining;

    const wallBreakIndex = gameState.wall_break_point > 0 ? gameState.wall_break_point : undefined;
    const wallDrawIndex = gameState.wall_draw_index > 0 ? gameState.wall_draw_index : undefined;

    return {
      isCharleston,
      charlestonStage,
      isSetupPhase,
      setupStage,
      isPlaying,
      turnStage,
      isPrePlayPhase,
      isEastBot,
      totalTiles,
      stacksPerWallInitial,
      stacksPerWallDisplay,
      wallBreakIndex,
      wallDrawIndex,
    };
  }, [gameState]);
}
