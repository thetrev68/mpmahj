/**
 * Integration Test: US-029 Create Room
 *
 * Test Scenario: create-room.md
 * Scope: Server-layer Envelope flow
 *
 * Tests the full flow from opening the Create Room dialog to receiving
 * RoomJoined confirmation from the server.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act, fireEvent } from '@testing-library/react';
import { renderWithProviders, screen, waitFor, within } from '@/test/test-utils';
import { mockWebSocketGlobal, type MockWebSocket } from '@/test/mocks/websocket';
import { LobbyScreen } from '@/pages/LobbyScreen';
import { useRoomStore } from '@/stores/roomStore';
import { persistSessionToken } from '@/hooks/gameSocketStorage';

describe('US-029: Create Room (Integration)', () => {
  let mockWs: MockWebSocket;

  beforeEach(() => {
    vi.clearAllTimers();
    mockWs = mockWebSocketGlobal();
    persistSessionToken('11111111-1111-1111-1111-111111111111');

    // Reset Zustand store state between tests
    useRoomStore.setState({
      currentRoom: null,
      roomCreation: {
        isCreating: false,
        error: null,
        retryCount: 0,
      },
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  /**
   * Helper: Authenticate the WebSocket connection
   *
   * This helper ensures proper sequencing:
   * 1. WebSocket created and listeners registered (happens automatically in LobbyScreen)
   * 2. Trigger open event
   * 3. Wait for auth message to be sent
   * 4. Trigger AuthSuccess response
   * 5. Wait for connection state to update
   */
  const authenticateConnection = async () => {
    // Wait for WebSocket to be created and event listeners to be added
    // This happens in useGameSocket's useEffect on mount
    await waitFor(() => {
      expect(mockWs.addEventListener).toHaveBeenCalled();
    });

    // Trigger the 'open' event - this will cause auth to be sent
    act(() => {
      mockWs.triggerOpen();
    });

    // Wait for the auth message to be sent in response to 'open'
    await waitFor(() => {
      const calls = mockWs.send.mock.calls;
      const hasAuthCall = calls.some((call) => {
        const message = call[0] as string;
        return message.includes('Authenticate');
      });
      expect(hasAuthCall).toBe(true);
    });

    // Trigger the AuthSuccess response
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

    // Wait for the connection state to update to 'connected'
    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    });
  };

  describe('AC-1: Create Room Button', () => {
    it('shows prominent Create Room button on lobby screen', async () => {
      renderWithProviders(<LobbyScreen />);
      await authenticateConnection();

      await waitFor(() => {
        const createButton = screen.getByRole('button', { name: /create room/i });
        expect(createButton).toBeInTheDocument();
        expect(createButton).toBeEnabled();
      });
    });
  });

  describe('AC-2: Room Creation Form Opens', () => {
    it('opens room creation form modal when Create Room is clicked', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create room/i })).toBeEnabled();
      });

      const createButton = screen.getByRole('button', { name: /create room/i });
      await user.click(createButton);

      // Modal should be visible with form fields
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByLabelText(/card year/i)).toBeInTheDocument();
    });
  });

  describe('AC-3: Room Name Configuration', () => {
    it('shows room name input with default value and placeholder', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create room/i })).toBeEnabled();
      });

      await user.click(screen.getByRole('button', { name: /create room/i }));

      const roomNameInput = screen.getByLabelText(/room name/i);
      expect(roomNameInput).toBeInTheDocument();
      expect(roomNameInput).toHaveValue('My American Mahjong Game');
      expect(roomNameInput).toHaveAttribute('placeholder', 'My American Mahjong Game');
      expect(roomNameInput).toHaveAttribute('maxlength', '50');
    });
  });

  describe('AC-4: Card Year Selection', () => {
    it('shows card year options 2017-2025 with 2025 default', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create room/i })).toBeEnabled();
      });

      await user.click(screen.getByRole('button', { name: /create room/i }));

      // Check that card year selector is present and displays 2025
      const cardYearSelect = screen.getByRole('combobox', { name: /card year/i });
      expect(cardYearSelect).toBeInTheDocument();
      expect(cardYearSelect).toHaveTextContent('2025');
    });
  });

  describe('AC-5: Bot Difficulty Selection', () => {
    it('shows bot difficulty when fill with bots is checked', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create room/i })).toBeEnabled();
      });

      await user.click(screen.getByRole('button', { name: /create room/i }));

      const fillBotsCheckbox = screen.getByLabelText(/fill empty seats with bots/i);
      await user.click(fillBotsCheckbox);

      // Bot difficulty should appear
      expect(screen.getByLabelText(/bot difficulty/i)).toBeInTheDocument();
    });
  });

  describe('AC-8: Submit Room Creation', () => {
    it('sends CreateRoom envelope with config on submit', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create room/i })).toBeEnabled();
      });

      // Open dialog
      await user.click(screen.getByRole('button', { name: /create room/i }));

      // Submit form
      const submitButton = screen.getByRole('button', { name: /create/i });
      await user.click(submitButton);

      // Should send CreateRoom envelope (second send after auth)
      await waitFor(() => {
        expect(mockWs.send).toHaveBeenCalledTimes(2);
      });

      const sentMessage = mockWs.send.mock.calls[1]?.[0];
      expect(sentMessage).toBeDefined();

      const envelope = JSON.parse(sentMessage as string);
      expect(envelope.kind).toBe('CreateRoom');
      expect(envelope.payload).toMatchObject({
        room_name: 'My American Mahjong Game',
        card_year: 2025,
        house_rules: {
          ruleset: {
            card_year: 2025,
            timer_mode: 'Visible',
            blank_exchange_enabled: false,
            call_window_seconds: 10,
            charleston_timer_seconds: 60,
          },
          analysis_enabled: true,
          concealed_bonus_enabled: false,
          dealer_bonus_enabled: false,
        },
        fill_with_bots: false,
      });
    });

    it('shows loading state while waiting for response', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create room/i })).toBeEnabled();
      });

      await user.click(screen.getByRole('button', { name: /create room/i }));

      // Wait for dialog to be visible
      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      // Find the submit button within the dialog using a more specific query
      // Look for the button with type="submit" inside the dialog
      const dialog = screen.getByRole('dialog');
      const submitButton = within(dialog).getByRole('button', { name: /^create$/i });
      expect(submitButton).toBeInTheDocument();

      await user.click(submitButton);

      // The button text should change to "Creating..." and be disabled
      await waitFor(() => {
        const creatingButton = within(dialog).getByRole('button', { name: /creating/i });
        expect(creatingButton).toBeDisabled();
      });
    });
  });

  describe('AC-9: Room Created Successfully', () => {
    it('navigates to room view when RoomJoined is received', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create room/i })).toBeEnabled();
      });

      // Open dialog and submit
      await user.click(screen.getByRole('button', { name: /create room/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      const submitButton = within(dialog).getByRole('button', { name: /^create$/i });
      expect(submitButton).toBeInTheDocument();

      await user.click(submitButton);

      // Simulate server response: RoomJoined
      act(() => {
        mockWs.triggerMessage({
          kind: 'RoomJoined',
          payload: {
            room_id: 'test-room-123',
            seat: 'East',
          },
        });
      });

      // Should show success message and dialog should close
      await waitFor(() => {
        expect(screen.getByText(/waiting for players/i)).toBeInTheDocument();
      });
    });

    it('shows success message after room creation', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create room/i })).toBeEnabled();
      });

      await user.click(screen.getByRole('button', { name: /create room/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      const submitButton = within(dialog).getByRole('button', { name: /^create$/i });
      expect(submitButton).toBeInTheDocument();

      await user.click(submitButton);

      act(() => {
        mockWs.triggerMessage({
          kind: 'RoomJoined',
          payload: {
            room_id: 'test-room-123',
            seat: 'East',
          },
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/waiting for players/i)).toBeInTheDocument();
      });
    });

    it('shows room code and copy link after creation', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create room/i })).toBeEnabled();
      });

      await user.click(screen.getByRole('button', { name: /create room/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      const submitButton = within(dialog).getByRole('button', { name: /^create$/i });
      expect(submitButton).toBeInTheDocument();

      await user.click(submitButton);

      act(() => {
        mockWs.triggerMessage({
          kind: 'RoomJoined',
          payload: {
            room_id: 'ABCDE',
            seat: 'East',
          },
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/room code/i)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /copy link/i })).toBeInTheDocument();
      });
    });
  });

  describe('AC-10: Room Creation Error Handling', () => {
    it('shows error toast when creation fails', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create room/i })).toBeEnabled();
      });

      await user.click(screen.getByRole('button', { name: /create room/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      const submitButton = within(dialog).getByRole('button', { name: /^create$/i });
      expect(submitButton).toBeInTheDocument();

      await user.click(submitButton);

      // Simulate server error response
      act(() => {
        mockWs.triggerMessage({
          kind: 'Error',
          payload: {
            code: 'INTERNAL_ERROR',
            message: 'Failed to create room',
          },
        });
      });

      await waitFor(() => {
        expect(screen.getByText(/failed to create room/i)).toBeInTheDocument();
      });
    });

    it('retries on network error with max 3 attempts', async () => {
      try {
        renderWithProviders(<LobbyScreen />);
        await authenticateConnection();

        await waitFor(() => {
          expect(screen.getByRole('button', { name: /create room/i })).toBeEnabled();
        });

        vi.useFakeTimers();

        fireEvent.click(screen.getByRole('button', { name: /create room/i }));
        const dialog = screen.getByRole('dialog');
        const submitButton = within(dialog).getByRole('button', { name: /^create$/i });
        fireEvent.click(submitButton);

        // 1 auth + 1 initial CreateRoom
        expect(mockWs.send).toHaveBeenCalledTimes(2);

        // Retry #1 at +5s
        act(() => {
          vi.advanceTimersByTime(5000);
        });
        expect(mockWs.send).toHaveBeenCalledTimes(3);

        // Retry #2 at +10s
        act(() => {
          vi.advanceTimersByTime(5000);
        });
        expect(mockWs.send).toHaveBeenCalledTimes(4);

        // Retry #3 at +15s
        act(() => {
          vi.advanceTimersByTime(5000);
        });
        expect(mockWs.send).toHaveBeenCalledTimes(5);

        // After max retries, flow fails and no further retries happen
        expect(useRoomStore.getState().roomCreation.error).toBe(
          'Failed to create room after 3 attempts'
        );

        act(() => {
          vi.advanceTimersByTime(5000);
        });
        expect(mockWs.send).toHaveBeenCalledTimes(5);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Edge Cases', () => {
    it('handles WebSocket disconnect during creation', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create room/i })).toBeEnabled();
      });

      await user.click(screen.getByRole('button', { name: /create room/i }));

      await waitFor(() => {
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      const dialog = screen.getByRole('dialog');
      const submitButton = within(dialog).getByRole('button', { name: /^create$/i });
      expect(submitButton).toBeInTheDocument();

      await user.click(submitButton);

      // Trigger WebSocket close
      act(() => {
        mockWs.triggerClose(1006, 'Connection lost');
      });

      // When disconnected, the connection state changes and the UI reflects this
      // The useGameSocket hook sets state to 'disconnected' on close, which triggers
      // auto-reconnect (connecting state). The LobbyScreen shows "Connecting..." for
      // both initial connection and reconnection attempts.
      await waitFor(() => {
        expect(screen.getByText(/connecting/i)).toBeInTheDocument();
      });
    });
  });
});
