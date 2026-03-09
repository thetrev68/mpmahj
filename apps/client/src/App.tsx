import { lazy, Suspense } from 'react';
import { useGameSocket } from '@/hooks/useGameSocket';
import { useRoomStore } from '@/stores/roomStore';
import { fixtures } from '@/test/fixtures';
import type { WebSocketLike } from '@/components/game/useGameBoardBridge';

const GameBoard = lazy(async () => {
  const module = await import('@/components/game/GameBoard');
  return { default: module.GameBoard };
});

const LobbyScreen = lazy(async () => {
  const module = await import('@/pages/LobbyScreen');
  return { default: module.LobbyScreen };
});

const offlineWebSocket: WebSocketLike = {
  send: () => {},
  addEventListener: () => {},
  removeEventListener: () => {},
};

function getFixtureGameState() {
  if (!(import.meta.env.DEV || import.meta.env.MODE === 'test')) {
    return null;
  }

  const fixtureName = new URLSearchParams(window.location.search).get('fixture');
  if (!fixtureName) {
    return null;
  }

  const fixtureState = fixtures.gameStates[fixtureName as keyof typeof fixtures.gameStates] ?? null;

  return fixtureState;
}

export function App() {
  const fixtureGameState = getFixtureGameState();
  const currentRoom = useRoomStore((state) => state.currentRoom);
  const socket = useGameSocket({ enabled: fixtureGameState === null });

  if (fixtureGameState) {
    return (
      <Suspense fallback={<div className="p-4 text-sm text-gray-300">Loading...</div>}>
        <GameBoard initialState={fixtureGameState} ws={offlineWebSocket} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<div className="p-4 text-sm text-gray-300">Loading...</div>}>
      {currentRoom ? <GameBoard socket={socket} /> : <LobbyScreen socket={socket} />}
    </Suspense>
  );
}
