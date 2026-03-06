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
  type InboundEnvelope,
  type OutboundEnvelope,
  type UseGameSocketReturn,
} from '@/hooks/useGameSocket';
import { useRoomStore } from '@/stores/roomStore';
import type { CreateRoomPayload } from '@/types/bindings/generated/CreateRoomPayload';

interface LobbyScreenProps {
  socket?: UseGameSocketReturn;
}

const JOIN_REQUEST_TIMEOUT_MS = 8000;
const normalizeJoinCode = (value: string) =>
  value
    .trim()
    .replace(/[^0-9A-Za-z-]/g, '')
    .slice(0, 64);

const getInitialJoinIntent = (): { isJoinDialogOpen: boolean; joinCode: string } => {
  const params = new URLSearchParams(window.location.search);
  const shouldJoin = params.get('join') === '1';
  const codeParam = params.get('code');
  return {
    isJoinDialogOpen: shouldJoin && codeParam !== null,
    joinCode: shouldJoin && codeParam ? normalizeJoinCode(codeParam) : '',
  };
};

/**
 * LobbyScreen Component
 */
export function LobbyScreen({ socket }: LobbyScreenProps = {}) {
  const [initialJoinIntent] = useState(getInitialJoinIntent);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(initialJoinIntent.isJoinDialogOpen);
  const [joinCode, setJoinCode] = useState(initialJoinIntent.joinCode);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [lastSuccessAction, setLastSuccessAction] = useState<'created' | 'joined' | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCreateEnvelopeRef = useRef<OutboundEnvelope | null>(null);

  const internalSocket = useGameSocket({ enabled: !socket });
  const { send, subscribe, connectionState } = socket ?? internalSocket;
  const {
    currentRoom,
    roomCreation,
    roomJoining,
    setCurrentRoom,
    startRoomCreation,
    failRoomCreation,
    retryRoomCreation,
    startRoomJoining,
  } = useRoomStore();

  /**
   * Handle room creation submission
   */
  const handleCreateRoom = (payload: CreateRoomPayload) => {
    startRoomCreation();

    const envelope = createRoomEnvelope(payload);

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
   * Handle join timeout to avoid indefinite "Joining..." deadlocks when requests are dropped.
   */
  useEffect(() => {
    if (!roomJoining.isJoining) {
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
      return;
    }

    joinTimeoutRef.current = setTimeout(() => {
      const store = useRoomStore.getState();
      if (store.roomJoining.isJoining) {
        store.failRoomJoining('Join request timed out. Please try again.');
      }
    }, JOIN_REQUEST_TIMEOUT_MS);

    return () => {
      if (joinTimeoutRef.current) {
        clearTimeout(joinTimeoutRef.current);
        joinTimeoutRef.current = null;
      }
    };
  }, [roomJoining.isJoining]);

  /**
   * Handle join room submission
   */
  const handleJoinRoom = (roomCode: string) => {
    startRoomJoining();
    const envelope = createJoinRoomEnvelope(roomCode);
    send(envelope);
  };

  /**
   * Subscribe to RoomJoined events.
   *
   * Uses `useRoomStore.getState()` to read current state inside the callback to
   * avoid a stale-closure race condition: on a fast (local) server the response
   * can arrive before React has re-run the effect with the updated `isCreating`
   * value, causing the old closure (isCreating=false) to silently drop the event.
   */
  useEffect(() => {
    const unsubscribe = subscribe('RoomJoined', (envelope: InboundEnvelope) => {
      if (envelope.kind !== 'RoomJoined') {
        return;
      }
      const payload = envelope.payload;

      const roomInfo = {
        room_id: payload.room_id,
        seat: payload.seat,
        status: 'waiting' as const,
      };

      // Read live state from the Zustand store — no stale closure.
      const store = useRoomStore.getState();
      console.debug('[LobbyScreen] RoomJoined received', {
        roomInfo,
        isCreating: store.roomCreation.isCreating,
        isJoining: store.roomJoining.isJoining,
      });

      if (store.roomCreation.isCreating) {
        setLastSuccessAction('created');
        store.finishRoomCreation(roomInfo);
        setIsCreateDialogOpen(false);
      } else if (store.roomJoining.isJoining) {
        setLastSuccessAction('joined');
        store.finishRoomJoining(roomInfo);
        setIsJoinDialogOpen(false);
      } else {
        console.warn(
          '[LobbyScreen] RoomJoined received but no active flow (isCreating=false, isJoining=false)'
        );
      }

      // Request a fresh state snapshot immediately after room join/create.
      // Some flows do not receive an automatic snapshot push, which can leave
      // clients on the room-waiting surface indefinitely.
      send({
        kind: 'Command',
        payload: {
          command: {
            RequestState: {
              player: payload.seat,
            },
          },
        },
      });

      setShowSuccessMessage(true);
      setTimeout(() => setShowSuccessMessage(false), 3000);
    });

    return unsubscribe;
  }, [send, subscribe]);

  /**
   * Subscribe to Error events.
   *
   * Same `getState()` pattern to avoid stale-closure issues.
   */
  useEffect(() => {
    const unsubscribe = subscribe('Error', (envelope: InboundEnvelope) => {
      if (envelope.kind !== 'Error') {
        return;
      }
      const payload = envelope.payload;

      const store = useRoomStore.getState();
      console.debug('[LobbyScreen] Error received', {
        code: payload.code,
        message: payload.message,
        isCreating: store.roomCreation.isCreating,
        isJoining: store.roomJoining.isJoining,
      });

      if (store.roomCreation.isCreating) {
        store.failRoomCreation(payload.message);
      } else if (store.roomJoining.isJoining) {
        store.failRoomJoining(payload.message);
      }
    });

    return unsubscribe;
  }, [subscribe]);

  /**
   * Restore in-room route after full page refresh.
   *
   * On refresh, roomStore resets in-memory state to lobby. If server auth confirms
   * this session is still in a room, hydrate currentRoom so App routes back to GameBoard.
   */
  useEffect(() => {
    const unsubscribe = subscribe('AuthSuccess', (envelope: InboundEnvelope) => {
      if (envelope.kind !== 'AuthSuccess') {
        return;
      }
      const payload = envelope.payload;

      if (!payload?.room_id || !payload.seat) {
        return;
      }

      setCurrentRoom({
        room_id: payload.room_id,
        seat: payload.seat,
        status: 'waiting',
      });
    });

    return unsubscribe;
  }, [setCurrentRoom, subscribe]);

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
          <p className="text-yellow-800 dark:text-yellow-200">Connection lost. Reconnecting...</p>
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
