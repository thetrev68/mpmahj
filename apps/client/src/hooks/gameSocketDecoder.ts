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
import { isSeat } from './gameSocketTypes';

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

function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}

function isBoolean(v: unknown): v is boolean {
  return typeof v === 'boolean';
}

function isTileArray(v: unknown): v is number[] {
  return Array.isArray(v) && v.every(isNumber);
}

function isDiscardInfo(value: unknown): boolean {
  return isObject(value) && isNumber(value.tile) && isSeat(value.discarded_by);
}

function isPublicPlayerInfo(value: unknown): boolean {
  return (
    isObject(value) &&
    isSeat(value.seat) &&
    isString(value.player_id) &&
    isBoolean(value.is_bot) &&
    isString(value.status) &&
    isNumber(value.tile_count) &&
    Array.isArray(value.exposed_melds)
  );
}

function isRuleset(value: unknown): boolean {
  return (
    isObject(value) &&
    isNumber(value.card_year) &&
    isString(value.timer_mode) &&
    isBoolean(value.blank_exchange_enabled) &&
    isNumber(value.call_window_seconds) &&
    isNumber(value.charleston_timer_seconds)
  );
}

function isHouseRules(value: unknown): boolean {
  return (
    isObject(value) &&
    isRuleset(value.ruleset) &&
    isBoolean(value.analysis_enabled) &&
    isBoolean(value.concealed_bonus_enabled) &&
    isBoolean(value.dealer_bonus_enabled)
  );
}

function isGamePhase(value: unknown): boolean {
  if (value === 'WaitingForPlayers') {
    return true;
  }

  if (!isObject(value)) {
    return false;
  }

  const keys = Object.keys(value);
  if (keys.length !== 1) {
    return false;
  }

  const phaseKey = keys[0];
  const phaseValue = value[phaseKey];

  switch (phaseKey) {
    case 'Setup':
    case 'Charleston':
      return isString(phaseValue);
    case 'Playing':
    case 'Scoring':
    case 'GameOver':
      return isObject(phaseValue);
    default:
      return false;
  }
}

function isSeatToTilesRecord(value: unknown): boolean {
  if (!isObject(value)) {
    return false;
  }

  return Object.entries(value).every(([key, tiles]) => isSeat(key) && isTileArray(tiles));
}

function isGameStateSnapshot(value: unknown): value is GameStateSnapshot {
  if (!isObject(value)) {
    return false;
  }

  if (
    !isString(value.game_id) ||
    !isGamePhase(value.phase) ||
    !isSeat(value.current_turn) ||
    !isSeat(value.dealer) ||
    !isNumber(value.round_number) ||
    !isNumber(value.turn_number) ||
    !isNumber(value.remaining_tiles) ||
    !Array.isArray(value.discard_pile) ||
    !value.discard_pile.every(isDiscardInfo) ||
    !Array.isArray(value.players) ||
    !value.players.every(isPublicPlayerInfo) ||
    !isHouseRules(value.house_rules) ||
    !(value.charleston_state === null || isObject(value.charleston_state)) ||
    !isSeat(value.your_seat) ||
    !isTileArray(value.your_hand) ||
    !(isNumber(value.wall_seed) || isString(value.wall_seed)) ||
    !isNumber(value.wall_draw_index) ||
    !isNumber(value.wall_break_point) ||
    !isNumber(value.wall_tiles_remaining)
  ) {
    return false;
  }

  if ('all_player_hands' in value && value.all_player_hands !== undefined) {
    return isSeatToTilesRecord(value.all_player_hands);
  }

  return true;
}

function isServerEvent(value: unknown): value is ServerEvent {
  if (!isObject(value)) {
    return false;
  }

  const keys = Object.keys(value);
  if (keys.length !== 1) {
    return false;
  }

  const eventKind = keys[0];
  const eventPayload = value[eventKind];
  // Rust unit-variant enums serialise as plain strings (e.g. "CallWindowClosed"),
  // while struct/tuple variants serialise as objects.  Both are valid payloads.
  return (
    (eventKind === 'Public' || eventKind === 'Private' || eventKind === 'Analysis') &&
    (isObject(eventPayload) || typeof eventPayload === 'string')
  );
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
  if ('room_id' in payload && payload.room_id !== undefined && !isString(payload.room_id))
    return null;
  if ('seat' in payload && payload.seat !== undefined && !isSeat(payload.seat)) return null;
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
  if (!isObject(payload) || !isString(payload.room_id) || !isSeat(payload.seat)) return null;
  return {
    kind: 'RoomJoined',
    payload: payload as RoomJoinedEnvelope['payload'],
  };
}

function decodeStateSnapshot(payload: unknown): StateSnapshotEnvelope | null {
  if (!isObject(payload) || !isGameStateSnapshot(payload.snapshot)) return null;
  return {
    kind: 'StateSnapshot',
    payload: { snapshot: payload.snapshot as GameStateSnapshot },
  };
}

function decodeEvent(payload: unknown): EventEnvelope | null {
  if (!isObject(payload) || !isServerEvent(payload.event)) return null;
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
