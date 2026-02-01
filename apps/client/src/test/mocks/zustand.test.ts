import { describe, expect, test, beforeEach, vi } from 'vitest';
import {
  createMockStore,
  waitForStoreUpdate,
  captureStoreHistory,
  mockStoreAction,
} from './zustand';
import { useExampleStore } from './example-store';

/**
 * Demonstrates testing patterns for Zustand stores
 *
 * These tests show how to:
 * 1. Test synchronous actions
 * 2. Test asynchronous actions
 * 3. Track state changes
 * 4. Mock specific actions
 * 5. Test subscriptions
 */
describe('Zustand Store Testing', () => {
  const mockStore = createMockStore(useExampleStore);

  beforeEach(() => {
    mockStore.reset();
  });

  describe('Synchronous Actions', () => {
    test('increments count', () => {
      const { increment } = mockStore.getState();

      increment();

      expect(mockStore.getState().count).toBe(1);
    });

    test('decrements count', () => {
      const { increment, decrement } = mockStore.getState();

      increment();
      increment();
      decrement();

      expect(mockStore.getState().count).toBe(1);
    });

    test('resets to initial state', () => {
      const { increment, addTile, reset } = mockStore.getState();

      increment();
      addTile('Bam1');

      reset();

      expect(mockStore.getState()).toEqual({
        count: 0,
        tiles: [],
        loading: false,
        error: null,
        increment: expect.any(Function),
        decrement: expect.any(Function),
        reset: expect.any(Function),
        addTile: expect.any(Function),
        removeTile: expect.any(Function),
        setLoading: expect.any(Function),
        setError: expect.any(Function),
        fetchData: expect.any(Function),
      });
    });

    test('adds tiles', () => {
      const { addTile } = mockStore.getState();

      addTile('Bam1');
      addTile('Bam2');

      expect(mockStore.getState().tiles).toEqual(['Bam1', 'Bam2']);
    });

    test('removes tiles', () => {
      const { addTile, removeTile } = mockStore.getState();

      addTile('Bam1');
      addTile('Bam2');
      addTile('Bam3');
      removeTile('Bam2');

      expect(mockStore.getState().tiles).toEqual(['Bam1', 'Bam3']);
    });
  });

  describe('Asynchronous Actions', () => {
    test('fetches data successfully', async () => {
      const { fetchData } = mockStore.getState();

      const fetchPromise = fetchData();

      // Loading should be true immediately
      expect(mockStore.getState().loading).toBe(true);

      await fetchPromise;

      // After completion
      expect(mockStore.getState().loading).toBe(false);
      expect(mockStore.getState().tiles).toEqual(['Bam1', 'Bam2', 'Bam3']);
      expect(mockStore.getState().error).toBeNull();
    });

    test('waits for specific state condition', async () => {
      const { fetchData } = mockStore.getState();

      fetchData();

      // Wait until loading is false
      await waitForStoreUpdate(
        useExampleStore,
        (state) => state.loading === false
      );

      expect(mockStore.getState().tiles).toHaveLength(3);
    });
  });

  describe('State History Tracking', () => {
    test('captures all state changes', () => {
      const history = captureStoreHistory(useExampleStore);

      const { increment, addTile } = mockStore.getState();

      increment();
      increment();
      addTile('Bam1');

      expect(history.snapshots).toHaveLength(4); // initial + 3 updates

      expect(history.snapshots[0].count).toBe(0);
      expect(history.snapshots[1].count).toBe(1);
      expect(history.snapshots[2].count).toBe(2);
      expect(history.snapshots[3].tiles).toContain('Bam1');

      history.stop();
    });

    test('tracks state evolution', () => {
      const history = captureStoreHistory(useExampleStore);

      const { increment, decrement } = mockStore.getState();

      increment();
      increment();
      increment();
      decrement();

      const counts = history.snapshots.map((s) => s.count);
      expect(counts).toEqual([0, 1, 2, 3, 2]);

      history.stop();
    });
  });

  describe('Action Mocking', () => {
    test('mocks specific action', () => {
      const mockFetch = vi.fn();
      const cleanup = mockStoreAction(useExampleStore, 'fetchData', mockFetch);

      const { fetchData } = mockStore.getState();
      fetchData();

      expect(mockFetch).toHaveBeenCalled();

      cleanup();
    });

    test('restores original action after cleanup', () => {
      const originalFetch = mockStore.getState().fetchData;
      const mockFetch = vi.fn();

      const cleanup = mockStoreAction(useExampleStore, 'fetchData', mockFetch);

      expect(mockStore.getState().fetchData).toBe(mockFetch);

      cleanup();

      expect(mockStore.getState().fetchData).toBe(originalFetch);
    });
  });

  describe('State Manipulation', () => {
    test('sets state directly', () => {
      mockStore.setState({ count: 42 });

      expect(mockStore.getState().count).toBe(42);
    });

    test('sets state with function', () => {
      mockStore.setState((state) => ({ count: state.count + 10 }));

      expect(mockStore.getState().count).toBe(10);
    });

    test('sets multiple properties', () => {
      mockStore.setState({
        count: 5,
        tiles: ['Bam1', 'Bam2'],
        loading: true,
      });

      expect(mockStore.getState().count).toBe(5);
      expect(mockStore.getState().tiles).toEqual(['Bam1', 'Bam2']);
      expect(mockStore.getState().loading).toBe(true);
    });
  });

  describe('Subscriptions', () => {
    test('subscribes to state changes', () => {
      const listener = vi.fn();
      const unsubscribe = mockStore.subscribe(listener);

      const { increment } = mockStore.getState();
      increment();

      expect(listener).toHaveBeenCalledWith(
        expect.objectContaining({ count: 1 }),
        expect.objectContaining({ count: 0 })
      );

      unsubscribe();
    });

    test('unsubscribes correctly', () => {
      const listener = vi.fn();
      const unsubscribe = mockStore.subscribe(listener);

      const { increment } = mockStore.getState();
      increment();

      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();

      increment();

      // Should not be called again
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });
});
