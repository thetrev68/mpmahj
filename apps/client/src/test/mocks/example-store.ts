import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

/**
 * Example store for testing demonstrations
 *
 * This is NOT a production store - it's here to demonstrate
 * testing patterns. Real stores will live in src/stores/
 */

interface ExampleState {
  count: number;
  tiles: string[];
  loading: boolean;
  error: string | null;
}

interface ExampleActions {
  increment: () => void;
  decrement: () => void;
  reset: () => void;
  addTile: (tile: string) => void;
  removeTile: (tile: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  fetchData: () => Promise<void>;
}

type ExampleStore = ExampleState & ExampleActions;

const initialState: ExampleState = {
  count: 0,
  tiles: [],
  loading: false,
  error: null,
};

export const useExampleStore = create<ExampleStore>()(
  immer((set) => ({
    ...initialState,

    increment: () =>
      set((state) => {
        state.count += 1;
      }),

    decrement: () =>
      set((state) => {
        state.count -= 1;
      }),

    reset: () => set(initialState),

    addTile: (tile: string) =>
      set((state) => {
        state.tiles.push(tile);
      }),

    removeTile: (tile: string) =>
      set((state) => {
        state.tiles = state.tiles.filter((t) => t !== tile);
      }),

    setLoading: (loading: boolean) =>
      set((state) => {
        state.loading = loading;
      }),

    setError: (error: string | null) =>
      set((state) => {
        state.error = error;
      }),

    fetchData: async () => {
      set((state) => {
        state.loading = true;
        state.error = null;
      });

      try {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 100));

        set((state) => {
          state.tiles = ['Bam1', 'Bam2', 'Bam3'];
          state.loading = false;
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Unknown error';
          state.loading = false;
        });
      }
    },
  }))
);
