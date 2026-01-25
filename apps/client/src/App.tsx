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
import { JokerExchangeDialog } from '@/components/JokerExchangeDialog';
import { MeldUpgradeDialog } from '@/components/MeldUpgradeDialog';
import { GameMenu } from '@/components/GameMenu';
import { HistoryPanel } from '@/components/HistoryPanel';
import { LeaveConfirmation } from '@/components/LeaveConfirmation';
import { ForfeitDialog } from '@/components/ForfeitDialog';
import { AbandonDialog } from '@/components/AbandonDialog';
import { HostControls } from '@/components/HostControls';
import { PauseOverlay } from '@/components/PauseOverlay';
import { UndoVoteDialog } from '@/components/UndoVoteDialog';
import { UndoAnimation } from '@/components/UndoAnimation';
import { analysisStore } from '@/store/analysisStore';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import { useHistory } from '@/hooks/useHistory';

// Import phase helpers
import { isWaitingForPlayers, isPlayingPhase } from '@/utils/phaseHelpers';

function App() {
  // Persistent session token ref (survives React StrictMode remounts)
  const sessionTokenRef = useRef<string | null>(null);

  // Zustand stores
  const yourSeat = useGameStore((state) => state.yourSeat);
  const yourHand = useGameStore((state) => state.yourHand);
  const phase = useGameStore((state) => state.phase);
  const history = useGameStore((state) => state.history);
  const showCardViewer = useUIStore((state) => state.showCardViewer);
  const setShowCardViewer = useUIStore((state) => state.setShowCardViewer);
  const setShowGameMenu = useUIStore((state) => state.setShowGameMenu);
  const setShowHistoryPanel = useUIStore((state) => state.setShowHistoryPanel);

  // Initialize socket hook
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';

  const socket = useGameSocket({
    url: wsUrl,
    gameId: '',
    playerId: 'player_1',
    persistentSessionToken: sessionTokenRef,
  });

  const { returnToPresent } = useHistory(socket.sendCommand);

  // Compute visibility flags
  const showGameStatus = !!yourSeat;
  const showDiscardPile = isPlayingPhase(phase);
  const showHandDisplay = yourHand.length > 0;
  const showTurnActions = yourSeat && !isWaitingForPlayers(phase);
  const hintsEnabled = (import.meta.env.VITE_ENABLE_HINTS ?? 'true') === 'true';
  const viewingMove = history.viewingMove ?? history.currentMove;

  const handleReturnToPresent = () => {
    returnToPresent();
    setShowHistoryPanel(false);
  };

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
          <div className={`game-ui${history.isViewingHistory ? ' history-mode' : ''}`}>
            {/* Game Status - When in room */}
            <GameStatus />

            {history.isViewingHistory && (
              <div className="history-banner">
                <div>
                  Viewing History - Move {viewingMove} of {history.moves.length}
                </div>
                <button onClick={handleReturnToPresent}>Return to Present</button>
              </div>
            )}

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

            {/* Host Controls - Pause/Resume */}
            <HostControls sendCommand={socket.sendCommand} />

            {/* Card Viewer Button */}
            <button onClick={() => setShowCardViewer(true)}>View Card</button>

            {/* Game Menu Button */}
            <button onClick={() => setShowGameMenu(true)} style={{ marginLeft: '8px' }}>
              Game Menu
            </button>
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

      {/* Game Action Dialogs */}
      <JokerExchangeDialog sendCommand={socket.sendCommand} />
      <MeldUpgradeDialog sendCommand={socket.sendCommand} />

      {/* Game Menu and Exit Dialogs */}
      <GameMenu />
      <HistoryPanel sendCommand={socket.sendCommand} />
      <LeaveConfirmation sendCommand={socket.sendCommand} leaveRoom={socket.leaveRoom} />
      <ForfeitDialog sendCommand={socket.sendCommand} />
      <AbandonDialog sendCommand={socket.sendCommand} />
      <UndoVoteDialog sendCommand={socket.sendCommand} />

      {/* Pause Overlay */}
      <PauseOverlay sendCommand={socket.sendCommand} />

      {/* Undo Animation */}
      <UndoAnimation />
    </div>
  );
}

export default App;
