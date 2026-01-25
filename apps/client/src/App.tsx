import './App.css';
import { useRef } from 'react';

// Core hooks and stores
import { useGameSocket } from '@/hooks/useGameSocket';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';

// Import UI components
import { CardViewer } from '@/components/ui/CardViewer';
import { HintPanel, MultiHintPanel } from '@/components/ui/HintPanel';
import { PatternSuggestions } from '@/components/ui/PatternSuggestions';
import { ConnectionPanel } from '@/components/ConnectionPanel';
import { GameStatus } from '@/components/GameStatus';
import { HandDisplay } from '@/components/HandDisplay';
import { TurnActions } from '@/components/TurnActions';
import { EventLog } from '@/components/EventLog';
import { DiscardPile } from '@/components/DiscardPile';
import { analysisStore } from '@/store/analysisStore';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

// Import phase helpers
import { isWaitingForPlayers, isPlayingPhase } from '@/utils/phaseHelpers';

function App() {
  // Persistent session token ref (survives React StrictMode remounts)
  const sessionTokenRef = useRef<string | null>(null);

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
    persistentSessionToken: sessionTokenRef,
  });

  // Compute visibility flags
  const showGameStatus = !!yourSeat;
  const showDiscardPile = isPlayingPhase(phase);
  const showHandDisplay = yourHand.length > 0;
  const showTurnActions = yourSeat && !isWaitingForPlayers(phase);
  const hintsEnabled = (import.meta.env.VITE_ENABLE_HINTS ?? 'true') === 'true';

  // Request hints for all three verbosity levels (for testing)
  const requestAllHints = () => {
    if (!yourSeat) return;

    const store = analysisStore.getState();
    store.clearPendingRequests();

    // Enqueue three hint requests
    const verbosities: Array<'Beginner' | 'Intermediate' | 'Expert'> = [
      'Beginner',
      'Intermediate',
      'Expert',
    ];

    verbosities.forEach((verbosity) => {
      store.enqueuePendingRequest(verbosity);
      const command: GameCommand = {
        RequestHint: {
          player: yourSeat,
          verbosity,
        },
      };
      socket.sendCommand(command);
    });
  };

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

            {/* Minimal Hint UI (scaffold) */}
            {hintsEnabled && (
              <>
                <HintPanel />
                <PatternSuggestions />

                {/* Multi-Hint Testing Panel */}
                <MultiHintPanel />

                {/* Hint Testing Controls */}
                {showTurnActions && (
                  <div style={{ marginTop: 8, marginBottom: 8 }}>
                    <button onClick={requestAllHints}>Request All Hints (Testing)</button>
                  </div>
                )}
              </>
            )}

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
