/**
 * RoomList Component
 *
 * Displays a grid of available rooms in the lobby
 */

import { RoomCard } from './RoomCard';
import type { LobbyRoomInfo } from '@/stores/roomStore';

export interface RoomListProps {
  rooms: LobbyRoomInfo[];
  onRoomJoinClick: (room: LobbyRoomInfo) => void;
}

export function RoomList({ rooms, onRoomJoinClick }: RoomListProps) {
  if (rooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-12 text-center">
        <p className="text-muted-foreground">No rooms available</p>
        <p className="text-sm text-muted-foreground">Create a room to get started</p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {rooms.map((room) => (
        <RoomCard key={room.room_id} room={room} onJoinClick={onRoomJoinClick} />
      ))}
    </div>
  );
}
