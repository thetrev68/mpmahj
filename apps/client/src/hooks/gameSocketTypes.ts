import type { CreateRoomPayload } from '@/types/bindings/generated/CreateRoomPayload';
import type { Event as ServerEvent } from '@/types/bindings/generated/Event';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { PingPayload } from '@/types/bindings/generated/PingPayload';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { StateSnapshotPayload } from '@/types/bindings/generated/StateSnapshotPayload';

// ─── Type guards ──────────────────────────────────────────────────────────────

export function isSeat(value: unknown): value is Seat {
  return value === 'East' || value === 'South' || value === 'West' || value === 'North';
}

// ─── Shared payload types ─────────────────────────────────────────────────────

export interface ErrorEnvelopePayload {
  code: string;
  message: string;
  context?: unknown;
}

// ─── Inbound envelopes (server → client) ─────────────────────────────────────

export interface PingEnvelope {
  kind: 'Ping';
  payload: PingPayload;
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

export interface AuthFailureEnvelope {
  kind: 'AuthFailure';
  payload?: { message?: string };
}

export interface RoomJoinedEnvelope {
  kind: 'RoomJoined';
  payload: {
    room_id: string;
    seat: Seat;
  };
}

export interface StateSnapshotEnvelope {
  kind: 'StateSnapshot';
  payload: StateSnapshotPayload;
}

export interface EventEnvelope {
  kind: 'Event';
  payload: { event: ServerEvent };
}

export interface ErrorEnvelope {
  kind: 'Error';
  payload: ErrorEnvelopePayload;
}

/**
 * Discriminated union of all envelope shapes the server sends to the client.
 * Use this type at the protocol boundary and in subscription listeners.
 */
export type InboundEnvelope =
  | PingEnvelope
  | AuthSuccessEnvelope
  | AuthFailureEnvelope
  | RoomJoinedEnvelope
  | StateSnapshotEnvelope
  | EventEnvelope
  | ErrorEnvelope;

// ─── Outbound envelopes (client → server) ─────────────────────────────────────

export interface PongEnvelope {
  kind: 'Pong';
  payload: { timestamp: string };
}

export interface AuthenticateEnvelope {
  kind: 'Authenticate';
  payload: {
    method: 'guest' | 'token' | 'jwt';
    credentials?: { token: string };
    version: string;
  };
}

export interface CommandEnvelope {
  kind: 'Command';
  payload: { command: GameCommand };
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

/**
 * Discriminated union of all envelope shapes the client sends to the server.
 * Use this type for the `send` API and the outbound queue.
 */
export type OutboundEnvelope =
  | PongEnvelope
  | AuthenticateEnvelope
  | CommandEnvelope
  | CreateRoomEnvelope
  | JoinRoomEnvelope;

// ─── Adapter / transitional types ────────────────────────────────────────────

// ─── Connection metadata ──────────────────────────────────────────────────────

/**
 * Low-level WebSocket readiness state. Reflects the raw connection status.
 * Use `SocketLifecycleState` for the full reconnect + session lifecycle.
 */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Named lifecycle states for the WebSocket connection and session.
 *
 * State machine:
 *
 *   disconnected
 *     → connecting         (connect() is called)
 *
 *   connecting
 *     → authenticated      (AuthSuccess with no prior session or room_id)
 *     → resync_pending     (AuthSuccess with room_id; RequestState sent)
 *     → terminal_recovery  (unrecoverable AuthFailure or auth Error)
 *
 *   authenticated
 *     → resync_pending     (RoomJoined received; RequestState sent)
 *     → reconnecting       (connection lost)
 *
 *   resync_pending
 *     → authenticated      (StateSnapshot received; resync complete)
 *     → terminal_recovery  (room not found or seat lost during resync)
 *     → reconnecting       (connection lost before snapshot arrived)
 *
 *   reconnecting
 *     → connecting         (backoff timer fires; retry initiated)
 *     → terminal_recovery  (recovery action set after repeated failure)
 *
 *   terminal_recovery
 *     → (no automatic transition; user must navigate to lobby or login)
 *
 * Note: the socket layer owns snapshot-arrival tracking for both the reconnect
 * and initial-join flows. `resync_pending` is entered when a RequestState is
 * sent (after RoomJoined, after reconnect AuthSuccess, or after AuthSuccess
 * with room_id); it clears when the StateSnapshot arrives. Consumers should
 * treat `authenticated` as the signal that both auth and initial state are ready.
 */
export type SocketLifecycleState =
  /** No active connection and no pending reconnect. */
  | 'disconnected'
  /** WebSocket is establishing or awaiting AuthSuccess. */
  | 'connecting'
  /** Auth succeeded and any post-reconnect resync has completed. */
  | 'authenticated'
  /** Connection was lost; exponential-backoff retry is in progress. */
  | 'reconnecting'
  /** Re-authenticated after reconnect; waiting for StateSnapshot to arrive. */
  | 'resync_pending'
  /** Unrecoverable failure — user must navigate to lobby or login. */
  | 'terminal_recovery';
export type RecoveryAction = 'none' | 'return_login' | 'return_lobby';

/**
 * Subscription listener — receives inbound envelopes from the server.
 */
export type EnvelopeListener = (envelope: InboundEnvelope) => void;

/**
 * useGameSocket hook return type
 */
export interface UseGameSocketReturn {
  /** Current connection state */
  connectionState: ConnectionState;
  /**
   * Named lifecycle state derived from connectionState, reconnect flags, and
   * resync-pending tracking. Prefer this over inspecting multiple fields
   * individually to understand the current session phase.
   */
  lifecycleState: SocketLifecycleState;
  /** Send an outbound envelope to the server */
  send: (envelope: OutboundEnvelope) => void;
  /** Subscribe to inbound envelopes of a specific kind */
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
