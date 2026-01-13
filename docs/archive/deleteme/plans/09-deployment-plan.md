# 09. Deployment - Implementation Plan

This plan translates `docs/implementation/09-deployment.md` into concrete steps and file-level guidance.

## Sources

- `docs/implementation/09-deployment.md`
- `docs/architecture/09-network-protocol.md`
- `crates/mahjong_server/Cargo.toml`
- `apps/client/vite.config.ts`

## Scope

Set up deployment for the MVP using Vercel (frontend), Render (backend), and Supabase (PostgreSQL). Include environment variables, migrations, CI, and rollback steps.

## Plan

### 1) Frontend deployment (Vercel)

Add or confirm `vercel.json` at repo root:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "apps/client/dist",
  "framework": "vite",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Steps:

- Connect Vercel project to repo
- Set Vercel root directory to repo root (build uses `apps/client`)
- Add env vars in Vercel dashboard:
  - `VITE_WS_URL`
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`

### 2) Backend deployment (Render)

Add or confirm `render.yaml` at repo root:

```yaml
services:
  - type: web
    name: mahjong-server
    env: rust
    buildCommand: cargo build --release --bin mahjong_server
    startCommand: ./target/release/mahjong_server
    envVars:
      - key: RUST_LOG
        value: info
      - key: DATABASE_URL
        sync: false
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_ANON_KEY
        sync: false
```

Steps:

- Create Render service from GitHub repo
- Ensure port is taken from `$PORT` (Render injects)
- Set env vars in Render dashboard

### 3) Database (Supabase)

- Create Supabase project (PostgreSQL 15)
- Collect connection string for `DATABASE_URL`
- Add Supabase URL and anon key to frontend/backend env

### 4) Migrations

Use `sqlx` migrations in `crates/mahjong_server/migrations/`:

Steps:

- Install sqlx-cli
- Add migrations for `games`, `game_events`, and `players`
- Run migrations against Supabase using `DATABASE_URL`

Guidance:

- Keep migration files in version control
- Use `TIMESTAMPTZ` and `JSONB` as in the deployment spec

### 5) Build pipeline and CI

Add or validate `.github/workflows/deploy.yml`:

- Run tests and linting before deploy
- Deploy frontend via Vercel action
- Rely on Render auto-deploy for backend

### 6) Secrets and configuration hygiene

- Never store `DATABASE_URL` in client or repo
- Store secrets in Vercel/Render dashboards
- Use `VITE_` prefix only for safe client-side env vars

### 7) Monitoring and logs

- Confirm `tracing` output in server logs
- Verify Render log retention and access
- Optional: add Sentry integration if production need arises

### 8) Deployment checklist

Use the checklist from the spec:

- Initial setup (projects, env vars, migrations)
- Pre-deploy (tests, lint, builds)
- Post-deploy (smoke test, WS connectivity)

### 9) Rollback strategy

- Vercel: revert to previous deployment
- Render: redeploy previous commit
- Supabase: restore from backup

### 10) Cost awareness and scaling limits

- Acknowledge cold starts on Render free tier
- Note DB connection limits on Supabase free tier
- Plan for paid upgrades when concurrency grows

## Open questions / decisions

- Confirm where `vercel.json` and `render.yaml` should live if not in repo root.
- Decide whether to add a staging environment.
- Confirm if CI should run `npm run test` for client and `cargo bench` for server.

## Suggested file list

- `vercel.json`
- `render.yaml`
- `.github/workflows/deploy.yml`
- `crates/mahjong_server/migrations/`
- `apps/client/.env.production` (local template only; no secrets committed)
