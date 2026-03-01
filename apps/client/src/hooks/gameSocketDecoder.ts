import type { Event as ServerEvent } from '@/types/bindings/generated/Event';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type {
  AuthFailureEnvelope,
  AuthSuccessEnvelope,
  ErrorEnvelope,
  ErrorEnvelopePayload,
  EventEnvelope,
  InboundEnvelope,
  PingEnvelope,
  RoomJoinedEnvelope,
  StateSnapshotEnvelope,
} from './gameSocketTypes';

// ─── Result type ──────────────────────────────────────────────────────────────

export type DecodeResult =
  | { ok: true; envelope: InboundEnvelope }
  | { ok: false; error: string; raw?: unknown };

// ─── Primitive guards ─────────────────────────────────────────────────────────

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isString(v: unknown): v is string {
  return typeof v === 'string';
}

// ─── Per-kind decoders ────────────────────────────────────────────────────────

function decodePing(payload: unknown): PingEnvelope | null {
  if (!isObject(payload) || !isString(payload.timestamp)) return null;
  return { kind: 'Ping', payload: { timestamp: payload.timestamp } };
}

function decodeAuthSuccess(payload: unknown): AuthSuccessEnvelope | null {
  if (!isObject(payload)) return null;
  if (!isString(payload.player_id)) return null;
  if (!isString(payload.display_name)) return null;
  if (!isString(payload.session_token)) return null;
  // Optional fields (room_id, seat) are passed through; downstream validates seat via isSeat().
  return {
    kind: 'AuthSuccess',
    payload: payload as AuthSuccessEnvelope['payload'],
  };
}

function decodeAuthFailure(payload: unknown): AuthFailureEnvelope {
  // AuthFailure may arrive with no payload, or with an optional message field.
  if (isObject(payload) && isString(payload.message)) {
    return { kind: 'AuthFailure', payload: { message: payload.message } };
  }
  return { kind: 'AuthFailure', payload: undefined };
}

function decodeRoomJoined(payload: unknown): RoomJoinedEnvelope | null {
  if (!isObject(payload) || !isString(payload.room_id)) return null;
  // seat is passed through; downstream validates via isSeat().
  return {
    kind: 'RoomJoined',
    payload: payload as RoomJoinedEnvelope['payload'],
  };
}

function decodeStateSnapshot(payload: unknown): StateSnapshotEnvelope | null {
  if (!isObject(payload) || !isObject(payload.snapshot)) return null;
  return {
    kind: 'StateSnapshot',
    payload: { snapshot: payload.snapshot as GameStateSnapshot },
  };
}

function decodeEvent(payload: unknown): EventEnvelope | null {
  if (!isObject(payload) || !isObject(payload.event)) return null;
  return {
    kind: 'Event',
    payload: { event: payload.event as ServerEvent },
  };
}

function decodeError(payload: unknown): ErrorEnvelope | null {
  if (!isObject(payload)) return null;
  if (!isString(payload.code) || !isString(payload.message)) return null;
  const errorPayload: ErrorEnvelopePayload = {
    code: payload.code,
    message: payload.message,
    context: payload.context,
  };
  return { kind: 'Error', payload: errorPayload };
}

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Decode a raw inbound WebSocket JSON string into a typed InboundEnvelope.
 *
 * All inbound messages must pass through this function before entering
 * application logic. Invalid messages are rejected here and never reach
 * downstream event handlers.
 */
export function decodeInboundEnvelope(rawJson: string): DecodeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch {
    return { ok: false, error: 'Invalid JSON' };
  }

  if (!isObject(parsed)) {
    return { ok: false, error: 'Expected top-level object', raw: parsed };
  }

  const { kind, payload } = parsed;
  if (!isString(kind)) {
    return { ok: false, error: 'Missing or non-string kind field', raw: parsed };
  }

  let envelope: InboundEnvelope | null = null;

  switch (kind) {
    case 'Ping':
      envelope = decodePing(payload);
      break;
    case 'AuthSuccess':
      envelope = decodeAuthSuccess(payload);
      break;
    case 'AuthFailure':
      envelope = decodeAuthFailure(payload);
      break;
    case 'RoomJoined':
      envelope = decodeRoomJoined(payload);
      break;
    case 'StateSnapshot':
      envelope = decodeStateSnapshot(payload);
      break;
    case 'Event':
      envelope = decodeEvent(payload);
      break;
    case 'Error':
      envelope = decodeError(payload);
      break;
    default:
      return { ok: false, error: `Unknown envelope kind: ${kind}`, raw: parsed };
  }

  if (envelope === null) {
    return { ok: false, error: `Invalid payload for kind: ${kind}`, raw: parsed };
  }

  return { ok: true, envelope };
}
