import { vi } from 'vitest';

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
  send: ReturnType<typeof vi.fn>;
  /** Closes the mock connection and updates `readyState`. */
  close: ReturnType<typeof vi.fn>;
  /**
   * Registers an event listener for the mock socket.
   * Mirrors the WebSocket `addEventListener` API.
   */
  addEventListener: (event: string, handler: (event: unknown) => void) => void;
  /**
   * Removes an event listener for the mock socket.
   * Mirrors the WebSocket `removeEventListener` API.
   */
  removeEventListener: (event: string, handler: (event: unknown) => void) => void;
  /** Current readyState (CONNECTING/OPEN/CLOSING/CLOSED). */
  readyState: number;
  /** Socket URL associated with the mock instance. */
  url: string;
  /** Triggers a synthetic `open` event. */
  triggerOpen: () => void;
  /** Triggers a synthetic `message` event with provided data. */
  triggerMessage: (data: string | object) => void;
  /** Triggers a synthetic `error` event. */
  triggerError: (error?: Error) => void;
  /** Triggers a synthetic `close` event with optional code/reason. */
  triggerClose: (code?: number, reason?: string) => void;
}

/**
 * Creates an isolated mock WebSocket instance with event hooks.
 * Use this in tests where you manually trigger open/message/error/close events.
 */
export function createMockWebSocket(url = 'ws://localhost:3000/ws'): MockWebSocket {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const listeners: Record<string, Set<(event: any) => void>> = {
    open: new Set(),
    message: new Set(),
    error: new Set(),
    close: new Set(),
  };

  const mockWs: MockWebSocket = {
    send: vi.fn(),
    close: vi.fn(() => {
      mockWs.readyState = WebSocket.CLOSED;
    }),
    addEventListener: vi.fn((event: string, handler: (event: unknown) => void) => {
      listeners[event]?.add(handler);
    }) as MockWebSocket['addEventListener'],
    removeEventListener: vi.fn((event: string, handler: (event: unknown) => void) => {
      listeners[event]?.delete(handler);
    }) as MockWebSocket['removeEventListener'],
    readyState: WebSocket.CONNECTING,
    url,
    triggerOpen: () => {
      mockWs.readyState = WebSocket.OPEN;
      listeners.open.forEach((handler) => handler({ type: 'open', target: mockWs }));
    },
    triggerMessage: (data: string | object) => {
      const messageData = typeof data === 'string' ? data : JSON.stringify(data);
      listeners.message.forEach((handler) =>
        handler({ type: 'message', data: messageData, target: mockWs })
      );
    },
    triggerError: (error = new Error('WebSocket error')) => {
      listeners.error.forEach((handler) => handler({ type: 'error', error, target: mockWs }));
    },
    triggerClose: (code = 1000, reason = 'Normal closure') => {
      mockWs.readyState = WebSocket.CLOSED;
      listeners.close.forEach((handler) =>
        handler({ type: 'close', code, reason, target: mockWs })
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

  // @ts-expect-error - Replacing global WebSocket for testing
  global.WebSocket = WebSocketMock as unknown as typeof WebSocket;

  return mockWs;
}
