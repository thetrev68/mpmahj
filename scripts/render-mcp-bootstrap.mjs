#!/usr/bin/env node

const RENDER_API_KEY = process.env.RENDER_API_KEY;
const preferredWorkspaceId = process.env.RENDER_WORKSPACE_ID;
const defaultServiceId = process.env.RENDER_SERVICE_ID || 'srv-d5c8iimr433s739f5po0';

function mask(value) {
  if (!value) return '(missing)';
  if (value.length <= 10) return `${value.slice(0, 3)}...${value.slice(-2)}`;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

async function renderGet(path) {
  const response = await fetch(`https://api.render.com/v1${path}`, {
    headers: {
      Authorization: `Bearer ${RENDER_API_KEY}`,
    },
  });
  const text = await response.text();
  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    payload = text;
  }
  return { ok: response.ok, status: response.status, payload };
}

function normalizeOwners(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload
      .map((entry) => {
        if (entry?.owner) return entry.owner;
        return entry;
      })
      .filter(Boolean);
  }
  if (payload.owner) return [payload.owner];
  if (payload.owners && Array.isArray(payload.owners)) return payload.owners;
  if (payload.id) return [payload];
  return [];
}

async function main() {
  console.log('Render MCP bootstrap');
  console.log(`RENDER_API_KEY: ${mask(RENDER_API_KEY)}`);

  if (!RENDER_API_KEY) {
    console.error('ERROR: RENDER_API_KEY is not set.');
    console.error('Set it first, then rerun this command.');
    process.exit(1);
  }

  const ownersResult = await renderGet('/owners');
  if (!ownersResult.ok) {
    console.error(`ERROR: GET /owners failed (${ownersResult.status})`);
    console.error(JSON.stringify(ownersResult.payload, null, 2));
    process.exit(1);
  }

  const owners = normalizeOwners(ownersResult.payload);
  if (owners.length === 0) {
    console.error('ERROR: No owners/workspaces found in /owners response.');
    console.error(JSON.stringify(ownersResult.payload, null, 2));
    process.exit(1);
  }

  console.log('\nAvailable Render workspace(s):');
  for (const owner of owners) {
    console.log(`- ${owner.name || '(unnamed)'} | ${owner.id} | ${owner.type || 'unknown'}`);
  }

  const selected = owners.find((o) => o.id === preferredWorkspaceId) || owners[0];

  console.log('\nUse this at the start of each Codex session:');
  console.log(`select Render workspace ownerID=${selected.id}`);

  const serviceId = process.argv.includes('--service')
    ? process.argv[process.argv.indexOf('--service') + 1]
    : defaultServiceId;

  if (serviceId) {
    const serviceResult = await renderGet(`/services/${serviceId}`);
    console.log(`\nRender API check for service ${serviceId}:`);
    if (serviceResult.ok) {
      const service = serviceResult.payload || {};
      const url = service.serviceDetails?.url || '(missing)';
      const ownerId = service.ownerId || '(missing)';
      console.log(`- status: OK (${serviceResult.status})`);
      console.log(`- service name: ${service.name || '(missing)'}`);
      console.log(`- ownerId: ${ownerId}`);
      console.log(`- url: ${url}`);
      console.log(
        '- interpretation: REST API is healthy; if Render MCP still errors, issue is MCP-side (auth/session/tooling), not Render token scope.'
      );
    } else {
      console.log(`- status: FAILED (${serviceResult.status})`);
      console.log(JSON.stringify(serviceResult.payload, null, 2));
    }
  }
}

main().catch((error) => {
  console.error('ERROR: Unexpected failure');
  console.error(error?.stack || String(error));
  process.exit(1);
});
