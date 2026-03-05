import { vi, type Mock } from 'vitest';

function stringifyMessageData(data: object): string {
  return JSON.stringify(data, (_key, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value
  );
}

/**
 * Mock WebSocket for testing
 *
 * Usage:
 * ```tsx
 * import { createMockWebSocket } from '@/test/mocks/websocket';
 *
 * test('handles websocket connection', () => {
 *   const mockWs = createMockWebSocket();
 *   // ... test code
 *   expect(mockWs.send).toHaveBeenCalled();
 * });
 * ```
 */
export interface MockWebSocket {
  /** Records outbound messages sent by the client. */
  readonly send: Mock<(data: string) => void>;
  /** Closes the mock connection and updates `readyState`. */
  readonly close: Mock<() => void>;
  /**
   * Registers an event listener for the mock socket.
   * Mirrors the WebSocket `addEventListener` API.
   */
  readonly addEventListener: (event: string, handler: (e: MessageEvent) => void) => void;
  /**
   * Removes an event listener for the mock socket.
   * Mirrors the WebSocket `removeEventListener` API.
   */
  readonly removeEventListener: (event: string, handler: (e: MessageEvent) => void) => void;
  /** Current readyState (CONNECTING/OPEN/CLOSING/CLOSED). Mutated by trigger methods. */
  readyState: number;
  /** Socket URL associated with the mock instance. Mutated when the constructor is called. */
  url: string;
  /** Triggers a synthetic `open` event. */
  readonly triggerOpen: () => void;
  /** Triggers a synthetic `message` event with provided data. */
  readonly triggerMessage: (data: string | object) => void;
  /** Triggers a synthetic `error` event. */
  readonly triggerError: (error?: Error) => void;
  /** Triggers a synthetic `close` event with optional code/reason. */
  readonly triggerClose: (code?: number, reason?: string) => void;
}

/**
 * Creates an isolated mock WebSocket instance with event hooks.
 * Use this in tests where you manually trigger open/message/error/close events.
 */
export function createMockWebSocket(url = 'ws://localhost:3000/ws'): MockWebSocket {
  // Each event type carries a different payload shape (Event, MessageEvent, CloseEvent, etc.).
  // The polymorphic listener map must hold all of them under a single index signature.
  // Using `Event` as the base keeps this as narrow as possible while still being accurate —
  // every WebSocket event type extends the DOM Event interface.
  const listeners: Record<string, Set<(event: Event) => void>> = {
    open: new Set(),
    message: new Set(),
    error: new Set(),
    close: new Set(),
  };

  const mockWs: MockWebSocket = {
    send: vi.fn<(data: string) => void>(),
    close: vi.fn<() => void>(() => {
      mockWs.readyState = WebSocket.CLOSED;
    }),
    addEventListener: vi.fn((event: string, handler: (e: MessageEvent) => void) => {
      // Cast handler to the base Event type accepted by the listener map.
      listeners[event]?.add(handler as (event: Event) => void);
    }) as MockWebSocket['addEventListener'],
    removeEventListener: vi.fn((event: string, handler: (e: MessageEvent) => void) => {
      listeners[event]?.delete(handler as (event: Event) => void);
    }) as MockWebSocket['removeEventListener'],
    readyState: WebSocket.CONNECTING,
    url,
    triggerOpen: () => {
      mockWs.readyState = WebSocket.OPEN;
      // Synthetic open events are plain objects; cast to Event for the listener contract.
      listeners.open.forEach((handler) =>
        handler({ type: 'open', target: mockWs } as unknown as Event)
      );
    },
    triggerMessage: (data: string | object) => {
      const messageData = typeof data === 'string' ? data : stringifyMessageData(data);
      // Synthetic message events carry a `data` payload; cast to MessageEvent.
      listeners.message.forEach((handler) =>
        handler({ type: 'message', data: messageData, target: mockWs } as unknown as MessageEvent)
      );
    },
    triggerError: (error = new Error('WebSocket error')) => {
      listeners.error.forEach((handler) =>
        handler({ type: 'error', error, target: mockWs } as unknown as Event)
      );
    },
    triggerClose: (code = 1000, reason = 'Normal closure') => {
      mockWs.readyState = WebSocket.CLOSED;
      listeners.close.forEach((handler) =>
        handler({ type: 'close', code, reason, target: mockWs } as unknown as Event)
      );
    },
  };

  return mockWs;
}

/**
 * Mock WebSocket constructor for global replacement
 *
 * Usage:
 * ```tsx
 * import { mockWebSocketGlobal } from '@/test/mocks/websocket';
 *
 * beforeEach(() => {
 *   const mockWs = mockWebSocketGlobal();
 *   // mockWs is automatically returned when new WebSocket() is called
 * });
 * ```
 */
export function mockWebSocketGlobal(): MockWebSocket {
  const mockWs = createMockWebSocket();

  /**
   * Constructable mock to satisfy `new WebSocket(url)` calls.
   * Updates the mock URL and returns the shared mock instance.
   */
  const WebSocketMock = vi.fn(function (this: WebSocket, url: string) {
    mockWs.url = url;
    return mockWs as unknown as WebSocket;
  });

  // Add WebSocket static constants so code that reads WebSocket.OPEN etc. works.
  Object.assign(WebSocketMock, { CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3 });

  // Replace both global and window WebSocket for testing.
  // @ts-expect-error - Replacing global WebSocket for testing
  global.WebSocket = WebSocketMock as unknown as typeof WebSocket;
  window.WebSocket = WebSocketMock as unknown as typeof WebSocket;

  return mockWs;
}
