import { GameBoard } from '@/components/game/GameBoard';
import { useGameSocket } from '@/hooks/useGameSocket';
import { LobbyScreen } from '@/pages/LobbyScreen';
import { useRoomStore } from '@/stores/roomStore';

export function App() {
  const currentRoom = useRoomStore((state) => state.currentRoom);
  const socket = useGameSocket();

  if (currentRoom) {
    return <GameBoard socket={socket} />;
  }

  return <LobbyScreen socket={socket} />;
}
