import type { CreateRoomPayload } from '@/types/bindings/generated/CreateRoomPayload';
import type { Seat } from '@/types/bindings/generated/Seat';

/**
 * WebSocket Envelope types
 */
export interface Envelope {
  kind: string;
  payload?: unknown;
}

export interface CreateRoomEnvelope {
  kind: 'CreateRoom';
  payload: CreateRoomPayload;
}

export interface JoinRoomEnvelope {
  kind: 'JoinRoom';
  payload: {
    room_id: string;
  };
}

export interface AuthenticateEnvelope {
  kind: 'Authenticate';
  payload: {
    method: 'guest' | 'token' | 'jwt';
    credentials?: { token: string };
    version: string;
  };
}

/**
 * Connection states
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';
export type RecoveryAction = 'none' | 'return_login' | 'return_lobby';

/**
 * Envelope listener callback
 */
export type EnvelopeListener = (envelope: Envelope) => void;

/**
 * useGameSocket hook return type
 */
export interface UseGameSocketReturn {
  /** Current connection state */
  connectionState: ConnectionState;
  /** Send an envelope to the server */
  send: (envelope: Envelope) => void;
  /** Subscribe to envelopes of a specific kind */
  subscribe: (kind: string, listener: EnvelopeListener) => () => void;
  /** Manually connect (auto-connects by default) */
  connect: () => void;
  /** Disconnect from server */
  disconnect: () => void;
  /** Current player ID (after auth) */
  playerId: string | null;
  /** Session token (for reconnection) */
  sessionToken: string | null;
  /** Current seat, if known */
  seat: Seat | null;
  /** Current reconnect attempt number */
  reconnectAttempt: number;
  /** True while auto-reconnect cycle is active */
  isReconnecting: boolean;
  /** True when manual retry should be shown */
  canManualRetry: boolean;
  /** Retry reconnect immediately */
  retryNow: () => void;
  /** Recovery target for terminal reconnect failures */
  recoveryAction: RecoveryAction;
  /** Error message associated with recoveryAction */
  recoveryMessage: string | null;
  /** Clear recovery action/message */
  clearRecoveryAction: () => void;
  /** True when a reconnect just succeeded */
  showReconnectedToast: boolean;
  /** Dismiss reconnect success toast */
  dismissReconnectedToast: () => void;
}

export interface UseGameSocketOptions {
  /** Disable auto-connect lifecycle (used when sharing a socket from parent). */
  enabled?: boolean;
}

export interface ErrorEnvelopePayload {
  code: string;
  message: string;
  context?: unknown;
}

export interface RoomJoinedEnvelope {
  kind: 'RoomJoined';
  payload: {
    room_id: string;
    seat: Seat;
  };
}

export interface AuthSuccessEnvelope {
  kind: 'AuthSuccess';
  payload: {
    player_id: string;
    display_name: string;
    session_token: string;
    room_id?: string;
    seat?: Seat;
  };
}
