import type { Page } from '@playwright/test';

export async function goOffline(page: Page): Promise<void> {
  await page.context().setOffline(true);
}

export async function goOnline(page: Page): Promise<void> {
  await page.context().setOffline(false);
}

export async function temporaryOffline(page: Page, durationMs: number): Promise<void> {
  await goOffline(page);
  await page.waitForTimeout(durationMs);
  await goOnline(page);
}

export async function hardRefresh(page: Page): Promise<void> {
  await page.reload({ waitUntil: 'domcontentloaded' });
}

export async function installWsSendFaultInjection(
  page: Page,
  options: { delayMs?: number; dropKinds?: string[] }
): Promise<void> {
  const delayMs = options.delayMs ?? 0;
  const dropKinds = options.dropKinds ?? [];

  await page.addInitScript(
    ({ delayMsArg, dropKindsArg }) => {
      const OriginalWebSocket = window.WebSocket;

      window.WebSocket = class FaultInjectedWebSocket extends OriginalWebSocket {
        send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
          if (typeof data === 'string') {
            try {
              const envelope = JSON.parse(data) as { kind?: string };
              if (envelope.kind && dropKindsArg.includes(envelope.kind)) {
                return;
              }
            } catch {
              // Non-JSON payloads are passed through.
            }
          }

          if (delayMsArg > 0) {
            window.setTimeout(() => super.send(data), delayMsArg);
            return;
          }

          super.send(data);
        }
      } as typeof WebSocket;
    },
    { delayMsArg: delayMs, dropKindsArg: dropKinds }
  );
}
