import { act } from '@testing-library/react';
import type { StoreApi, UseBoundStore } from 'zustand';

/**
 * Create a mock Zustand store for testing
 *
 * This utility helps test Zustand stores in isolation by providing
 * methods to reset state, subscribe to changes, and manipulate state.
 *
 * Usage:
 * ```tsx
 * import { create } from 'zustand';
 * import { createMockStore } from '@/test/mocks/zustand';
 *
 * const useGameStore = create<GameState>((set) => ({
 *   tiles: [],
 *   addTile: (tile) => set((state) => ({ tiles: [...state.tiles, tile] })),
 * }));
 *
 * describe('GameStore', () => {
 *   const mockStore = createMockStore(useGameStore);
 *
 *   beforeEach(() => {
 *     mockStore.reset();
 *   });
 *
 *   test('adds a tile', () => {
 *     const { addTile } = mockStore.getState();
 *     addTile('Bam1');
 *     expect(mockStore.getState().tiles).toHaveLength(1);
 *   });
 * });
 * ```
 */
export function createMockStore<T>(useStore: UseBoundStore<StoreApi<T>>): MockStore<T> {
  const initialState = useStore.getState();

  return {
    getState: () => useStore.getState(),
    setState: (partial: Partial<T> | ((state: T) => Partial<T>)) => {
      act(() => {
        if (typeof partial === 'function') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          useStore.setState(partial as any);
        } else {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          useStore.setState(partial as any);
        }
      });
    },
    reset: () => {
      act(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        useStore.setState(initialState as any, true);
      });
    },
    subscribe: (listener: (state: T, prevState: T) => void) => {
      return useStore.subscribe(listener);
    },
  };
}

export interface MockStore<T> {
  /** Get current state */
  getState: () => T;
  /** Set state (partial or function) */
  setState: (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
  /** Reset to initial state */
  reset: () => void;
  /** Subscribe to state changes */
  subscribe: (listener: (state: T, prevState: T) => void) => () => void;
}

/**
 * Wait for Zustand store to update
 *
 * Useful when testing async actions that update the store.
 *
 * Usage:
 * ```tsx
 * test('async action updates store', async () => {
 *   const { fetchData } = useStore.getState();
 *
 *   fetchData();
 *
 *   await waitForStoreUpdate(useStore, (state) => state.loading === false);
 *
 *   expect(useStore.getState().data).toBeDefined();
 * });
 * ```
 */
export function waitForStoreUpdate<T>(
  useStore: UseBoundStore<StoreApi<T>>,
  condition: (state: T) => boolean,
  timeout = 5000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      unsubscribe();
      reject(new Error('Store update timeout'));
    }, timeout);

    const unsubscribe = useStore.subscribe((state) => {
      if (condition(state)) {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve();
      }
    });

    // Check if condition is already met
    if (condition(useStore.getState())) {
      clearTimeout(timeoutId);
      unsubscribe();
      resolve();
    }
  });
}

/**
 * Capture store state changes for testing
 *
 * Returns an array of all state snapshots during the test.
 *
 * Usage:
 * ```tsx
 * test('tracks state changes', () => {
 *   const history = captureStoreHistory(useStore);
 *
 *   useStore.getState().increment();
 *   useStore.getState().increment();
 *
 *   expect(history.snapshots).toHaveLength(3); // initial + 2 updates
 *   expect(history.snapshots[2].count).toBe(2);
 *
 *   history.stop();
 * });
 * ```
 */
export function captureStoreHistory<T>(useStore: UseBoundStore<StoreApi<T>>): StoreHistory<T> {
  const snapshots: T[] = [useStore.getState()];

  const unsubscribe = useStore.subscribe((state) => {
    snapshots.push(state);
  });

  return {
    snapshots,
    stop: unsubscribe,
  };
}

export interface StoreHistory<T> {
  /** Array of state snapshots */
  snapshots: T[];
  /** Stop capturing */
  stop: () => void;
}

/**
 * Mock a specific action in a Zustand store
 *
 * Useful for isolating tests from implementation details.
 *
 * Usage:
 * ```tsx
 * test('handles action', () => {
 *   const mockAction = vi.fn();
 *   mockStoreAction(useStore, 'fetchData', mockAction);
 *
 *   // Component calls fetchData
 *   render(<MyComponent />);
 *
 *   expect(mockAction).toHaveBeenCalled();
 * });
 * ```
 */
export function mockStoreAction<T, K extends keyof T>(
  useStore: UseBoundStore<StoreApi<T>>,
  actionName: K,
  mockFn: T[K]
): () => void {
  const original = useStore.getState()[actionName];

  act(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useStore.setState({ [actionName]: mockFn } as any);
  });

  // Return cleanup function
  return () => {
    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      useStore.setState({ [actionName]: original } as any);
    });
  };
}
