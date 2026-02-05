/**
 * Room Store
 *
 * Manages room state (current room, lobby list, creation flow)
 */

import { create } from 'zustand';
import type { Seat } from '@/types/bindings/generated/Seat';

/**
 * Room info
 */
export interface RoomInfo {
  room_id: string;
  seat: Seat;
  status: 'waiting' | 'playing' | 'finished';
}

/**
 * Room creation state
 */
export interface RoomCreationState {
  isCreating: boolean;
  error: string | null;
  retryCount: number;
}

/**
 * Room Store State
 */
export interface RoomStoreState {
  // Current room (null if in lobby)
  currentRoom: RoomInfo | null;

  // Room creation flow
  roomCreation: RoomCreationState;

  // Actions
  setCurrentRoom: (room: RoomInfo | null) => void;
  startRoomCreation: () => void;
  finishRoomCreation: (room: RoomInfo) => void;
  failRoomCreation: (error: string) => void;
  retryRoomCreation: () => void;
  resetRoomCreation: () => void;
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

/**
 * Room Store
 */
export const useRoomStore = create<RoomStoreState>((set) => ({
  currentRoom: null,
  roomCreation: initialRoomCreationState,

  setCurrentRoom: (room) =>
    set({
      currentRoom: room,
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

  leaveRoom: () =>
    set({
      currentRoom: null,
    }),
}));
