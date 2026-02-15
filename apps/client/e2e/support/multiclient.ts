import type { Browser, BrowserContext, Page } from '@playwright/test';

type ClientSession = {
  context: BrowserContext;
  page: Page;
  label: string;
};

export async function launchClients(browser: Browser, count: number): Promise<ClientSession[]> {
  const clients: ClientSession[] = [];

  for (let i = 0; i < count; i += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();
    clients.push({
      context,
      page,
      label: `client-${i + 1}`,
    });
  }

  return clients;
}

export async function closeClients(clients: ClientSession[]): Promise<void> {
  await Promise.all(
    clients.map(async (client) => {
      try {
        await client.context.close();
      } catch {
        // Ignore teardown races when Playwright is already shutting down contexts.
      }
    })
  );
}
