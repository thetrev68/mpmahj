import type { AuthenticatePayload } from '@/types/bindings/generated/AuthenticatePayload';
import type { AuthFailurePayload } from '@/types/bindings/generated/AuthFailurePayload';
import type { AuthSuccessPayload } from '@/types/bindings/generated/AuthSuccessPayload';
import type { CommandPayload } from '@/types/bindings/generated/CommandPayload';
import type { CreateRoomPayload } from '@/types/bindings/generated/CreateRoomPayload';
import type { Event as ServerEvent } from '@/types/bindings/generated/Event';
import type { JoinRoomPayload } from '@/types/bindings/generated/JoinRoomPayload';
import type { PingPayload } from '@/types/bindings/generated/PingPayload';
import type { PongPayload } from '@/types/bindings/generated/PongPayload';
import type { RoomJoinedPayload } from '@/types/bindings/generated/RoomJoinedPayload';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { StateSnapshotPayload } from '@/types/bindings/generated/StateSnapshotPayload';

// ─── Type guards ──────────────────────────────────────────────────────────────

/**
 * Type guard for Seat values (East, South, West, North).
 * @param value - The value to check
 * @returns True if value is a valid Seat
 */
export function isSeat(value: unknown): value is Seat {
  return value === 'East' || value === 'South' || value === 'West' || value === 'North';
}

// ─── Shared payload types ─────────────────────────────────────────────────────

/**
 * Error response payload from server.
 * @property code - Machine-readable error code
 * @property message - Human-readable error message
 * @property context - Optional contextual information about the error
 */
export interface ErrorEnvelopePayload {
  code: string;
  message: string;
  context?: unknown;
}

// ─── Inbound envelopes (server → client) ─────────────────────────────────────

/** Server heartbeat message. Client must respond with a Pong envelope to keep connection alive. */
export interface PingEnvelope {
  kind: 'Ping';
  payload: PingPayload;
}

/** Successful authentication response. Includes player ID and optional session token. */
export interface AuthSuccessEnvelope {
  kind: 'AuthSuccess';
  payload: AuthSuccessPayload;
}

/** Authentication failure response. */
export interface AuthFailureEnvelope {
  kind: 'AuthFailure';
  payload?: AuthFailurePayload;
}

/** Confirms client joined a room. Includes game state and seat assignment. */
export interface RoomJoinedEnvelope {
  kind: 'RoomJoined';
  payload: RoomJoinedPayload;
}

/** Complete game state snapshot for initial state or reconnection resync. */
export interface StateSnapshotEnvelope {
  kind: 'StateSnapshot';
  payload: StateSnapshotPayload;
}

/** Game event (public or private) broadcast to all or specific players. */
export interface EventEnvelope {
  kind: 'Event';
  payload: { event: ServerEvent };
}

/** Server error response. */
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

/** Response to server Ping, echoing timestamp to keep connection alive. */
export interface PongEnvelope {
  kind: 'Pong';
  payload: PongPayload;
}

/** Client authentication request (token or JWT). */
export interface AuthenticateEnvelope {
  kind: 'Authenticate';
  payload: AuthenticatePayload;
}

/** Game command sent by the player (discard, call, declare, etc.). */
export interface CommandEnvelope {
  kind: 'Command';
  payload: CommandPayload;
}

/** Create a new game room. */
export interface CreateRoomEnvelope {
  kind: 'CreateRoom';
  payload: CreateRoomPayload;
}

/** Join an existing game room. */
export interface JoinRoomEnvelope {
  kind: 'JoinRoom';
  payload: JoinRoomPayload;
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
/**
 * Action to take after unrecoverable socket/session failure.
 * - `'none'`: No recovery action needed
 * - `'return_login'`: Navigate user to login page
 * - `'return_lobby'`: Navigate user back to room lobby
 */
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
  /** Enable debug trace logging for socket and protocol layers. */
  debug?: boolean;
}
