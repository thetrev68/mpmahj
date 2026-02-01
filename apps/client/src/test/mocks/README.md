# Test Mocks

This directory contains mock implementations for testing.

## Available Mocks

### WebSocket Mock ([websocket.ts](./websocket.ts))

Mock WebSocket for testing network interactions.

**Usage:**

```tsx
import { createMockWebSocket } from '@/test/mocks/websocket';

test('handles websocket connection', () => {
  const mockWs = createMockWebSocket();

  mockWs.triggerOpen();
  mockWs.triggerMessage({ type: 'GameStarted' });

  expect(mockWs.send).toHaveBeenCalled();
});
```

**Global mock:**

```tsx
import { mockWebSocketGlobal } from '@/test/mocks/websocket';

beforeEach(() => {
  const mockWs = mockWebSocketGlobal();
  // All new WebSocket() calls return mockWs
});
```

### Zustand Store Mock ([zustand.ts](./zustand.ts))

Utilities for testing Zustand stores.

#### 1. Create Mock Store

```tsx
import { createMockStore } from '@/test/mocks/zustand';
import { useGameStore } from '@/stores/gameStore';

describe('GameStore', () => {
  const mockStore = createMockStore(useGameStore);

  beforeEach(() => {
    mockStore.reset();
  });

  test('updates state', () => {
    const { addTile } = mockStore.getState();
    addTile('Bam1');
    expect(mockStore.getState().tiles).toHaveLength(1);
  });
});
```

#### 2. Wait for Store Update

```tsx
import { waitForStoreUpdate } from '@/test/mocks/zustand';

test('async action completes', async () => {
  const { fetchData } = useStore.getState();

  fetchData();

  await waitForStoreUpdate(useStore, (state) => state.loading === false);

  expect(useStore.getState().data).toBeDefined();
});
```

#### 3. Capture State History

```tsx
import { captureStoreHistory } from '@/test/mocks/zustand';

test('tracks state changes', () => {
  const history = captureStoreHistory(useStore);

  useStore.getState().increment();
  useStore.getState().increment();

  expect(history.snapshots).toHaveLength(3); // initial + 2 updates
  expect(history.snapshots[2].count).toBe(2);

  history.stop();
});
```

#### 4. Mock Specific Action

```tsx
import { mockStoreAction } from '@/test/mocks/zustand';
import { vi } from 'vitest';

test('mocks action', () => {
  const mockFetch = vi.fn();
  const cleanup = mockStoreAction(useStore, 'fetchData', mockFetch);

  useStore.getState().fetchData();

  expect(mockFetch).toHaveBeenCalled();

  cleanup(); // Restore original
});
```

## Example Store

See [example-store.ts](./example-store.ts) for a complete example of a testable Zustand store with:

- Synchronous actions (increment, decrement, add/remove items)
- Asynchronous actions (fetchData)
- Error handling
- Loading states
- Immer middleware for immutable updates

## Testing Patterns

### Pattern 1: Test Synchronous Actions

```tsx
test('synchronous action', () => {
  const mockStore = createMockStore(useStore);

  const { increment } = mockStore.getState();
  increment();

  expect(mockStore.getState().count).toBe(1);
});
```

### Pattern 2: Test Asynchronous Actions

```tsx
test('async action', async () => {
  const mockStore = createMockStore(useStore);

  const { fetchData } = mockStore.getState();
  await fetchData();

  expect(mockStore.getState().loading).toBe(false);
  expect(mockStore.getState().data).toBeDefined();
});
```

### Pattern 3: Test State Evolution

```tsx
test('state evolution', () => {
  const history = captureStoreHistory(useStore);

  useStore.getState().start();
  useStore.getState().progress();
  useStore.getState().complete();

  expect(history.snapshots.map((s) => s.status)).toEqual([
    'idle',
    'started',
    'in_progress',
    'completed',
  ]);

  history.stop();
});
```

### Pattern 4: Test Error Handling

```tsx
test('handles errors', async () => {
  const mockStore = createMockStore(useStore);

  // Mock a failing API call
  global.fetch = vi.fn(() => Promise.reject(new Error('API Error')));

  const { fetchData } = mockStore.getState();
  await fetchData();

  expect(mockStore.getState().error).toBe('API Error');
  expect(mockStore.getState().loading).toBe(false);
});
```

### Pattern 5: Test Subscriptions

```tsx
test('notifies subscribers', () => {
  const listener = vi.fn();
  const unsubscribe = useStore.subscribe(listener);

  useStore.getState().increment();

  expect(listener).toHaveBeenCalledWith(
    expect.objectContaining({ count: 1 }),
    expect.objectContaining({ count: 0 })
  );

  unsubscribe();
});
```

## Best Practices

1. **Always reset state between tests** - Use `mockStore.reset()` in `beforeEach()`
2. **Test behavior, not implementation** - Focus on state changes, not internal logic
3. **Use async helpers for async actions** - Use `waitForStoreUpdate()` for async tests
4. **Clean up subscriptions** - Always call `unsubscribe()` or `history.stop()`
5. **Mock external dependencies** - Mock API calls, timers, WebSockets, etc.
6. **Test error paths** - Don't just test happy paths
7. **Use fixtures for complex state** - Don't hardcode large state objects

## See Also

- [zustand.test.ts](./zustand.test.ts) - Complete test examples
- [example-store.ts](./example-store.ts) - Example store implementation
- [Test utilities](../test-utils.tsx) - General testing utilities
