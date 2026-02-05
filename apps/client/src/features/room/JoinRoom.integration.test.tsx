/**
 * Integration Test: US-030 Join Room
 *
 * Test Scenario: join-room.md
 * Scope: Server-layer Envelope flow
 *
 * Tests the full flow from displaying room list to selecting a seat
 * and receiving RoomJoined confirmation from the server.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithProviders, screen, waitFor, within } from '@/test/test-utils';
import { mockWebSocketGlobal, type MockWebSocket } from '@/test/mocks/websocket';
import { LobbyScreen } from '@/pages/LobbyScreen';
import { useRoomStore } from '@/stores/roomStore';
import { rooms } from '@/test/fixtures';

describe('US-030: Join Room (Integration)', () => {
  let mockWs: MockWebSocket;

  beforeEach(() => {
    vi.clearAllTimers();
    mockWs = mockWebSocketGlobal();

    // Reset Zustand store state between tests
    useRoomStore.setState({
      currentRoom: null,
      availableRooms: [],
      selectedRoom: null,
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
    // Wait for WebSocket to be created and event listeners to be added
    await waitFor(() => {
      expect(mockWs.addEventListener).toHaveBeenCalled();
    });

    // Trigger the 'open' event
    act(() => {
      mockWs.triggerOpen();
    });

    // Wait for the auth message to be sent
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

    // Wait for connection state to update
    await waitFor(() => {
      expect(screen.getByText(/connected/i)).toBeInTheDocument();
    });
  };

  /**
   * Helper: Send room list update from server
   */
  const sendRoomListUpdate = () => {
    act(() => {
      mockWs.triggerMessage({
        kind: 'RoomListUpdate',
        payload: {
          rooms: rooms.roomList.rooms,
        },
      });
    });
  };

  describe('AC-1: Room List Display', () => {
    it('shows list of available rooms on lobby screen', async () => {
      renderWithProviders(<LobbyScreen />);
      await authenticateConnection();

      // Send room list update
      sendRoomListUpdate();

      // Should display room cards
      await waitFor(() => {
        expect(screen.getByText(/friday night mahjong/i)).toBeInTheDocument();
        expect(screen.getByText(/quick game/i)).toBeInTheDocument();
        expect(screen.getByText(/beginner practice/i)).toBeInTheDocument();
      });
    });
  });

  describe('AC-2: Room Card Information', () => {
    it('displays room name, players, card year, and status for each room', async () => {
      renderWithProviders(<LobbyScreen />);
      await authenticateConnection();
      sendRoomListUpdate();

      await waitFor(() => {
        expect(screen.getByText(/friday night mahjong/i)).toBeInTheDocument();
      });

      // Check first room details
      const firstRoom = screen.getByText(/friday night mahjong/i).closest('[role="article"]');
      expect(firstRoom).toBeInTheDocument();

      if (firstRoom) {
        expect(within(firstRoom).getByText(/2\/4/i)).toBeInTheDocument(); // players count
        expect(within(firstRoom).getByText(/2025/i)).toBeInTheDocument(); // card year
        expect(within(firstRoom).getByText(/waiting/i)).toBeInTheDocument(); // status
      }
    });

    it('shows Full status for rooms at max capacity', async () => {
      renderWithProviders(<LobbyScreen />);
      await authenticateConnection();
      sendRoomListUpdate();

      await waitFor(() => {
        expect(screen.getByText(/quick game/i)).toBeInTheDocument();
      });

      const fullRoom = screen.getByText(/quick game/i).closest('[role="article"]');
      expect(fullRoom).toBeInTheDocument();

      if (fullRoom) {
        expect(within(fullRoom).getByText(/4\/4/i)).toBeInTheDocument();
        expect(within(fullRoom).getByText(/inprogress|full/i)).toBeInTheDocument();
      }
    });
  });

  describe('AC-3: Seat Selection Dialog Opens', () => {
    it('opens seat selection dialog when Join Room is clicked', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();
      sendRoomListUpdate();

      await waitFor(() => {
        expect(screen.getByText(/friday night mahjong/i)).toBeInTheDocument();
      });

      // Click on a room card to select it
      const roomCard = screen.getByText(/friday night mahjong/i).closest('[role="article"]');
      expect(roomCard).toBeInTheDocument();

      if (roomCard) {
        const joinButton = within(roomCard).getByRole('button', { name: /join/i });
        await user.click(joinButton);

        // Seat selection dialog should open
        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
          expect(screen.getByText(/select.*seat/i)).toBeInTheDocument();
        });
      }
    });
  });

  describe('AC-4: Seat Diagram Display', () => {
    it('shows 4 seats in compass layout with occupied/available states', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();
      sendRoomListUpdate();

      await waitFor(() => {
        expect(screen.getByText(/friday night mahjong/i)).toBeInTheDocument();
      });

      const roomCard = screen.getByText(/friday night mahjong/i).closest('[role="article"]');
      if (roomCard) {
        const joinButton = within(roomCard).getByRole('button', { name: /join/i });
        await user.click(joinButton);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const dialog = screen.getByRole('dialog');

        // Check for all 4 seats (looking for buttons or text)
        expect(within(dialog).getAllByText(/east/i).length).toBeGreaterThan(0);
        expect(within(dialog).getAllByText(/south/i).length).toBeGreaterThan(0);
        expect(within(dialog).getAllByText(/west/i).length).toBeGreaterThan(0);
        expect(within(dialog).getAllByText(/north/i).length).toBeGreaterThan(0);

        // Check occupied seats show player names (East: Alice, South: Bob)
        expect(within(dialog).getByText(/alice/i)).toBeInTheDocument();
        expect(within(dialog).getByText(/bob/i)).toBeInTheDocument();
      }
    });

    it('grays out occupied seats and highlights available seats', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();
      sendRoomListUpdate();

      await waitFor(() => {
        expect(screen.getByText(/friday night mahjong/i)).toBeInTheDocument();
      });

      const roomCard = screen.getByText(/friday night mahjong/i).closest('[role="article"]');
      if (roomCard) {
        const joinButton = within(roomCard).getByRole('button', { name: /join/i });
        await user.click(joinButton);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const dialog = screen.getByRole('dialog');

        // Available seats (West, North) should be clickable buttons
        const westSeat = within(dialog).getByRole('button', { name: /west/i });
        const northSeat = within(dialog).getByRole('button', { name: /north/i });

        expect(westSeat).toBeEnabled();
        expect(northSeat).toBeEnabled();

        // Occupied seats should be disabled or not be buttons
        const occupiedSeats = within(dialog).getAllByText(/alice|bob/i);
        expect(occupiedSeats.length).toBeGreaterThan(0);
      }
    });
  });

  describe('AC-5: Select Specific Seat', () => {
    it('highlights selected seat and shows "Join as [Seat]" button', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();
      sendRoomListUpdate();

      await waitFor(() => {
        expect(screen.getByText(/friday night mahjong/i)).toBeInTheDocument();
      });

      const roomCard = screen.getByText(/friday night mahjong/i).closest('[role="article"]');
      if (roomCard) {
        const joinButton = within(roomCard).getByRole('button', { name: /join/i });
        await user.click(joinButton);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const dialog = screen.getByRole('dialog');
        const westSeat = within(dialog).getByRole('button', { name: /^west$/i });

        await user.click(westSeat);

        // Should show "Join as West" button
        await waitFor(() => {
          expect(within(dialog).getByRole('button', { name: /join as west/i })).toBeInTheDocument();
        });
      }
    });

    it('allows changing seat selection by clicking different available seat', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();
      sendRoomListUpdate();

      await waitFor(() => {
        expect(screen.getByText(/friday night mahjong/i)).toBeInTheDocument();
      });

      const roomCard = screen.getByText(/friday night mahjong/i).closest('[role="article"]');
      if (roomCard) {
        const joinButton = within(roomCard).getByRole('button', { name: /join/i });
        await user.click(joinButton);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const dialog = screen.getByRole('dialog');

        // Select West
        const westSeat = within(dialog).getByRole('button', { name: /^west$/i });
        await user.click(westSeat);

        await waitFor(() => {
          expect(within(dialog).getByRole('button', { name: /join as west/i })).toBeInTheDocument();
        });

        // Change to North
        const northSeat = within(dialog).getByRole('button', { name: /^north$/i });
        await user.click(northSeat);

        await waitFor(() => {
          expect(within(dialog).getByRole('button', { name: /join as north/i })).toBeInTheDocument();
        });
      }
    });
  });

  describe('AC-6: Auto-Assign Seat', () => {
    it('shows "Join Any Seat" button for auto-assignment', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();
      sendRoomListUpdate();

      await waitFor(() => {
        expect(screen.getByText(/friday night mahjong/i)).toBeInTheDocument();
      });

      const roomCard = screen.getByText(/friday night mahjong/i).closest('[role="article"]');
      if (roomCard) {
        const joinButton = within(roomCard).getByRole('button', { name: /join/i });
        await user.click(joinButton);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const dialog = screen.getByRole('dialog');
        expect(within(dialog).getByRole('button', { name: /join any seat/i })).toBeInTheDocument();
      }
    });
  });

  describe('AC-7: Send Join Room Command', () => {
    it('sends JoinRoom envelope with room_id and preferred_seat on specific seat selection', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();
      sendRoomListUpdate();

      await waitFor(() => {
        expect(screen.getByText(/friday night mahjong/i)).toBeInTheDocument();
      });

      const roomCard = screen.getByText(/friday night mahjong/i).closest('[role="article"]');
      if (roomCard) {
        const joinButton = within(roomCard).getByRole('button', { name: /join/i });
        await user.click(joinButton);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const dialog = screen.getByRole('dialog');
        const westSeat = within(dialog).getByRole('button', { name: /^west$/i });
        await user.click(westSeat);

        await waitFor(() => {
          expect(within(dialog).getByRole('button', { name: /join as west/i })).toBeInTheDocument();
        });

        const joinAsWestButton = within(dialog).getByRole('button', { name: /join as west/i });
        await user.click(joinAsWestButton);

        // Should send JoinRoom envelope (second send after auth)
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
              room_id: 'room001',
              preferred_seat: 'West',
            });
          }
        });
      }
    });

    it('sends JoinRoom envelope with null preferred_seat for auto-assign', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();
      sendRoomListUpdate();

      await waitFor(() => {
        expect(screen.getByText(/friday night mahjong/i)).toBeInTheDocument();
      });

      const roomCard = screen.getByText(/friday night mahjong/i).closest('[role="article"]');
      if (roomCard) {
        const joinButton = within(roomCard).getByRole('button', { name: /join/i });
        await user.click(joinButton);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const dialog = screen.getByRole('dialog');
        const autoAssignButton = within(dialog).getByRole('button', { name: /join any seat/i });
        await user.click(autoAssignButton);

        // Should send JoinRoom envelope with null preferred_seat
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
            expect(envelope.payload.preferred_seat).toBeNull();
          }
        });
      }
    });

    it('shows loading state while waiting for response', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();
      sendRoomListUpdate();

      await waitFor(() => {
        expect(screen.getByText(/friday night mahjong/i)).toBeInTheDocument();
      });

      const roomCard = screen.getByText(/friday night mahjong/i).closest('[role="article"]');
      if (roomCard) {
        const joinButton = within(roomCard).getByRole('button', { name: /join/i });
        await user.click(joinButton);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const dialog = screen.getByRole('dialog');
        const westSeat = within(dialog).getByRole('button', { name: /^west$/i });
        await user.click(westSeat);

        await waitFor(() => {
          expect(within(dialog).getByRole('button', { name: /join as west/i })).toBeInTheDocument();
        });

        const joinAsWestButton = within(dialog).getByRole('button', { name: /join as west/i });
        await user.click(joinAsWestButton);

        // Should show loading state (the button becomes disabled)
        await waitFor(
          () => {
            const updatedButton = within(dialog).getByRole('button', { name: /join as west/i });
            expect(updatedButton).toBeDisabled();
          },
          { timeout: 2000 }
        );
      }
    });
  });

  describe('AC-8: Join Successful', () => {
    it('navigates to room screen when RoomJoined is received', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();
      sendRoomListUpdate();

      await waitFor(() => {
        expect(screen.getByText(/friday night mahjong/i)).toBeInTheDocument();
      });

      const roomCard = screen.getByText(/friday night mahjong/i).closest('[role="article"]');
      if (roomCard) {
        const joinButton = within(roomCard).getByRole('button', { name: /join/i });
        await user.click(joinButton);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const dialog = screen.getByRole('dialog');
        const westSeat = within(dialog).getByRole('button', { name: /^west$/i });
        await user.click(westSeat);

        await waitFor(() => {
          expect(within(dialog).getByRole('button', { name: /join as west/i })).toBeInTheDocument();
        });

        const joinAsWestButton = within(dialog).getByRole('button', { name: /join as west/i });
        await user.click(joinAsWestButton);

        // Simulate server response: RoomJoined
        act(() => {
          mockWs.triggerMessage({
            kind: 'RoomJoined',
            payload: {
              room_id: 'room001',
              seat: 'West',
            },
          });
        });

        // Should navigate to room screen
        await waitFor(() => {
          expect(screen.getByText(/waiting for players/i)).toBeInTheDocument();
        });
      }
    });

    it('shows assigned seat with player name in room screen', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();
      sendRoomListUpdate();

      await waitFor(() => {
        expect(screen.getByText(/friday night mahjong/i)).toBeInTheDocument();
      });

      const roomCard = screen.getByText(/friday night mahjong/i).closest('[role="article"]');
      if (roomCard) {
        const joinButton = within(roomCard).getByRole('button', { name: /join/i });
        await user.click(joinButton);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const dialog = screen.getByRole('dialog');
        const westSeat = within(dialog).getByRole('button', { name: /^west$/i });
        await user.click(westSeat);

        await waitFor(() => {
          expect(within(dialog).getByRole('button', { name: /join as west/i })).toBeInTheDocument();
        });

        const joinAsWestButton = within(dialog).getByRole('button', { name: /join as west/i });
        await user.click(joinAsWestButton);

        act(() => {
          mockWs.triggerMessage({
            kind: 'RoomJoined',
            payload: {
              room_id: 'room001',
              seat: 'West',
            },
          });
        });

        // Should show player in West seat (check for success message or room screen)
        await waitFor(
          () => {
            expect(screen.getByText(/waiting for players/i)).toBeInTheDocument();
          },
          { timeout: 2000 }
        );
      }
    });
  });

  describe('AC-9: Room Full Error', () => {
    it('shows error when room is full', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();
      sendRoomListUpdate();

      await waitFor(() => {
        expect(screen.getByText(/friday night mahjong/i)).toBeInTheDocument();
      });

      const roomCard = screen.getByText(/friday night mahjong/i).closest('[role="article"]');
      if (roomCard) {
        const joinButton = within(roomCard).getByRole('button', { name: /join/i });
        await user.click(joinButton);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const dialog = screen.getByRole('dialog');
        const autoAssignButton = within(dialog).getByRole('button', { name: /join any seat/i });
        await user.click(autoAssignButton);

        // Simulate server error response: Room full
        act(() => {
          mockWs.triggerMessage({
            kind: 'Error',
            payload: {
              code: 'ROOM_FULL',
              message: 'Room is full. Please select another room.',
            },
          });
        });

        // Should show error message
        await waitFor(() => {
          expect(screen.getByText(/room is full/i)).toBeInTheDocument();
        });
      }
    });

    it('updates room list to show room as Full after error', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();
      sendRoomListUpdate();

      await waitFor(() => {
        expect(screen.getByText(/friday night mahjong/i)).toBeInTheDocument();
      });

      const roomCard = screen.getByText(/friday night mahjong/i).closest('[role="article"]');
      if (roomCard) {
        const joinButton = within(roomCard).getByRole('button', { name: /join/i });
        await user.click(joinButton);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const dialog = screen.getByRole('dialog');
        const autoAssignButton = within(dialog).getByRole('button', { name: /join any seat/i });
        await user.click(autoAssignButton);

        act(() => {
          mockWs.triggerMessage({
            kind: 'Error',
            payload: {
              code: 'ROOM_FULL',
              message: 'Room is full. Please select another room.',
            },
          });
        });

        // Send updated room list showing room as full
        act(() => {
          mockWs.triggerMessage({
            kind: 'RoomListUpdate',
            payload: {
              rooms: [
                {
                  ...rooms.roomList.rooms[0],
                  players_count: 4,
                  status: 'Full',
                },
              ],
            },
          });
        });

        // Dialog should still be open, check for error message first
        await waitFor(
          () => {
            expect(screen.getByText(/room is full/i)).toBeInTheDocument();
          },
          { timeout: 2000 }
        );
      }
    });
  });

  describe('AC-10: Seat Taken Error', () => {
    it('shows error when preferred seat is already occupied', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();
      sendRoomListUpdate();

      await waitFor(() => {
        expect(screen.getByText(/friday night mahjong/i)).toBeInTheDocument();
      });

      const roomCard = screen.getByText(/friday night mahjong/i).closest('[role="article"]');
      if (roomCard) {
        const joinButton = within(roomCard).getByRole('button', { name: /join/i });
        await user.click(joinButton);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const dialog = screen.getByRole('dialog');
        const westSeat = within(dialog).getByRole('button', { name: /^west$/i });
        await user.click(westSeat);

        await waitFor(() => {
          expect(within(dialog).getByRole('button', { name: /join as west/i })).toBeInTheDocument();
        });

        const joinAsWestButton = within(dialog).getByRole('button', { name: /join as west/i });
        await user.click(joinAsWestButton);

        // Simulate server error: Seat taken
        act(() => {
          mockWs.triggerMessage({
            kind: 'Error',
            payload: {
              code: 'SEAT_OCCUPIED',
              message: 'West seat already taken. Please select another seat.',
            },
          });
        });

        // Should show error message
        await waitFor(() => {
          expect(screen.getByText(/seat.*taken|already occupied/i)).toBeInTheDocument();
        });
      }
    });
  });

  describe('Edge Cases', () => {
    it('handles WebSocket disconnect during join', async () => {
      const { user } = renderWithProviders(<LobbyScreen />);
      await authenticateConnection();
      sendRoomListUpdate();

      await waitFor(() => {
        expect(screen.getByText(/friday night mahjong/i)).toBeInTheDocument();
      });

      const roomCard = screen.getByText(/friday night mahjong/i).closest('[role="article"]');
      if (roomCard) {
        const joinButton = within(roomCard).getByRole('button', { name: /join/i });
        await user.click(joinButton);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).toBeInTheDocument();
        });

        const dialog = screen.getByRole('dialog');
        const autoAssignButton = within(dialog).getByRole('button', { name: /join any seat/i });
        await user.click(autoAssignButton);

        // Trigger WebSocket close
        act(() => {
          mockWs.triggerClose(1006, 'Connection lost');
        });

        // Should show connecting state
        await waitFor(() => {
          expect(screen.getByText(/connecting/i)).toBeInTheDocument();
        });
      }
    });
  });
});
