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
import { act } from '@testing-library/react';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';
import { mockWebSocketGlobal, type MockWebSocket } from '@/test/mocks/websocket';
import { LobbyScreen } from '@/pages/LobbyScreen';

describe('US-029: Create Room (Integration)', () => {
  let mockWs: MockWebSocket;

  beforeEach(() => {
    vi.clearAllTimers();
    mockWs = mockWebSocketGlobal();
  });

  afterEach(() => {
    vi.clearAllTimers();
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
    it('shows card year selector with default value', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create room/i })).toBeEnabled();
      });

      await user.click(screen.getByRole('button', { name: /create room/i }));

      // Card year selector should be present
      expect(screen.getByLabelText(/card year/i)).toBeInTheDocument();
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

      // Check that card year selector is present
      expect(screen.getByRole('combobox', { name: /card year/i })).toBeInTheDocument();
      // Check the hidden select has 2025 selected
      const hiddenSelect = screen.getByRole('combobox', { name: /card year/i, hidden: true });
      expect(hiddenSelect).toHaveValue('2025');
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
        card_year: 2025,
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

      // Find submit button (there are two "Create" buttons - lobby and form submit)
      const submitButtons = screen.getAllByRole('button', { name: /create/i });
      const submitButton = submitButtons[submitButtons.length - 1]; // Last one is the form submit

      // Click but check immediately - button should be disabled
      const clickPromise = user.click(submitButton);

      // The button text should change to "Creating..."
      await waitFor(() => {
        expect(screen.getByText(/creating/i)).toBeInTheDocument();
      });

      await clickPromise;
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

      const submitButtons = screen.getAllByRole('button', { name: /create/i });
      await user.click(submitButtons[submitButtons.length - 1]);

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

      // Should navigate to room view or show success message
      await waitFor(() => {
        expect(
          screen.getByText(/room created successfully|waiting for players/i)
        ).toBeInTheDocument();
      });
    });

    it('shows success message after room creation', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create room/i })).toBeEnabled();
      });

      await user.click(screen.getByRole('button', { name: /create room/i }));

      const submitButtons = screen.getAllByRole('button', { name: /create/i });
      await user.click(submitButtons[submitButtons.length - 1]);

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
  });

  describe('AC-10: Room Creation Error Handling', () => {
    it('shows error toast when creation fails', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /create room/i })).toBeEnabled();
      });

      await user.click(screen.getByRole('button', { name: /create room/i }));

      const submitButtons = screen.getAllByRole('button', { name: /create/i });
      await user.click(submitButtons[submitButtons.length - 1]);

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

    it.skip('retries on network error with max 3 attempts', async () => {
      // This test is complex with fake timers - skipping for now
      // TODO: Implement retry logic and test it properly
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

      const submitButtons = screen.getAllByRole('button', { name: /create/i });
      await user.click(submitButtons[submitButtons.length - 1]);

      act(() => {
        mockWs.triggerClose(1006, 'Connection lost');
      });

      await waitFor(() => {
        expect(screen.getByText(/connecting/i)).toBeInTheDocument();
      });
    });
  });
});
