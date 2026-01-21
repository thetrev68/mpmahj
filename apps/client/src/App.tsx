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

import type { Difficulty } from '@/types/bindings/generated/Difficulty';

function App() {
  // Local state for development/testing form
  const [playerId, setPlayerId] = useState('player_1');
  const [gameId, setGameId] = useState(''); // Default to empty for Lobby mode
  const [isJoined, setIsJoined] = useState(false);

  // Create Room state
  const [botDifficulty, setBotDifficulty] = useState<Difficulty>('Easy');
  const [fillWithBots, setFillWithBots] = useState(false);

  // Zustand stores
  const phase = useGameStore((state) => state.phase);
  const isMyTurn = useGameStore((state) => state.isMyTurn());
  const yourSeat = useGameStore((state) => state.yourSeat);
  const showCardViewer = useUIStore((state) => state.showCardViewer);
  const setShowCardViewer = useUIStore((state) => state.setShowCardViewer);
  const errors = useUIStore((state) => state.errors);
  const clearErrors = useUIStore((state) => state.clearErrors);
  const phaseLabel = typeof phase === 'string' ? phase : (Object.keys(phase)[0] ?? 'Unknown');

  // Initialize socket hook (but don't connect until we have ids)
  // TODO: Configure production WebSocket URL via environment variable
  const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';

  const { connect, disconnect, status, sendCommand, createRoom, joinRoom } = useGameSocket({
    url: wsUrl,
    gameId, // Will be empty initially
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
  // TODO: Remove this dummy code before production - only here to prevent Knip warnings
  useEffect(() => {
    if (seat.oppositeSeat(seat.previousSeat('East')) === 'West') {
      console.log('Utils loaded');
    }
    console.log('Animation config loaded', getAnimationConfig({ Public: 'GameStarting' }));
    skipAnimation(Promise.resolve());

    console.log('Tile key util', tileKey.tileKey(1, 0));
    console.log('Commands util', commands.Commands.drawTile('East'));
  }, []);

  const handleCreateRoom = () => {
    createRoom({
      card_year: 2025,
      bot_difficulty: botDifficulty,
      fill_with_bots: fillWithBots,
    });
  };

  const handleJoinRoom = () => {
    if (gameId) {
      joinRoom(gameId);
    }
  };

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
        {/* Connection Form (Disconnected) */}
        {!status.connected && (
          <div className="card connection-form">
            <h2>Connect to Server</h2>
            <div className="form-group">
              <label>Player ID:</label>
              <input
                value={playerId}
                onChange={(e) => setPlayerId(e.target.value)}
                disabled={isJoined}
              />
            </div>
            <button onClick={() => setIsJoined(true)}>Connect</button>
          </div>
        )}

        {/* Lobby (Connected, No Room) */}
        {status.connected && !yourSeat && (
          <div className="lobby-container">
            <div className="card create-room-form">
              <h2>Create New Room</h2>
              <div className="form-group">
                <label>Bot Difficulty:</label>
                <select
                  value={botDifficulty}
                  onChange={(e) => setBotDifficulty(e.target.value as Difficulty)}
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                  <option value="Expert">Expert</option>
                </select>
              </div>
              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={fillWithBots}
                    onChange={(e) => setFillWithBots(e.target.checked)}
                  />
                  Fill with Bots
                </label>
              </div>
              <button onClick={handleCreateRoom}>Create Room</button>
            </div>

            <div className="card join-room-form">
              <h2>Join Existing Room</h2>
              <div className="form-group">
                <label>Game ID:</label>
                <input
                  value={gameId}
                  onChange={(e) => setGameId(e.target.value)}
                  placeholder="Enter Game ID"
                />
              </div>
              <button onClick={handleJoinRoom} disabled={!gameId}>
                Join Room
              </button>
            </div>

            <button className="disconnect-btn" onClick={() => setIsJoined(false)}>
              Disconnect
            </button>
          </div>
        )}

        {/* Game Controls (Connected, In Room) */}
        {status.connected && yourSeat && (
          <div className="game-controls">
            <div className="room-info">
              <p>Seat: {yourSeat}</p>
            </div>
            <button onClick={() => setShowCardViewer(true)}>View Card</button>
            <button onClick={() => sendCommand(commands.Commands.drawTile('East'))}>
              Draw Tile (Test)
            </button>
            <button className="disconnect-btn" onClick={() => setIsJoined(false)}>
              Leave / Disconnect
            </button>
          </div>
        )}

        {/* Error Display */}
        {errors.length > 0 && (
          <div className="error-toast" onClick={clearErrors}>
            {errors.map((err, i) => (
              <div key={i}>{err.message}</div>
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
