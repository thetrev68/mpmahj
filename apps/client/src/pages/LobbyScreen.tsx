/**
 * LobbyScreen Component
 *
 * Main lobby screen showing available rooms and create room functionality
 *
 * User Stories:
 * - US-029: Create Room
 * - US-030: Join Room (future)
 */

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreateRoomForm } from '@/components/game/CreateRoomForm';
import { JoinRoomDialog } from '@/components/game/JoinRoomDialog';
import {
  useGameSocket,
  createRoomEnvelope,
  createJoinRoomEnvelope,
  createJwtAuthenticateEnvelope,
  type InboundEnvelope,
  type OutboundEnvelope,
  type UseGameSocketReturn,
} from '@/hooks/useGameSocket';
import {
  getAccessTokenFromSupabaseSession,
  sendMagicLink,
  signInWithEmailPassword,
  signUpWithEmailPassword,
} from '@/lib/supabaseAuth';
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
  const [authMode, setAuthMode] = useState<'sign_in' | 'sign_up'>('sign_in');
  const [initialJoinIntent] = useState(getInitialJoinIntent);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isJoinDialogOpen, setIsJoinDialogOpen] = useState(initialJoinIntent.isJoinDialogOpen);
  const [joinCode, setJoinCode] = useState(initialJoinIntent.joinCode);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [lastSuccessAction, setLastSuccessAction] = useState<'created' | 'joined' | null>(null);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [isSendingMagicLink, setIsSendingMagicLink] = useState(false);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const joinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCreateEnvelopeRef = useRef<OutboundEnvelope | null>(null);
  const attemptedSessionBootstrapRef = useRef(false);

  const internalSocket = useGameSocket({ enabled: !socket });
  const {
    send,
    subscribe,
    connectionState,
    lifecycleState,
    recoveryAction,
    recoveryMessage,
    clearRecoveryAction,
    connect,
  } = socket ?? internalSocket;
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
      setAuthError(null);
      setAuthNotice(null);
      setIsAuthenticating(false);
      setPasswordInput('');

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

  useEffect(() => {
    const unsubscribe = subscribe('AuthFailure', (envelope: InboundEnvelope) => {
      if (envelope.kind !== 'AuthFailure') {
        return;
      }

      setIsAuthenticating(false);
      setAuthError(envelope.payload?.reason ?? 'Authentication failed.');
      setAuthNotice(null);
    });

    return unsubscribe;
  }, [subscribe]);

  useEffect(() => {
    if (recoveryAction !== 'return_login' || attemptedSessionBootstrapRef.current) {
      return;
    }
    attemptedSessionBootstrapRef.current = true;

    void (async () => {
      try {
        const token = await getAccessTokenFromSupabaseSession();
        if (!token) {
          return;
        }
        clearRecoveryAction();
        send(createJwtAuthenticateEnvelope(token));
      } catch {
        // Ignore bootstrap errors and let user use interactive auth controls.
      }
    })();
  }, [clearRecoveryAction, recoveryAction, send]);

  useEffect(() => {
    if (connectionState === 'error' && isAuthenticating) {
      setIsAuthenticating(false);
    }
  }, [connectionState, isAuthenticating]);

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

  const canStartActions = lifecycleState === 'authenticated';
  const statusText =
    lifecycleState === 'terminal_recovery'
      ? 'Authentication required'
      : lifecycleState === 'authenticated'
        ? 'Connected'
      : lifecycleState === 'reconnecting'
          ? 'Reconnecting...'
          : connectionState === 'disconnected'
            ? 'Disconnected'
            : 'Connecting...';

  const handleRecoverConnection = () => {
    clearRecoveryAction();
    connect();
  };

  const handleToggleAuthMode = () => {
    setAuthMode((current) => (current === 'sign_in' ? 'sign_up' : 'sign_in'));
    setAuthError(null);
    setAuthNotice(null);
  };

  const handleLoginSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const email = emailInput.trim();
    if (!email || !passwordInput) {
      setAuthError('Enter your email and password.');
      return;
    }
    if (authMode === 'sign_up' && passwordInput.length < 8) {
      setAuthError('Use a password with at least 8 characters.');
      return;
    }

    clearRecoveryAction();
    setAuthError(null);
    setAuthNotice(null);
    setIsAuthenticating(true);
    connect();

    try {
      if (authMode === 'sign_up') {
        const result = await signUpWithEmailPassword(email, passwordInput);
        if (result.token) {
          send(createJwtAuthenticateEnvelope(result.token));
        } else if (result.requiresEmailConfirmation) {
          try {
            const jwt = await signInWithEmailPassword(email, passwordInput);
            send(createJwtAuthenticateEnvelope(jwt));
          } catch {
            setAuthNotice(
              'Account created (or already exists). Check your email for a confirmation link, then sign in.'
            );
            setAuthMode('sign_in');
            setIsAuthenticating(false);
          }
        }
      } else {
        const jwt = await signInWithEmailPassword(email, passwordInput);
        send(createJwtAuthenticateEnvelope(jwt));
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to sign in.';
      setAuthError(message);
      setIsAuthenticating(false);
    }
  };

  const handleSendMagicLink = async () => {
    const email = emailInput.trim();
    if (!email) {
      setAuthError('Enter your email first.');
      return;
    }

    setAuthError(null);
    setAuthNotice(null);
    setIsSendingMagicLink(true);
    try {
      await sendMagicLink(email);
      setAuthNotice(
        'Magic link sent. Open it on this same environment, then return here to continue.'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send magic link.';
      setAuthError(message);
    } finally {
      setIsSendingMagicLink(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-amber-50 via-orange-50 to-emerald-100 p-6 sm:p-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-12 top-12 h-52 w-52 rounded-full bg-rose-300/30 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute bottom-10 right-0 h-72 w-72 rounded-full bg-teal-300/30 blur-3xl"
      />

      <div className="mx-auto flex min-h-[calc(100vh-3rem)] w-full max-w-3xl flex-col items-center justify-center gap-6 rounded-3xl border border-white/50 bg-white/70 p-8 shadow-2xl backdrop-blur-sm sm:p-12">
        <div className="text-center">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-teal-700">
            Play Online
          </p>
          <h1 className="mb-2 text-4xl font-black tracking-tight text-slate-900 sm:text-5xl">
            American Mahjong
          </h1>
          <p className="font-medium text-slate-600">{statusText}</p>
        </div>

        {lifecycleState === 'terminal_recovery' && recoveryAction === 'return_login' && (
          <Card className="w-full max-w-xl border-blue-200 bg-blue-50/90">
            <CardHeader>
              <CardTitle className="text-lg text-blue-900">
                {authMode === 'sign_up' ? 'Create Account' : 'Login Required'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={handleLoginSubmit}>
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="you@example.com"
                />
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="Your password"
                />
                {authMode === 'sign_up' && (
                  <p className="text-xs text-slate-600">
                    Use at least 8 characters. Adding numbers and symbols is recommended.
                  </p>
                )}
                {authError && <p className="text-sm text-red-700">{authError}</p>}
                {authNotice && <p className="text-sm text-blue-800">{authNotice}</p>}
                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={isAuthenticating}>
                    {isAuthenticating
                      ? authMode === 'sign_up'
                        ? 'Creating account...'
                        : 'Signing in...'
                      : authMode === 'sign_up'
                        ? 'Create Account'
                        : 'Sign In'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={handleToggleAuthMode}>
                    {authMode === 'sign_up' ? 'Have an account? Sign In' : 'Create Account'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSendMagicLink}
                    disabled={isSendingMagicLink}
                  >
                    {isSendingMagicLink ? 'Sending link...' : 'Email Magic Link'}
                  </Button>
                  <Button type="button" variant="outline" onClick={handleRecoverConnection}>
                    Reconnect Socket
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {lifecycleState === 'terminal_recovery' && recoveryAction !== 'return_login' && (
          <div className="w-full max-w-md rounded-xl border border-orange-200 bg-orange-50/90 p-4 text-center">
            <p className="font-semibold text-orange-900">
              {recoveryMessage ?? 'Authentication failed. Please reconnect.'}
            </p>
            {recoveryAction !== 'none' && (
              <div className="mt-3">
                <Button onClick={handleRecoverConnection}>Reconnect</Button>
              </div>
            )}
          </div>
        )}

        {/* Success Message */}
        {showSuccessMessage && currentRoom && (
          <div className="w-full max-w-md rounded-xl border border-green-200 bg-green-50/90 p-4">
            {lastSuccessAction === 'created' ? (
              <>
                <p className="text-green-800">
                  Room created successfully. Waiting for players...
                </p>
                <p className="text-sm text-green-600">
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
                <p className="text-green-800">
                  Joined room successfully. Waiting for players...
                </p>
                <p className="text-sm text-green-600">
                  Room Code: {currentRoom.room_id}
                </p>
              </>
            )}
          </div>
        )}

        {/* Error Messages */}
        {roomCreation.error && (
          <div className="w-full max-w-md rounded-xl border border-red-200 bg-red-50/90 p-4">
            <p className="text-red-800">{roomCreation.error}</p>
            {roomCreation.isCreating && roomCreation.retryCount < 3 && (
              <p className="text-sm text-red-600">Retrying...</p>
            )}
          </div>
        )}
        {roomJoining.error && (
          <div className="w-full max-w-md rounded-xl border border-red-200 bg-red-50/90 p-4">
            <p className="text-red-800">{roomJoining.error}</p>
          </div>
        )}

        {/* Reconnecting Message */}
        {connectionState === 'error' && (
          <div className="w-full max-w-md rounded-xl border border-yellow-200 bg-yellow-50/90 p-4">
            <p className="text-yellow-800">Connection lost. Reconnecting...</p>
          </div>
        )}

        {/* Primary Actions */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Button
            size="lg"
            onClick={() => setIsCreateDialogOpen(true)}
            className="bg-emerald-600 text-white hover:bg-emerald-700"
            disabled={!canStartActions}
          >
            Create Room
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => setIsJoinDialogOpen(true)}
            className="border-teal-500 text-teal-700 hover:bg-teal-50"
            disabled={!canStartActions}
          >
            Join Room
          </Button>
        </div>
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
