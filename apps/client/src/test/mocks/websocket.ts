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
  send: ReturnType<typeof vi.fn>;
  close: ReturnType<typeof vi.fn>;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  readyState: number;
  url: string;
  triggerOpen: () => void;
  triggerMessage: (data: string | object) => void;
  triggerError: (error?: Error) => void;
  triggerClose: (code?: number, reason?: string) => void;
}

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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    addEventListener: vi.fn((event: string, handler: (event: any) => void) => {
      listeners[event]?.add(handler);
    }),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    removeEventListener: vi.fn((event: string, handler: (event: any) => void) => {
      listeners[event]?.delete(handler);
    }),
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

  // @ts-expect-error - Replacing global WebSocket for testing
  global.WebSocket = vi.fn(() => mockWs);

  return mockWs;
}
