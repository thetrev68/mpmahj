/**
 * SeatSelectionDialog Component
 *
 * Modal dialog for selecting a seat when joining a room
 */

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { SeatDiagram } from './SeatDiagram';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { LobbyRoomInfo } from '@/stores/roomStore';

export interface SeatSelectionDialogProps {
  room: LobbyRoomInfo;
  isOpen: boolean;
  isJoining: boolean;
  onClose: () => void;
  onJoin: (seat: Seat | null) => void;
}

export function SeatSelectionDialog({
  room,
  isOpen,
  isJoining,
  onClose,
  onJoin,
}: SeatSelectionDialogProps) {
  const [selectedSeat, setSelectedSeat] = useState<Seat | null>(null);

  const handleJoinAsSelected = () => {
    if (selectedSeat) {
      onJoin(selectedSeat);
    }
  };

  const handleJoinAny = () => {
    onJoin(null);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Select Your Seat</DialogTitle>
          <DialogDescription>
            Joining {room.room_name}. Choose a seat or auto-assign to any available seat.
          </DialogDescription>
        </DialogHeader>

        <SeatDiagram
          occupiedSeats={room.occupied_seats || {}}
          selectedSeat={selectedSeat}
          onSeatSelect={setSelectedSeat}
        />

        {isJoining && (
          <div className="text-center text-sm text-muted-foreground">Joining room...</div>
        )}

        <DialogFooter className="flex justify-between gap-2 sm:justify-between">
          <Button variant="outline" onClick={onClose} disabled={isJoining}>
            Cancel
          </Button>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleJoinAny} disabled={isJoining}>
              Join Any Seat
            </Button>
            {selectedSeat && (
              <Button onClick={handleJoinAsSelected} disabled={isJoining}>
                Join as {selectedSeat}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
