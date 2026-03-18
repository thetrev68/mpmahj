import type { Seat } from '@/types/bindings/generated/Seat';
import { isSeat } from './gameSocketTypes';

const SESSION_TOKEN_KEY = 'session_token';
const SESSION_SEAT_KEY = 'session_seat';
const SESSION_TOKEN_VERSION = 1;
const SESSION_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const SESSION_TOKEN_INTEGRITY_KEY = 'v1';

type StoredSessionToken = {
  v: number;
  token: string;
  integrity: string;
  issuedAt: number;
};

function getIntegritySecret(): string {
  const secret = import.meta.env.VITE_SESSION_TOKEN_INTEGRITY_KEY;
  return typeof secret === 'string' ? secret : '';
}

function isRecent(issuedAt: number): boolean {
  return Number.isFinite(issuedAt) && issuedAt > 0 && Date.now() - issuedAt <= SESSION_TOKEN_TTL_MS;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function hashToken(token: string, issuedAt: number): string {
  const secret = getIntegritySecret();
  const input = `${SESSION_TOKEN_INTEGRITY_KEY}|${secret}|${issuedAt}|${token}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
    hash >>>= 0;
  }
  return hash.toString(16).padStart(8, '0');
}

function parseStoredSessionToken(value: string): StoredSessionToken | null {
  try {
    const parsed = JSON.parse(value) as StoredSessionToken;
    if (
      parsed?.v !== SESSION_TOKEN_VERSION ||
      typeof parsed?.token !== 'string' ||
      typeof parsed?.integrity !== 'string' ||
      typeof parsed?.issuedAt !== 'number'
    ) {
      return null;
    }

    if (!isUuid(parsed.token) || !isRecent(parsed.issuedAt)) {
      return null;
    }

    const expected = hashToken(parsed.token, parsed.issuedAt);
    return expected === parsed.integrity ? parsed : null;
  } catch {
    return null;
  }
}

export function getStoredSessionToken(): string | null {
  const raw = localStorage.getItem(SESSION_TOKEN_KEY);
  if (!raw) {
    return null;
  }

  const parsed = parseStoredSessionToken(raw);
  if (!parsed) {
    clearStoredSession();
    return null;
  }

  return parsed.token;
}

export function getStoredSeat(): Seat | null {
  const stored = localStorage.getItem(SESSION_SEAT_KEY);
  return isSeat(stored) ? stored : null;
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem(SESSION_SEAT_KEY);
}

export function clearStoredSessionIfTokenMatches(expectedToken: string | null) {
  if (!expectedToken) {
    return false;
  }

  const storedToken = getStoredSessionToken();
  if (storedToken !== expectedToken) {
    return false;
  }

  clearStoredSession();
  return true;
}

export function persistSessionToken(token: string) {
  if (!isUuid(token)) {
    return;
  }

  const issuedAt = Date.now();
  const payload: StoredSessionToken = {
    v: SESSION_TOKEN_VERSION,
    token,
    issuedAt,
    integrity: hashToken(token, issuedAt),
  };
  localStorage.setItem(SESSION_TOKEN_KEY, JSON.stringify(payload));
}

export function persistSeat(seat: Seat) {
  localStorage.setItem(SESSION_SEAT_KEY, seat);
}
