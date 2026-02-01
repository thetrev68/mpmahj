import { useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import type { Difficulty } from '@/types/bindings/generated/Difficulty';
import type { CreateRoomPayload } from '@/types/bindings/generated/CreateRoomPayload';

interface ConnectionStatus {
  connected: boolean;
  connecting: boolean;
  error: string | null;
  reconnectAttempts: number;
}

interface ConnectionPanelProps {
  status: ConnectionStatus;
  createRoom: (payload: CreateRoomPayload) => boolean;
  joinRoom: (roomId: string) => boolean;
  leaveRoom: () => boolean;
  disconnect: () => void;
}

export function ConnectionPanel({
  status,
  createRoom,
  joinRoom,
  leaveRoom,
  disconnect,
}: ConnectionPanelProps) {
  // Local state
  const [cardYear, setCardYear] = useState(2025);
  const [botDifficulty, setBotDifficulty] = useState<Difficulty | 'Default'>('Default');
  const [fillWithBots, setFillWithBots] = useState(false);
  const [roomIdInput, setRoomIdInput] = useState('');

  // Store state
  const yourSeat = useGameStore((state) => state.yourSeat);
  const errors = useUIStore((state) => state.errors);
  const addError = useUIStore((state) => state.addError);
  const removeError = useUIStore((state) => state.removeError);

  // Handlers
  const handleCreateRoom = () => {
    const payload: CreateRoomPayload = {
      card_year: cardYear,
      bot_difficulty: botDifficulty === 'Default' ? null : botDifficulty,
      fill_with_bots: fillWithBots,
    };

    console.log('Creating room with payload:', payload);
    const success = createRoom(payload);
    if (!success) {
      addError('Failed to create room');
    }
  };

  const handleJoinRoom = () => {
    if (!roomIdInput.trim()) {
      addError('Room ID is required');
      return;
    }

    const success = joinRoom(roomIdInput);
    if (!success) {
      addError('Failed to join room');
    }
  };

  const handleDisconnect = () => {
    if (yourSeat) {
      leaveRoom();
    }
    disconnect();
  };

  const statusDotClass = status.connecting
    ? 'status-dot connecting'
    : status.connected
      ? 'status-dot connected'
      : 'status-dot disconnected';

  return (
    <div className="connection-panel">
      {/* Connection Status */}
      <div className="connection-status">
        <span className={statusDotClass}>●</span>
        <span>
          {status.connecting && 'Connecting...'}
          {status.connected && !status.connecting && 'Connected'}
          {!status.connecting && !status.connected && 'Disconnected'}
        </span>
        {status.connected && yourSeat && <span>Seat: {yourSeat}</span>}
        {status.error && <span className="status-error">Error: {status.error}</span>}
      </div>

      {/* Create Room Form */}
      <div className="create-room-section">
        <h3>Create New Room</h3>
        <div className="form-group">
          <label>
            Card Year:
            <select
              value={cardYear}
              onChange={(e) => setCardYear(Number(e.target.value))}
              disabled={!status.connected}
            >
              <option value={2017}>2017</option>
              <option value={2018}>2018</option>
              <option value={2019}>2019</option>
              <option value={2020}>2020</option>
              <option value={2025}>2025</option>
            </select>
          </label>
        </div>

        <div className="form-group">
          <label>
            Bot Difficulty:
            <select
              value={botDifficulty}
              onChange={(e) => setBotDifficulty(e.target.value as Difficulty | 'Default')}
              disabled={!status.connected}
            >
              <option value="Default">Default (Easy)</option>
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Hard</option>
              <option value="Expert">Expert</option>
            </select>
          </label>
        </div>

        <div className="form-group">
          <label>
            <input
              type="checkbox"
              checked={fillWithBots}
              onChange={(e) => setFillWithBots(e.target.checked)}
              disabled={!status.connected}
            />
            Fill with Bots
          </label>
        </div>

        <button onClick={handleCreateRoom} disabled={!status.connected}>
          Create Room
        </button>
      </div>

      {/* Join Room Form */}
      <div className="join-room-section">
        <h3>Join Existing Room</h3>
        <div className="form-group">
          <label>
            Room ID:
            <input
              type="text"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value)}
              placeholder="Enter room ID"
              disabled={!status.connected}
            />
          </label>
        </div>

        <button onClick={handleJoinRoom} disabled={!status.connected || !roomIdInput.trim()}>
          Join Room
        </button>
      </div>

      {/* Disconnect Button */}
      <div className="disconnect-section">
        <button className="disconnect-btn" onClick={handleDisconnect}>
          {yourSeat ? 'Leave Room & Disconnect' : 'Disconnect'}
        </button>
      </div>

      {/* Error Display */}
      {errors.length > 0 && (
        <div className="error-container">
          {errors.map((error) => (
            <div key={error.id} className="error-message" onClick={() => removeError(error.id)}>
              ⚠ {error.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
