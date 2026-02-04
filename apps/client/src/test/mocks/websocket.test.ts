/**
 * Tests for the WebSocket mock utilities used by client-side tests.
 */
import { describe, expect, test, vi } from 'vitest';
import type { MockWebSocket } from './websocket';
import { createMockWebSocket, mockWebSocketGlobal } from './websocket';

describe('Mock WebSocket', () => {
  test('createMockWebSocket triggers events to listeners', () => {
    const mockWs: MockWebSocket = createMockWebSocket();

    const onOpen = vi.fn();
    const onMessage = vi.fn();
    const onError = vi.fn();
    const onClose = vi.fn();

    mockWs.addEventListener('open', onOpen);
    mockWs.addEventListener('message', onMessage);
    mockWs.addEventListener('error', onError);
    mockWs.addEventListener('close', onClose);

    mockWs.triggerOpen();
    mockWs.triggerMessage({ hello: 'world' });
    mockWs.triggerError(new Error('boom'));
    mockWs.triggerClose(1000, 'done');

    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('mockWebSocketGlobal replaces global WebSocket', () => {
    const mockWs: MockWebSocket = mockWebSocketGlobal();

    const ws = new WebSocket('ws://localhost:3000/ws');

    expect(ws).toBe(mockWs);
    expect(mockWs.url).toBe('ws://localhost:3000/ws');
  });
});
