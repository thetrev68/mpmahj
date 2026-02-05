/**
 * Integration Test: US-030 Join Room (Invite Code)
 *
 * Test Scenario: join-room.md
 * Scope: Server-layer Envelope flow
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders, screen, waitFor, within } from '@/test/test-utils';
import { mockWebSocketGlobal, type MockWebSocket } from '@/test/mocks/websocket';
import { LobbyScreen } from '@/pages/LobbyScreen';
import { useRoomStore } from '@/stores/roomStore';

describe('US-030: Join Room (Integration)', () => {
  let mockWs: MockWebSocket;

  beforeEach(() => {
    vi.clearAllTimers();
    mockWs = mockWebSocketGlobal();

    // Reset Zustand store state between tests
    useRoomStore.setState({
      currentRoom: null,
      roomJoining: {
        isJoining: false,
        error: null,
      },
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  /**
   * Helper: Authenticate the WebSocket connection
   */
  const authenticateConnection = async () => {
    await waitFor(() => {
      expect(mockWs.addEventListener).toHaveBeenCalled();
    });

    act(() => {
      mockWs.triggerOpen();
    });

    await waitFor(() => {
      const calls = mockWs.send.mock.calls;
      const hasAuthCall = calls.some((call) => {
        const message = call[0] as string;
        return message.includes('Authenticate');
      });
      expect(hasAuthCall).toBe(true);
    });

    act(() => {
      mockWs.triggerMessage({
        kind: 'AuthSuccess',
        payload: {
          player_id: 'test-player-123',
          display_name: 'TestPlayer',
          session_token: 'test-token-456',
        },
      });
    });

    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    });
  };

  describe('AC-1: Join Room Entry', () => {
    it('opens Join Room dialog from lobby button', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();

      const joinButton = screen.getByRole('button', { name: /join room/i });
      await user.click(joinButton);

      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByText(/invite code/i)).toBeInTheDocument();
    });
  });

  describe('AC-2: Code Validation', () => {
    it('normalizes input to uppercase and enables join at 5 chars', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();

      await user.click(screen.getByRole('button', { name: /join room/i }));
      const dialog = screen.getByRole('dialog');

      const input = within(dialog).getByLabelText(/code/i);
      await user.type(input, 'ab12c');

      expect((input as HTMLInputElement).value).toBe('AB12C');

      const joinSubmit = within(dialog).getByRole('button', { name: /^join$/i });
      expect(joinSubmit).toBeEnabled();
    });
  });

  describe('AC-3: Send Join Command', () => {
    it('sends JoinRoom envelope with invite code', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();

      await user.click(screen.getByRole('button', { name: /join room/i }));
      const dialog = screen.getByRole('dialog');

      const input = within(dialog).getByLabelText(/code/i);
      await user.type(input, 'ab12c');

      const joinSubmit = within(dialog).getByRole('button', { name: /^join$/i });
      await user.click(joinSubmit);

      await waitFor(() => {
        const calls = mockWs.send.mock.calls;
        const joinRoomCall = calls.find((call) => {
          const message = call[0] as string;
          return message.includes('JoinRoom');
        });
        expect(joinRoomCall).toBeDefined();

        if (joinRoomCall) {
          const envelope = JSON.parse(joinRoomCall[0] as string);
          expect(envelope.kind).toBe('JoinRoom');
          expect(envelope.payload).toMatchObject({
            room_id: 'AB12C',
          });
        }
      });
    });

    it('shows loading state while waiting for response', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();

      await user.click(screen.getByRole('button', { name: /join room/i }));
      const dialog = screen.getByRole('dialog');

      const input = within(dialog).getByLabelText(/code/i);
      await user.type(input, 'ab12c');

      const joinSubmit = within(dialog).getByRole('button', { name: /^join$/i });
      await user.click(joinSubmit);

      await waitFor(() => {
        const joiningButton = within(dialog).getByRole('button', { name: /joining/i });
        expect(joiningButton).toBeDisabled();
      });
    });
  });

  describe('AC-4: Join Success', () => {
    it('shows waiting state after RoomJoined', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();

      await user.click(screen.getByRole('button', { name: /join room/i }));
      const dialog = screen.getByRole('dialog');

      const input = within(dialog).getByLabelText(/code/i);
      await user.type(input, 'ab12c');

      const joinSubmit = within(dialog).getByRole('button', { name: /^join$/i });
      await user.click(joinSubmit);

      act(() => {
        mockWs.triggerMessage({
          kind: 'RoomJoined',
          payload: {
            room_id: 'AB12C',
            seat: 'South',
          },
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/waiting for players/i)).toBeInTheDocument();
      });
    });
  });

  describe('AC-5: Join Errors', () => {
    it('shows error message on server error', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();

      await user.click(screen.getByRole('button', { name: /join room/i }));
      const dialog = screen.getByRole('dialog');

      const input = within(dialog).getByLabelText(/code/i);
      await user.type(input, 'ab12c');

      const joinSubmit = within(dialog).getByRole('button', { name: /^join$/i });
      await user.click(joinSubmit);

      act(() => {
        mockWs.triggerMessage({
          kind: 'Error',
          payload: {
            code: 'ROOM_NOT_FOUND',
            message: 'Invalid code',
          },
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/invalid code/i)).toBeInTheDocument();
      });
    });
  });

  describe('AC-7: Deep Link Join', () => {
    it('opens Join dialog with prefilled code from query params', async () => {
      window.history.pushState({}, '', '/?join=1&code=ab12c');

      renderWithProviders(<LobbyScreen />);
      await authenticateConnection();

      const dialog = await screen.findByRole('dialog');
      const input = within(dialog).getByLabelText(/code/i) as HTMLInputElement;
      expect(input.value).toBe('AB12C');
    });
  });
});
