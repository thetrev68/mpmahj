import './App.css';

// Core hooks and stores
import { useGameSocket } from '@/hooks/useGameSocket';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';

// Import UI components
import { CardViewer } from '@/components/ui/CardViewer';
import { ConnectionPanel } from '@/components/ConnectionPanel';
import { GameStatus } from '@/components/GameStatus';
import { HandDisplay } from '@/components/HandDisplay';
import { TurnActions } from '@/components/TurnActions';
import { EventLog } from '@/components/EventLog';
import { DiscardPile } from '@/components/DiscardPile';

// Import phase helpers
import { isWaitingForPlayers, isPlayingPhase } from '@/utils/phaseHelpers';

function App() {
  // Zustand stores
  const yourSeat = useGameStore((state) => state.yourSeat);
  const yourHand = useGameStore((state) => state.yourHand);
  const phase = useGameStore((state) => state.phase);
  const showCardViewer = useUIStore((state) => state.showCardViewer);
  const setShowCardViewer = useUIStore((state) => state.setShowCardViewer);

  // Initialize socket hook
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';

  const socket = useGameSocket({
    url: wsUrl,
    gameId: '',
    playerId: 'player_1',
  });

  // Compute visibility flags
  const showGameStatus = !!yourSeat;
  const showDiscardPile = isPlayingPhase(phase);
  const showHandDisplay = yourHand.length > 0;
  const showTurnActions = yourSeat && !isWaitingForPlayers(phase);

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <h1>Mahjong Client</h1>
      </header>

      {/* Main Content */}
      <main className="app-main">
        {/* Connection Panel - Always visible */}
        <ConnectionPanel
          status={socket.status}
          createRoom={socket.createRoom}
          joinRoom={socket.joinRoom}
          leaveRoom={socket.leaveRoom}
          disconnect={socket.disconnect}
        />

        {/* Game UI - Conditional rendering */}
        {showGameStatus && (
          <div className="game-ui">
            {/* Game Status - When in room */}
            <GameStatus />

            {/* Discard Pile - During Playing phase */}
            {showDiscardPile && <DiscardPile />}

            {/* Hand Display - When you have tiles */}
            {showHandDisplay && <HandDisplay />}

            {/* Turn Actions - When game started */}
            {showTurnActions && <TurnActions sendCommand={socket.sendCommand} />}

            {/* Card Viewer Button */}
            <button onClick={() => setShowCardViewer(true)}>View Card</button>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="app-footer">
        {/* Event Log - Always visible */}
        <EventLog />
      </footer>

      {/* Card Viewer Overlay */}
      {showCardViewer && <CardViewer />}
    </div>
  );
}

export default App;
