interface ErrorEnvelopePayload {
  code?: string;
  message?: string;
}

export function isAuthErrorPayload(payload: ErrorEnvelopePayload): boolean {
  const code = payload.code?.toLowerCase() ?? '';
  const message = payload.message?.toLowerCase() ?? '';
  return (
    code.includes('auth') ||
    code.includes('token') ||
    code.includes('unauthorized') ||
    message.includes('auth') ||
    message.includes('token') ||
    message.includes('expired') ||
    message.includes('unauthorized')
  );
}

export function isResyncNotFoundPayload(payload: ErrorEnvelopePayload): boolean {
  const code = payload.code?.toLowerCase() ?? '';
  const message = payload.message?.toLowerCase() ?? '';
  return (
    code.includes('not_found') ||
    message.includes('not found') ||
    message.includes('game ended') ||
    message.includes('room no longer exists')
  );
}
