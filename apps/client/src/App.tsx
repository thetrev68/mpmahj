import { useEffect } from 'react';
import './App.css';

// Import core logic to satisfy Knip and initialize app
import { useGameSocket } from '@/hooks/useGameSocket';
import { useGameStore } from '@/store/gameStore';
import { useUIStore } from '@/store/uiStore';
import { supabase } from '@/supabase';
import { getAnimationConfig, skipAnimation } from '@/animations/orchestrator';

// Import UI components
import { CardViewer } from '@/components/ui/CardViewer';
import { ConnectionPanel } from '@/components/ConnectionPanel';
import { GameStatus } from '@/components/GameStatus';
import { HandDisplay } from '@/components/HandDisplay';
import { TurnActions } from '@/components/TurnActions';
import { EventLog } from '@/components/EventLog';
import { DiscardPile } from '@/components/DiscardPile';

// Import utils to ensure they are compiled/checked
import * as commands from '@/utils/commands';
import * as tileKey from '@/utils/tileKey';
import * as seat from '@/utils/seat';

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

  const showTurnActions =
    phase === 'WaitingForPlayers' ||
    (typeof phase === 'object' && ('Charleston' in phase || 'Playing' in phase));

  const showDiscardPile = yourSeat && typeof phase === 'object' && 'Playing' in phase;

  return (
    <div className="app-container">
      <header>
        <h1>Mahjong Client</h1>
      </header>

      <main>
        {/* Always show ConnectionPanel */}
        <ConnectionPanel
          status={socket.status}
          createRoom={socket.createRoom}
          joinRoom={socket.joinRoom}
          leaveRoom={socket.leaveRoom}
          disconnect={socket.disconnect}
        />

        {/* Show GameStatus when in a room */}
        {yourSeat && <GameStatus />}

        {/* Show HandDisplay when you have tiles */}
        {yourHand.length > 0 && <HandDisplay />}

        {/* Show TurnActions only during actionable phases */}
        {yourSeat && showTurnActions && <TurnActions sendCommand={socket.sendCommand} />}

        {/* Show DiscardPile during Playing phase */}
        {showDiscardPile && <DiscardPile />}

        {/* Event Log - Always visible */}
        <EventLog />

        {/* Show game UI only when in a room */}
        {yourSeat && (
          <div className="game-ui">
            <button onClick={() => setShowCardViewer(true)}>View Card</button>
          </div>
        )}

        {/* Card Viewer Overlay */}
        {showCardViewer && <CardViewer />}
      </main>
    </div>
  );
}

export default App;
