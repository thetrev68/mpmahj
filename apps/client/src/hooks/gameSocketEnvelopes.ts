import type { Seat } from '@/types/bindings/generated/Seat';
import type { AuthenticateEnvelope, Envelope } from './useGameSocket';

export function buildAuthenticateEnvelope(token: string | null): AuthenticateEnvelope {
  return {
    kind: 'Authenticate',
    payload: {
      method: token ? 'token' : 'guest',
      credentials: token ? { token } : undefined,
      version: '1.0',
    },
  };
}

export function buildRequestStateEnvelope(seat: Seat): Envelope {
  return {
    kind: 'Command',
    payload: {
      command: {
        RequestState: {
          player: seat,
        },
      },
    },
  };
}

export function buildPongEnvelope(timestamp?: string): Envelope {
  return {
    kind: 'Pong',
    payload: { timestamp: timestamp ?? new Date().toISOString() },
  };
}
