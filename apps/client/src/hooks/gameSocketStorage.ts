import type { Seat } from '@/types/bindings/generated/Seat';
import { isSeat } from './gameSocketTypes';

const SESSION_TOKEN_KEY = 'session_token';
const SESSION_SEAT_KEY = 'session_seat';

export function getStoredSessionToken(): string | null {
  return localStorage.getItem(SESSION_TOKEN_KEY) ?? null;
}

export function getStoredSeat(): Seat | null {
  const stored = localStorage.getItem(SESSION_SEAT_KEY);
  return isSeat(stored) ? stored : null;
}

export function clearStoredSession() {
  localStorage.removeItem(SESSION_TOKEN_KEY);
  localStorage.removeItem(SESSION_SEAT_KEY);
}

export function persistSessionToken(token: string) {
  localStorage.setItem(SESSION_TOKEN_KEY, token);
}

export function persistSeat(seat: Seat) {
  localStorage.setItem(SESSION_SEAT_KEY, seat);
}
