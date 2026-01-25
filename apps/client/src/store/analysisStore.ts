import { create } from 'zustand';
import type { HintData } from '@/types/bindings/generated/HintData';
import type { PatternAnalysis } from '@/types/bindings/generated/PatternAnalysis';

interface HandStats {
  distance_to_win: number;
  viable_count: number;
  impossible_count: number;
}

interface AnalysisState {
  hint: HintData | null;
  patterns: PatternAnalysis[];
  handStats: HandStats | null;

  setHint: (hint: HintData | null) => void;
  setPatterns: (patterns: PatternAnalysis[]) => void;
  setHandStats: (stats: HandStats | null) => void;
}

const analysisStore = create<AnalysisState>((set) => ({
  hint: null,
  patterns: [],
  handStats: null,

  setHint: (hint) => set({ hint }),
  setPatterns: (patterns) => set({ patterns }),
  setHandStats: (handStats) => set({ handStats }),
}));

// Minimal hook selectors
export const useHint = () => analysisStore((s) => s.hint);
export const useRecommendedDiscard = () =>
  analysisStore((s) => s.hint?.recommended_discard ?? null);
export const useBestPatterns = () => analysisStore((s) => s.hint?.best_patterns ?? []);
export const useDistanceToWin = () =>
  analysisStore((s) => s.hint?.distance_to_win ?? s.handStats?.distance_to_win ?? 14);

// Internal accessors for wiring events (to be used where needed)
export const setHint = (hint: HintData | null) => analysisStore.getState().setHint(hint);
export const setPatterns = (patterns: PatternAnalysis[]) =>
  analysisStore.getState().setPatterns(patterns);
export const setHandStats = (stats: HandStats | null) =>
  analysisStore.getState().setHandStats(stats);
