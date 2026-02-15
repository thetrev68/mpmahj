import { GameBoard } from '@/components/game/GameBoard';
import { LobbyScreen } from '@/pages/LobbyScreen';
import { useRoomStore } from '@/stores/roomStore';

export function App() {
  const currentRoom = useRoomStore((state) => state.currentRoom);

  if (currentRoom) {
    return <GameBoard />;
  }

  return <LobbyScreen />;
}
