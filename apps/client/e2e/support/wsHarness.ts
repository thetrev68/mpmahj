export type Envelope = {
  kind: string;
  payload?: unknown;
};

export type TestSocket = {
  sendEnvelope: (envelope: Envelope) => void;
  waitForEnvelope: (
    predicate: (envelope: Envelope) => boolean,
    timeoutMs?: number
  ) => Promise<Envelope>;
  close: () => Promise<void>;
};

function parseEnvelope(raw: string): Envelope {
  return JSON.parse(raw) as Envelope;
}

export async function createGuestSocket(wsUrl = 'ws://127.0.0.1:3000/ws'): Promise<TestSocket> {
  if (typeof WebSocket === 'undefined') {
    throw new Error('Global WebSocket is not available in this Node runtime.');
  }

  const ws = new WebSocket(wsUrl);
  const queue: Envelope[] = [];

  await new Promise<void>((resolve, reject) => {
    ws.once('open', () => resolve());
    ws.once('error', reject);
  });

  ws.on('message', (raw) => {
    if (typeof raw.toString !== 'function') {
      return;
    }

    const data = raw.toString();
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
        ws.once('close', () => resolve());
        ws.close();
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
