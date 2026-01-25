import { create } from 'zustand';
import type { HintData } from '@/types/bindings/generated/HintData';
import type { PatternAnalysis } from '@/types/bindings/generated/PatternAnalysis';
import type { PatternSummary } from '@/types/bindings/generated/PatternSummary';
import type { HintVerbosity } from '@/types/bindings/generated/HintVerbosity';
import type { Tile } from '@/types/bindings/generated/Tile';

interface HandStats {
  distance_to_win: number;
  viable_count: number;
  impossible_count: number;
}

export type HintSource = 'Beginner' | 'Intermediate' | 'Expert';

interface AnalysisState {
  hint: HintData | null;
  patterns: PatternAnalysis[];
  handStats: HandStats | null;

  // Multi-hint testing support
  hintsBySource: Partial<Record<HintSource, HintData>>;
  pendingHintRequests: HintVerbosity[];

  setHint: (hint: HintData | null) => void;
  setPatterns: (patterns: PatternAnalysis[]) => void;
  setHandStats: (stats: HandStats | null) => void;
  setHintForSource: (source: HintSource, hint: HintData) => void;
  enqueuePendingRequest: (verbosity: HintVerbosity) => void;
  dequeuePendingRequest: () => HintVerbosity | null;
  clearPendingRequests: () => void;
}

const analysisStore = create<AnalysisState>((set, get) => ({
  hint: null,
  patterns: [],
  handStats: null,
  hintsBySource: {},
  pendingHintRequests: [],

  setHint: (hint) => set({ hint }),
  setPatterns: (patterns) => set({ patterns }),
  setHandStats: (handStats) => set({ handStats }),
  setHintForSource: (source, hint) =>
    set((state) => ({
      hintsBySource: { ...state.hintsBySource, [source]: hint },
    })),
  enqueuePendingRequest: (verbosity) =>
    set((state) => ({
      pendingHintRequests: [...state.pendingHintRequests, verbosity],
    })),
  dequeuePendingRequest: () => {
    const queue = get().pendingHintRequests;
    if (queue.length === 0) return null;
    const [first, ...rest] = queue;
    set({ pendingHintRequests: rest });
    return first;
  },
  clearPendingRequests: () => set({ pendingHintRequests: [] }),
}));

// Stable empty arrays to prevent infinite re-renders
const EMPTY_PATTERN_SUMMARIES: PatternSummary[] = [];
const EMPTY_TILES: Tile[] = [];

// Minimal hook selectors
export const useHint = () => analysisStore((s) => s.hint);
export const usePatterns = () => analysisStore((s) => s.patterns);
export const useHandStats = () => analysisStore((s) => s.handStats);
export const useRecommendedDiscard = () =>
  analysisStore((s) => s.hint?.recommended_discard ?? null);
export const useBestPatterns = (): PatternSummary[] =>
  analysisStore((s) => s.hint?.best_patterns ?? EMPTY_PATTERN_SUMMARIES);
const useDistanceToWin = () =>
  analysisStore((s) => s.hint?.distance_to_win ?? s.handStats?.distance_to_win ?? 14);
export const useTilesNeeded = (): Tile[] => {
  const hint = useHint();
  const distance = useDistanceToWin();
  // Only show tiles needed when close to winning (distance <= 2)
  return distance <= 2 ? (hint?.tiles_needed_for_win ?? EMPTY_TILES) : EMPTY_TILES;
};

// Multi-hint testing selectors
export const useHintsBySource = () => analysisStore((s) => s.hintsBySource);

// Internal accessors for wiring events (to be used where needed)
// Event wiring will call analysisStore.getState().setHint / setPatterns / setHandStats directly when added.
export { analysisStore };
