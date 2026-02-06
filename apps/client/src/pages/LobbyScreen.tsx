/**
 * LobbyScreen Component
 *
 * Main lobby screen showing available rooms and create room functionality
 *
 * User Stories:
 * - US-029: Create Room
 * - US-030: Join Room (future)
 */

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { CreateRoomForm } from '@/components/game/CreateRoomForm';
import { JoinRoomDialog } from '@/components/game/JoinRoomDialog';
import {
  useGameSocket,
  createRoomEnvelope,
  createJoinRoomEnvelope,
  type Envelope,
} from '@/hooks/useGameSocket';
import { useRoomStore } from '@/stores/roomStore';
import type { CreateRoomPayload } from '@/types/bindings/generated/CreateRoomPayload';
import type { Seat } from '@/types/bindings/generated/Seat';

/**
 * LobbyScreen Component
 */
export function LobbyScreen() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [lastSuccessAction, setLastSuccessAction] = useState<'created' | 'joined' | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCreateEnvelopeRef = useRef<Envelope | null>(null);

  const { send, subscribe, connectionState } = useGameSocket();
  const {
    currentRoom,
    roomCreation,
    roomJoining,
    startRoomCreation,
    finishRoomCreation,
    failRoomCreation,
    retryRoomCreation,
    startRoomJoining,
    finishRoomJoining,
    failRoomJoining,
  } = useRoomStore();

  /**
   * Handle room creation submission
   */
  const handleCreateRoom = (payload: CreateRoomPayload) => {
    startRoomCreation();

    const envelope = createRoomEnvelope(
      payload.room_name,
      payload.card_year,
      payload.fill_with_bots,
      payload.bot_difficulty
    );

    lastCreateEnvelopeRef.current = envelope;
    send(envelope);
  };

  /**
   * Handle retry loop for room creation
   */
  useEffect(() => {
    if (!roomCreation.isCreating) {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      return;
    }

    if (roomCreation.retryCount >= 3) {
      failRoomCreation('Failed to create room after 3 attempts');
      return;
    }

    retryTimeoutRef.current = setTimeout(() => {
      const envelope = lastCreateEnvelopeRef.current;
      if (!envelope) {
        return;
      }
      retryRoomCreation();
      send(envelope);
    }, 5000);

    return () => {
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [roomCreation.isCreating, roomCreation.retryCount, retryRoomCreation, send, failRoomCreation]);

  /**
   * Handle join room submission
   */
  const handleJoinRoom = (roomCode: string) => {
    startRoomJoining();
    const envelope = createJoinRoomEnvelope(roomCode);
    send(envelope);
  };

  /**
   * Subscribe to RoomJoined events
   */
  useEffect(() => {
    const unsubscribe = subscribe('RoomJoined', (envelope: Envelope) => {
      const payload = envelope.payload as { room_id: string; seat: Seat };

      // Finish whichever flow was active (create or join)
      const roomInfo = {
        room_id: payload.room_id,
        seat: payload.seat,
        status: 'waiting' as const,
      };

      if (roomCreation.isCreating) {
        setLastSuccessAction('created');
        finishRoomCreation(roomInfo);
        setIsCreateDialogOpen(false);
      } else if (roomJoining.isJoining) {
        setLastSuccessAction('joined');
        finishRoomJoining(roomInfo);
        setIsJoinDialogOpen(false);
      }

      setShowSuccessMessage(true);

      // Hide success message after 3 seconds
      setTimeout(() => setShowSuccessMessage(false), 3000);
    });

    return unsubscribe;
  }, [subscribe, finishRoomCreation, finishRoomJoining, roomCreation.isCreating, roomJoining.isJoining]);

  /**
   * Subscribe to Error events
   */
  useEffect(() => {
    const unsubscribe = subscribe('Error', (envelope: Envelope) => {
      const payload = envelope.payload as { code: string; message: string };

      // Fail whichever flow was active
      if (roomCreation.isCreating) {
        failRoomCreation(payload.message);
      } else if (roomJoining.isJoining) {
        failRoomJoining(payload.message);
      }
    });

    return unsubscribe;
  }, [subscribe, failRoomCreation, failRoomJoining, roomCreation.isCreating, roomJoining.isJoining]);

  /**
   * Handle deep-link join (?join=1&code=ABCDE)
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const shouldJoin = params.get('join') === '1';
    const codeParam = params.get('code');
    if (shouldJoin && codeParam) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setJoinCode(codeParam.toUpperCase());
      setIsJoinDialogOpen(true);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, []);

  const normalizeJoinCode = (value: string) =>
    value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 5);

  const handleJoinCodeChange = (value: string) => {
    setJoinCode(normalizeJoinCode(value));
  };

  const handleCopyInviteLink = async () => {
    if (!currentRoom) return;
    const link = `${window.location.origin}/?join=1&code=${currentRoom.room_id}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      // Clipboard write may fail in some browsers or non-secure contexts.
    }
  };

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
          {lastSuccessAction === 'created' ? (
            <>
              <p className="text-green-800 dark:text-green-200">
                Room created successfully. Waiting for players...
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                Room Code: {currentRoom.room_id}
              </p>
              <div className="mt-3">
                <Button variant="outline" onClick={handleCopyInviteLink}>
                  Copy Link
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-green-800 dark:text-green-200">
                Joined room successfully. Waiting for players...
              </p>
              <p className="text-sm text-green-600 dark:text-green-400">
                Room Code: {currentRoom.room_id}
              </p>
            </>
          )}
        </div>
      )}

      {/* Error Messages */}
      {roomCreation.error && (
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
          <p className="text-red-800 dark:text-red-200">{roomCreation.error}</p>
          {roomCreation.isCreating && roomCreation.retryCount < 3 && (
            <p className="text-sm text-red-600 dark:text-red-400">Retrying...</p>
          )}
        </div>
      )}
      {roomJoining.error && (
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/20">
          <p className="text-red-800 dark:text-red-200">{roomJoining.error}</p>
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

      {/* Primary Actions */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          onClick={() => setIsCreateDialogOpen(true)}
          disabled={connectionState !== 'connected'}
        >
          Create Room
        </Button>
        <Button
          size="lg"
          variant="outline"
          onClick={() => setIsJoinDialogOpen(true)}
          disabled={connectionState !== 'connected'}
        >
          Join Room
        </Button>
      </div>

      {/* Create Room Form Dialog */}
      <CreateRoomForm
        isOpen={isCreateDialogOpen}
        onSubmit={handleCreateRoom}
        onCancel={() => setIsCreateDialogOpen(false)}
        isSubmitting={roomCreation.isCreating}
      />

      {/* Join Room Dialog */}
      <JoinRoomDialog
        isOpen={isJoinDialogOpen}
        code={joinCode}
        isSubmitting={roomJoining.isJoining}
        onCodeChange={handleJoinCodeChange}
        onSubmit={handleJoinRoom}
        onCancel={() => setIsJoinDialogOpen(false)}
      />
    </div>
  );
}
