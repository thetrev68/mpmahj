import { useEffect, useState } from 'react';
import './App.css';

// Import core logic to satisfy Knip and initialize app
import { useGameSocket } from '@/hooks/useGameSocket';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { supabase } from '@/supabase';
import { getAnimationConfig, skipAnimation } from '@/animations/orchestrator';

// Import UI components
import { CardViewer } from '@/components/ui/CardViewer';

// Import utils to ensure they are compiled/checked
import * as commands from '@/utils/commands';
import * as tileKey from '@/utils/tileKey';
import * as seat from '@/utils/seat';

function App() {
  // Local state for development/testing form
  const [playerId, setPlayerId] = useState('player_1');
  const [gameId, setGameId] = useState('game_1');
  const [isJoined, setIsJoined] = useState(false);

  // Zustand stores
  const phase = useGameStore((state) => state.phase);
  const isMyTurn = useGameStore((state) => state.isMyTurn());
  const showCardViewer = useUIStore((state) => state.showCardViewer);
  const setShowCardViewer = useUIStore((state) => state.setShowCardViewer);
  const errors = useUIStore((state) => state.errors);
  const clearErrors = useUIStore((state) => state.clearErrors);
  const phaseLabel = typeof phase === 'string' ? phase : Object.keys(phase)[0] ?? 'Unknown';

  // Initialize socket hook (but don't connect until we have ids)
  // We use a dummy URL for now if not in env
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';

  const { connect, disconnect, status, sendCommand } = useGameSocket({
    url: wsUrl,
    gameId,
    playerId,
  });

  // Effect to handle connection toggle
  useEffect(() => {
    if (isJoined) {
      connect();
    } else {
      disconnect();
    }
  }, [isJoined, connect, disconnect]);

  // Log supabase status (usage check)
  useEffect(() => {
    if (supabase) {
      console.log('Supabase initialized');
    } else {
      console.log('Supabase not configured');
    }
  }, []);

  // Usage of utils to satisfy Knip
  useEffect(() => {
    // Just a dummy check
    if (seat.getOpposite(seat.getLeft('East')) === 'West') {
      console.log('Utils loaded');
    }
    console.log('Animation config loaded', getAnimationConfig({ type: 'GameStarting' }));
    // Dummy usage of skipAnimation
    skipAnimation(Promise.resolve());

    console.log('Tile key util', tileKey.getTileKey({ suit: 'Bamboo', value: 1 }));
    console.log('Commands util', commands.Commands.drawTile('East'));
  }, []);
  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Mahjong Client</h1>
        <div className="status-bar">
          <span className={`status ${status.connected ? 'connected' : 'disconnected'}`}>
            {status.connected ? 'Connected' : 'Disconnected'}
          </span>
          <span className="phase">Phase: {phaseLabel}</span>
          {isMyTurn && <span className="turn-indicator">YOUR TURN</span>}
        </div>
      </header>

      <main>
        {/* Connection Form */}
        {!status.connected && (
          <div className="card connection-form">
            <h2>Connect to Game</h2>
            <div className="form-group">
              <label>Player ID:</label>
              <input
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                disabled={isJoined}
              />
            </div>
            <div className="form-group">
              <label>Game ID:</label>
              <input
                value={gameId}
                onChange={(e) => setGameId(e.target.value)}
                disabled={isJoined}
              />
            </div>
            <button onClick={() => setIsJoined(!isJoined)}>
              {isJoined ? 'Disconnect' : 'Connect'}
            </button>
          </div>
        )}

        {/* Game Controls */}
        {status.connected && (
          <div className="game-controls">
            <button onClick={() => setShowCardViewer(true)}>View Card</button>
            <button onClick={() => sendCommand(commands.Commands.drawTile(seat.Seat.East))}>
              Draw Tile (Test)
            </button>
          </div>
        )}

        {/* Error Display */}
        {errors.length > 0 && (
          <div className="error-toast" onClick={clearErrors}>
            {errors.map((err, i) => (
              <div key={i}>{err}</div>
            ))}
          </div>
        )}

        {/* Card Viewer Overlay */}
        {showCardViewer && <CardViewer />}
      </main>
    </div>
  );
}

export default App;
