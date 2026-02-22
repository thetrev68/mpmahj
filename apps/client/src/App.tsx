import { lazy, Suspense } from 'react';
import { useGameSocket } from '@/hooks/useGameSocket';
import { useRoomStore } from '@/stores/roomStore';

const GameBoard = lazy(async () => {
  const module = await import('@/components/game/GameBoard');
  return { default: module.GameBoard };
});

const LobbyScreen = lazy(async () => {
  const module = await import('@/pages/LobbyScreen');
  return { default: module.LobbyScreen };
});

export function App() {
  const currentRoom = useRoomStore((state) => state.currentRoom);
  const socket = useGameSocket();

  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-300">Loading...</div>}>
      {currentRoom ? <GameBoard socket={socket} /> : <LobbyScreen socket={socket} />}
    </Suspense>
  );
}
