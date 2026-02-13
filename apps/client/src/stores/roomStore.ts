/**
 * Room Store
 *
 * Manages room state (current room, lobby list, creation flow)
 */

import { create } from 'zustand';
import type { Seat } from '@/types/bindings/generated/Seat';

/**
 * Player info in a seat
 */
interface PlayerInfo {
  player_id: string;
  display_name: string;
  is_bot: boolean;
}

/**
 * Room info from lobby (available rooms)
 */
interface LobbyRoomInfo {
  room_id: string;
  room_name: string;
  host_player_id: string;
  host_name?: string;
  players_count: number;
  max_players: number;
  card_year: number;
  status: 'Waiting' | 'InProgress' | 'Full';
  house_rules_summary: string[];
  created_at: number;
  occupied_seats?: Record<string, PlayerInfo>;
}

/**
 * Current room info (after joining)
 */
interface RoomInfo {
  room_id: string;
  seat: Seat;
  status: 'waiting' | 'playing' | 'finished';
}

/**
 * Room creation state
 */
interface RoomCreationState {
  isCreating: boolean;
  error: string | null;
  retryCount: number;
}

/**
 * Room joining state
 */
interface RoomJoiningState {
  isJoining: boolean;
  error: string | null;
}

/**
 * Room Store State
 */
interface RoomStoreState {
  // Current room (null if in lobby)
  currentRoom: RoomInfo | null;

  // Available rooms in lobby
  availableRooms: LobbyRoomInfo[];

  // Selected room (for join flow)
  selectedRoom: LobbyRoomInfo | null;

  // Room creation flow
  roomCreation: RoomCreationState;

  // Room joining flow
  roomJoining: RoomJoiningState;

  // Actions
  setCurrentRoom: (room: RoomInfo | null) => void;
  setAvailableRooms: (rooms: LobbyRoomInfo[]) => void;
  setSelectedRoom: (room: LobbyRoomInfo | null) => void;
  startRoomCreation: () => void;
  finishRoomCreation: (room: RoomInfo) => void;
  failRoomCreation: (error: string) => void;
  retryRoomCreation: () => void;
  resetRoomCreation: () => void;
  startRoomJoining: () => void;
  finishRoomJoining: (room: RoomInfo) => void;
  failRoomJoining: (error: string) => void;
  resetRoomJoining: () => void;
  leaveRoom: () => void;
}

/**
 * Initial state
 */
const initialRoomCreationState: RoomCreationState = {
  isCreating: false,
  error: null,
  retryCount: 0,
};

const initialRoomJoiningState: RoomJoiningState = {
  isJoining: false,
  error: null,
};

/**
 * Room Store
 */
export const useRoomStore = create<RoomStoreState>((set) => ({
  currentRoom: null,
  availableRooms: [],
  selectedRoom: null,
  roomCreation: initialRoomCreationState,
  roomJoining: initialRoomJoiningState,

  setCurrentRoom: (room) =>
    set({
      currentRoom: room,
    }),

  setAvailableRooms: (rooms) =>
    set({
      availableRooms: rooms,
    }),

  setSelectedRoom: (room) =>
    set({
      selectedRoom: room,
    }),

  startRoomCreation: () =>
    set({
      roomCreation: {
        isCreating: true,
        error: null,
        retryCount: 0,
      },
    }),

  finishRoomCreation: (room) =>
    set({
      currentRoom: room,
      roomCreation: initialRoomCreationState,
    }),

  failRoomCreation: (error) =>
    set((state) => ({
      roomCreation: {
        ...state.roomCreation,
        isCreating: false,
        error,
      },
    })),

  retryRoomCreation: () =>
    set((state) => ({
      roomCreation: {
        ...state.roomCreation,
        isCreating: true,
        error: null,
        retryCount: state.roomCreation.retryCount + 1,
      },
    })),

  resetRoomCreation: () =>
    set({
      roomCreation: initialRoomCreationState,
    }),

  startRoomJoining: () =>
    set({
      roomJoining: {
        isJoining: true,
        error: null,
      },
    }),

  finishRoomJoining: (room) =>
    set({
      currentRoom: room,
      selectedRoom: null,
      roomJoining: initialRoomJoiningState,
    }),

  failRoomJoining: (error) =>
    set({
      roomJoining: {
        isJoining: false,
        error,
      },
    }),

  resetRoomJoining: () =>
    set({
      roomJoining: initialRoomJoiningState,
      selectedRoom: null,
    }),

  leaveRoom: () =>
    set({
      currentRoom: null,
    }),
}));
