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

function extractMessageData(raw: unknown): string | null {
  if (typeof raw === 'string') {
    return raw;
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
    'toString' in raw &&
    typeof (raw as { toString?: () => string }).toString === 'function'
  ) {
    return (raw as { toString: () => string }).toString();
  }

  return null;
}

export async function createGuestSocket(wsUrl = 'ws://127.0.0.1:3000/ws'): Promise<TestSocket> {
  if (typeof WebSocket === 'undefined') {
    throw new Error('Global WebSocket is not available in this Node runtime.');
  }

  const ws = new WebSocket(wsUrl);
  const queue: Envelope[] = [];

  await new Promise<void>((resolve, reject) => {
    onceEvent(ws, 'open', () => resolve());
    onceEvent(ws, 'error', reject);
  });

  onEvent(ws, 'message', (raw) => {
    const data = extractMessageData(raw);
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
        method: 'guest',
        version: '1.0',
      },
    })
  );

  await waitUntil(
    () => queue.some((envelope) => envelope.kind === 'AuthSuccess'),
    5_000,
    'Did not receive AuthSuccess'
  );

  return {
    sendEnvelope: (envelope: Envelope) => {
      ws.send(JSON.stringify(envelope));
    },
    sendRaw: (raw: string) => {
      ws.send(raw);
    },
    waitForEnvelope: async (predicate: (envelope: Envelope) => boolean, timeoutMs = 10_000) => {
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
