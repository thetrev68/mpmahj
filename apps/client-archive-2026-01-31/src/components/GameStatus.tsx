import { useGameStore } from '@/store/gameStore';
import { formatPhase } from '@/utils/phaseFormatter';
import { formatTurn, isYourTurn, canActInCallWindow } from '@/utils/turnFormatter';
import { formatWall } from '@/utils/wallFormatter';
import type { Seat } from '@/types/bindings/generated/Seat';
import './GameStatus.css';

export function GameStatus() {
  const phase = useGameStore((state) => state.phase);
  const remainingTiles = useGameStore((state) => state.remainingTiles);
  const players = useGameStore((state) => state.players);
  const dealer = useGameStore((state) => state.dealer);
  const yourSeat = useGameStore((state) => state.yourSeat);

  const phaseText = formatPhase(phase);
  const turnText = formatTurn(phase, yourSeat);
  const wallText = formatWall(remainingTiles);
  const yourTurn = isYourTurn(phase, yourSeat);
  const canAct = canActInCallWindow(phase, yourSeat);

  const seats: Seat[] = ['East', 'South', 'West', 'North'];

  return (
    <div className="game-status">
      <h2>Game Status</h2>

      <div className="status-info">
        <div className="status-row">
          <span className="status-label">Phase:</span>
          <span className="status-value">{phaseText}</span>
        </div>

        <div className="status-row">
          <span className="status-label">Turn:</span>
          <span className={yourTurn || canAct ? 'status-value highlight-turn' : 'status-value'}>
            {turnText}
          </span>
        </div>

        <div className="status-row">
          <span className="status-label">Wall:</span>
          <span className="status-value">{wallText}</span>
        </div>
      </div>

      <div className="player-table">
        <h3>Players</h3>
        <table>
          <thead>
            <tr>
              <th>Seat</th>
              <th>Tiles</th>
              <th>Melds</th>
              <th>Status</th>
              <th>Info</th>
            </tr>
          </thead>
          <tbody>
            {seats.map((seat) => {
              const player = players[seat];

              if (!player) {
                return (
                  <tr key={seat} className="player-empty">
                    <td>{seat}</td>
                    <td colSpan={4}>-</td>
                  </tr>
                );
              }

              const isYou = seat === yourSeat;
              const isDealer = seat === dealer;
              const infoTags = [
                isDealer && 'Dealer',
                player.is_bot && 'Bot',
                isYou && 'You',
              ].filter(Boolean);

              return (
                <tr key={seat} className={isYou ? 'player-you' : ''}>
                  <td className="seat-cell">{seat}</td>
                  <td className="tiles-cell">{player.tile_count}</td>
                  <td className="melds-cell">{player.exposed_melds.length}</td>
                  <td className="status-cell">{player.status}</td>
                  <td className="info-cell">{infoTags.join(', ')}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
