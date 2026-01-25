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

export const useAnalysisStore = create<AnalysisState>((set) => ({
  hint: null,
  patterns: [],
  handStats: null,

  setHint: (hint) => set({ hint }),
  setPatterns: (patterns) => set({ patterns }),
  setHandStats: (handStats) => set({ handStats }),
}));

// Minimal hook selectors
export const useHint = () => useAnalysisStore((s) => s.hint);
export const useRecommendedDiscard = () =>
  useAnalysisStore((s) => s.hint?.recommended_discard ?? null);
export const useBestPatterns = () => useAnalysisStore((s) => s.hint?.best_patterns ?? []);
export const useTilesNeeded = () => useAnalysisStore((s) => s.hint?.tiles_needed_for_win ?? []);
export const useDistanceToWin = () =>
  useAnalysisStore((s) => s.hint?.distance_to_win ?? s.handStats?.distance_to_win ?? 14);
