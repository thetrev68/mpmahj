/**
 * SeatDiagram Component
 *
 * Visual compass-style layout showing 4 seats with their occupancy status
 */

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { PlayerInfo } from '@/stores/roomStore';

export interface SeatDiagramProps {
  occupiedSeats: Record<string, PlayerInfo>;
  selectedSeat: Seat | null;
  onSeatSelect: (seat: Seat) => void;
}

const SEAT_POSITIONS = {
  North: 'col-start-2 row-start-1',
  East: 'col-start-3 row-start-2',
  South: 'col-start-2 row-start-3',
  West: 'col-start-1 row-start-2',
} as const;

export function SeatDiagram({ occupiedSeats, selectedSeat, onSeatSelect }: SeatDiagramProps) {
  const seats: Seat[] = ['East', 'South', 'West', 'North'];

  const isSeatOccupied = (seat: Seat): boolean => {
    return seat in occupiedSeats;
  };

  const getSeatPlayer = (seat: Seat): PlayerInfo | undefined => {
    return occupiedSeats[seat];
  };

  return (
    <div className="grid grid-cols-3 grid-rows-3 gap-4 p-8">
      {/* Center square */}
      <div className="col-start-2 row-start-2 flex items-center justify-center">
        <div className="h-16 w-16 rounded-lg bg-muted" />
      </div>

      {/* Seats in compass positions */}
      {seats.map((seat) => {
        const isOccupied = isSeatOccupied(seat);
        const player = getSeatPlayer(seat);
        const isSelected = selectedSeat === seat;

        return (
          <div key={seat} className={cn('flex flex-col items-center gap-2', SEAT_POSITIONS[seat])}>
            <span className="text-sm font-semibold text-muted-foreground">{seat}</span>
            {isOccupied && player ? (
              <div className="flex h-20 w-32 items-center justify-center rounded-lg border-2 border-muted bg-muted/50 px-4 py-2 text-center">
                <span className="text-sm text-muted-foreground">{player.display_name}</span>
              </div>
            ) : (
              <Button
                variant={isSelected ? 'default' : 'outline'}
                className={cn('h-20 w-32', isSelected && 'ring-2 ring-primary ring-offset-2')}
                onClick={() => onSeatSelect(seat)}
              >
                {seat}
              </Button>
            )}
          </div>
        );
      })}
    </div>
  );
}
