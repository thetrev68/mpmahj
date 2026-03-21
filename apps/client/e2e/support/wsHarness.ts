export type Envelope = {
  kind: string;
  payload?: unknown;
};

export type TestSocket = {
  sendEnvelope: (envelope: Envelope) => void;
  sendRaw: (raw: string) => void;
  waitForEnvelope: (
    predicate: (envelope: Envelope) => boolean,
    timeoutMs?: number
  ) => Promise<Envelope>;
  close: () => Promise<void>;
};

const DEFAULT_WS_URL = `ws://127.0.0.1:${process.env.PLAYWRIGHT_SERVER_PORT ?? '33001'}/ws`;
const AUTH_TIMEOUT_MS = 10_000;
const BOOTSTRAP_SOCKET_TIMEOUT_MS = 10_000;

function createTestJwt(): string {
  return `test-token-${crypto.randomUUID()}`;
}

function isAuthFailureEnvelope(envelope: Envelope): envelope is Envelope & { kind: 'AuthFailure' } {
  return envelope.kind === 'AuthFailure';
}

function describeAuthFailure(envelope: Envelope): string {
  const payload = envelope.payload as
    | {
        reason?: unknown;
        message?: unknown;
      }
    | undefined;
  return String(payload?.reason ?? payload?.message ?? 'Authentication was rejected by server.');
}

function extractSessionToken(envelope: Envelope): string {
  const payload = envelope.payload as { session_token?: unknown } | null;
  if (!payload || typeof payload.session_token !== 'string' || payload.session_token.length === 0) {
    throw new Error('AuthSuccess did not include a non-empty session_token.');
  }

  return payload.session_token;
}

async function waitForAuthResult(
  queue: Envelope[],
  timeoutMs: number,
  timeoutMessage: string
): Promise<Envelope> {
  const start = Date.now();
  while (true) {
    const authResult = queue.find(
      (envelope) => envelope.kind === 'AuthSuccess' || envelope.kind === 'AuthFailure'
    );
    if (authResult) {
      const idx = queue.findIndex(
        (envelope) => envelope.kind === 'AuthSuccess' || envelope.kind === 'AuthFailure'
      );
      return queue.splice(idx, 1)[0];
    }

    if (Date.now() - start > timeoutMs) {
      throw new Error(timeoutMessage);
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}

type OpenSocketOptions = {
  closeAfterAuth?: boolean;
};

type OpenSocketResult = {
  ws: WebSocket;
  queue: Envelope[];
  authSessionToken: string;
};

async function openAuthenticatedSocket(
  wsUrl: string,
  token: string,
  authMethod: 'jwt' | 'token',
  options: OpenSocketOptions = {}
): Promise<OpenSocketResult> {
  if (typeof WebSocket === 'undefined') {
    throw new Error('Global WebSocket is not available in this Node runtime.');
  }

  const ws = new WebSocket(wsUrl);
  const queue: Envelope[] = [];

  await new Promise<void>((resolve, reject) => {
    onceEvent(ws, 'open', () => resolve());
    onceEvent(ws, 'error', reject);
  });

  onEvent(ws, 'message', async (raw) => {
    const data = await extractMessageData(raw);
    if (!data) {
      return;
    }

    try {
      queue.push(parseEnvelope(data));
    } catch {
      // Ignore malformed server payloads in harness queue.
    }
  });

  ws.send(
    JSON.stringify({
      kind: 'Authenticate',
      payload: {
        method: authMethod,
        credentials: {
          token,
        },
        version: '1.0',
      },
    })
  );

  const authResult = await waitForAuthResult(
    queue,
    BOOTSTRAP_SOCKET_TIMEOUT_MS,
    'Did not receive authentication result after opening websocket'
  );

  if (isAuthFailureEnvelope(authResult)) {
    throw new Error(`WebSocket authentication failed: ${describeAuthFailure(authResult)}`);
  }

  const authSessionToken = extractSessionToken(authResult);

  if (options.closeAfterAuth) {
    await new Promise<void>((resolve) => {
      if (ws.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }

      onceEvent(ws, 'close', () => resolve());
      ws.close();
      setTimeout(() => resolve(), 1_000);
    });
  }

  return { ws, queue, authSessionToken };
}

function parseEnvelope(raw: string): Envelope {
  return JSON.parse(raw) as Envelope;
}

function onEvent(ws: WebSocket, event: string, handler: (...args: unknown[]) => void): void {
  const withOn = ws as unknown as { on?: (name: string, fn: (...args: unknown[]) => void) => void };
  if (typeof withOn.on === 'function') {
    withOn.on(event, handler);
    return;
  }

  const withAddEventListener = ws as unknown as {
    addEventListener?: (name: string, fn: (event: MessageEvent | Event) => void) => void;
  };
  if (typeof withAddEventListener.addEventListener === 'function') {
    withAddEventListener.addEventListener(event, (evt) => handler(evt));
    return;
  }

  throw new Error('WebSocket implementation does not support event listeners.');
}

function onceEvent(ws: WebSocket, event: string, handler: (...args: unknown[]) => void): void {
  const withOnce = ws as unknown as {
    once?: (name: string, fn: (...args: unknown[]) => void) => void;
  };
  if (typeof withOnce.once === 'function') {
    withOnce.once(event, handler);
    return;
  }

  const withAddEventListener = ws as unknown as {
    addEventListener?: (
      name: string,
      fn: (event: MessageEvent | CloseEvent | Event) => void,
      options?: { once?: boolean }
    ) => void;
  };
  if (typeof withAddEventListener.addEventListener === 'function') {
    withAddEventListener.addEventListener(event, (evt) => handler(evt), { once: true });
    return;
  }

  throw new Error('WebSocket implementation does not support once listeners.');
}

async function extractMessageData(raw: unknown): Promise<string | null> {
  if (typeof raw === 'string') {
    return raw;
  }

  if (typeof Blob !== 'undefined' && raw instanceof Blob) {
    return raw.text();
  }

  if (raw instanceof ArrayBuffer) {
    return Buffer.from(raw).toString('utf8');
  }

  if (ArrayBuffer.isView(raw)) {
    return Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength).toString('utf8');
  }

  if (
    typeof raw === 'object' &&
    raw !== null &&
    'data' in raw &&
    typeof (raw as { data?: unknown }).data === 'string'
  ) {
    return (raw as { data: string }).data;
  }

  if (
    typeof raw === 'object' &&
    raw !== null &&
    'data' in raw &&
    typeof Blob !== 'undefined' &&
    (raw as { data?: unknown }).data instanceof Blob
  ) {
    return (raw as { data: Blob }).data.text();
  }

  if (
    typeof raw === 'object' &&
    raw !== null &&
    'data' in raw &&
    (raw as { data?: unknown }).data instanceof ArrayBuffer
  ) {
    return Buffer.from((raw as { data: ArrayBuffer }).data).toString('utf8');
  }

  if (
    typeof raw === 'object' &&
    raw !== null &&
    'data' in raw &&
    ArrayBuffer.isView((raw as { data?: unknown }).data)
  ) {
    const view = (raw as { data: ArrayBufferView }).data;
    return Buffer.from(view.buffer, view.byteOffset, view.byteLength).toString('utf8');
  }

  if (
    typeof raw === 'object' &&
    raw !== null &&
    'toString' in raw &&
    typeof (raw as { toString?: () => string }).toString === 'function'
  ) {
    return (raw as { toString: () => string }).toString();
  }

  return null;
}

/**
 * Creates an authenticated websocket connection for tests.
 * Guest handshake is intentionally not supported.
 */
export async function createAuthenticatedSocket(
  wsUrl = DEFAULT_WS_URL,
  token?: string
): Promise<TestSocket> {
  const authMethod = token ? 'token' : 'jwt';
  const resolvedToken = token ?? createTestJwt();
  const { ws, queue } = await openAuthenticatedSocket(wsUrl, resolvedToken, authMethod);

  return {
    sendEnvelope: (envelope: Envelope) => {
      ws.send(JSON.stringify(envelope));
    },
    sendRaw: (raw: string) => {
      ws.send(raw);
    },
    waitForEnvelope: async (
      predicate: (envelope: Envelope) => boolean,
      timeoutMs = AUTH_TIMEOUT_MS
    ) => {
      await waitUntil(() => queue.some(predicate), timeoutMs, 'Envelope wait timed out');
      const idx = queue.findIndex(predicate);
      if (idx < 0) {
        throw new Error('Envelope matched during wait but could not be retrieved.');
      }
      return queue.splice(idx, 1)[0];
    },
    close: () =>
      new Promise<void>((resolve) => {
        if (ws.readyState === WebSocket.CLOSED) {
          resolve();
          return;
        }

        let resolved = false;
        const finish = () => {
          if (resolved) {
            return;
          }
          resolved = true;
          resolve();
        };

        onceEvent(ws, 'close', () => finish());
        ws.close();

        setTimeout(() => finish(), 1_000);
      }),
  };
}

async function waitUntil(
  predicate: () => boolean,
  timeoutMs: number,
  timeoutMessage: string
): Promise<void> {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(timeoutMessage);
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
}
