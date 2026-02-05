/**
 * LobbyScreen Component
 *
 * Main lobby screen showing available rooms and create room functionality
 *
 * User Stories:
 * - US-029: Create Room
 * - US-030: Join Room (future)
 */

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { CreateRoomForm } from '@/components/game/CreateRoomForm';
import { useGameSocket, createRoomEnvelope, type Envelope } from '@/hooks/useGameSocket';
import { useRoomStore } from '@/stores/roomStore';
import type { CreateRoomPayload } from '@/types/bindings/generated/CreateRoomPayload';

/**
 * LobbyScreen Component
 */
export function LobbyScreen() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const { send, subscribe, connectionState } = useGameSocket();
  const {
    currentRoom,
    roomCreation,
    startRoomCreation,
    finishRoomCreation,
    failRoomCreation,
    retryRoomCreation,
  } = useRoomStore();

  /**
   * Handle room creation submission
   */
  const handleCreateRoom = (payload: CreateRoomPayload) => {
    startRoomCreation();

    const envelope = createRoomEnvelope(
      payload.card_year,
      payload.fill_with_bots,
      payload.bot_difficulty
    );

    send(envelope);

    // Set timeout for retry logic
    const timeoutId = setTimeout(() => {
      if (roomCreation.isCreating && roomCreation.retryCount < 3) {
        retryRoomCreation();
        send(envelope);
      } else if (roomCreation.isCreating) {
        failRoomCreation('Failed to create room after 3 attempts');
      }
    }, 5000);

    // Store timeout ID for cleanup
    return () => clearTimeout(timeoutId);
  };

  /**
   * Subscribe to RoomJoined events
   */
  useEffect(() => {
    const unsubscribe = subscribe('RoomJoined', (envelope: Envelope) => {
      const payload = envelope.payload as { room_id: string; seat: string };
      finishRoomCreation({
        room_id: payload.room_id,
        seat: payload.seat as 'East' | 'South' | 'West' | 'North',
        status: 'waiting',
      });
      setIsCreateDialogOpen(false);
      setShowSuccessMessage(true);

      // Hide success message after 3 seconds
      setTimeout(() => setShowSuccessMessage(false), 3000);
    });

    return unsubscribe;
  }, [subscribe, finishRoomCreation]);

  /**
   * Subscribe to Error events
   */
  useEffect(() => {
    const unsubscribe = subscribe('Error', (envelope: Envelope) => {
      const payload = envelope.payload as { code: string; message: string };
      failRoomCreation(payload.message);
    });

    return unsubscribe;
  }, [subscribe, failRoomCreation]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <div className="text-center">
        <h1 className="mb-2 text-4xl font-bold">American Mahjong</h1>
        <p className="text-muted-foreground">
          {connectionState === 'connected' ? 'Connected' : 'Connecting...'}
        </p>
      </div>

      {/* Success Message */}
      {showSuccessMessage && currentRoom && (
        <div className="rounded-md bg-green-50 p-4 dark:bg-green-900/20">
          <p className="text-green-800 dark:text-green-200">
            Room created successfully. Waiting for players...
          </p>
          <p className="text-sm text-green-600 dark:text-green-400">
            Room ID: {currentRoom.room_id}
          </p>
        </div>
      )}

      {/* Error Message */}
      {roomCreation.error && (
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
          <p className="text-red-800 dark:text-red-200">{roomCreation.error}</p>
          {roomCreation.retryCount < 3 && (
            <p className="text-sm text-red-600 dark:text-red-400">Retrying...</p>
          )}
        </div>
      )}

      {/* Reconnecting Message */}
      {connectionState === 'error' && (
        <div className="rounded-md bg-yellow-50 p-4 dark:bg-yellow-900/20">
          <p className="text-yellow-800 dark:text-yellow-200">
            Connection lost. Reconnecting...
          </p>
        </div>
      )}

      {/* Create Room Button */}
      <Button
        size="lg"
        onClick={() => setIsCreateDialogOpen(true)}
        disabled={connectionState !== 'connected'}
      >
        Create Room
      </Button>

      {/* Create Room Form Dialog */}
      <CreateRoomForm
        isOpen={isCreateDialogOpen}
        onSubmit={handleCreateRoom}
        onCancel={() => setIsCreateDialogOpen(false)}
        isSubmitting={roomCreation.isCreating}
      />
    </div>
  );
}
