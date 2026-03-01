import type { Seat } from '@/types/bindings/generated/Seat';
import type { AuthenticateEnvelope, CommandEnvelope } from './gameSocketTypes';

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

export function buildRequestStateEnvelope(seat: Seat): CommandEnvelope {
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
