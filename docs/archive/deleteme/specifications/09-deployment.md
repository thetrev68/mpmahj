# 09. Deployment Implementation Spec

This document specifies deployment architecture and infrastructure for MVP.

---

## 1. Deployment Architecture

MVP uses a serverless/managed approach to minimize DevOps overhead.

```text
┌─────────────────────────────────────────────────────────────┐
│                         Internet                            │
└──────────────────┬──────────────────┬───────────────────────┘
                   │                  │
          ┌────────▼────────┐  ┌──────▼──────────┐
          │  Vercel CDN     │  │  Render.com     │
          │  (Frontend)     │  │  (WebSocket)    │
          │  - Static HTML  │  │  - Rust Server  │
          │  - React SPA    │  │  - Game Logic   │
          └─────────────────┘  └──────┬──────────┘
                                      │
                               ┌──────▼──────────┐
                               │  Supabase       │
                               │  (PostgreSQL)   │
                               │  - Auth         │
                               │  - Game State   │
                               │  - Replays      │
                               └─────────────────┘
```

---

## 2. Component Hosting

### Frontend: Vercel

- Host: **Vercel** (free tier for MVP)
- Repo: `apps/client/`
- Build command: `npm run build`
- Output: `apps/client/dist/`
- Domain: `mpmahj.vercel.app` (custom domain optional)

Vercel config (`vercel.json`):

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "apps/client/dist",
  "framework": "vite",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Backend: Render.com

- Host: **Render.com** (free tier for MVP, $7/mo for production)
- Repo: `crates/mahjong_server/`
- Build command: `cargo build --release --bin mahjong_server`
- Start command: `./target/release/mahjong_server`
- Port: `8080` (Render assigns via `$PORT` env var)

Render config (`render.yaml`):

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
        sync: false # Set in Render dashboard (from Supabase)
      - key: SUPABASE_URL
        sync: false
      - key: SUPABASE_ANON_KEY
        sync: false
```

### Database: Supabase

- Host: **Supabase** (free tier for MVP)
- Database: PostgreSQL 15
- Features used:
  - Auth (user management, session tokens)
  - Realtime (optional, for future features)
  - PostgREST (optional, for future admin dashboard)

Connection string format:

```text
postgresql://postgres:[PASSWORD]@db.[PROJECT].supabase.co:5432/postgres
```

---

## 3. Environment Variables

### Frontend (Vercel)

```bash
# .env.production
VITE_WS_URL=wss://mahjong-server.onrender.com
VITE_SUPABASE_URL=https://[project].supabase.co
VITE_SUPABASE_ANON_KEY=[key]
```

### Backend (Render)

```bash
# Set in Render dashboard
DATABASE_URL=postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres
SUPABASE_URL=https://[project].supabase.co
SUPABASE_ANON_KEY=[key]
RUST_LOG=info
PORT=8080  # Render sets this automatically
```

---

## 4. Database Schema Migrations

Use `sqlx` for compile-time verified queries and migrations.

Setup:

```bash
# Install sqlx-cli
cargo install sqlx-cli --no-default-features --features postgres

# Create migration
sqlx migrate add create_games_table

# Run migrations
sqlx migrate run --database-url $DATABASE_URL
```

Migration files in `crates/mahjong_server/migrations/`:

```sql
-- migrations/001_create_games.sql
CREATE TABLE games (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    winner_seat TEXT,
    winning_pattern TEXT,
    final_state JSONB,
    seed BIGINT NOT NULL
);

CREATE INDEX idx_games_created ON games(created_at);
```

---

## 5. Build Pipeline

### Local Development

```bash
# Run server locally
cargo run --bin mahjong_server

# Run client locally (connects to local server)
cd apps/client && npm run dev

# Run terminal client
cargo run --bin mahjong_terminal
```

### CI/CD (GitHub Actions)

`.github/workflows/deploy.yml`:

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo test --all
      - run: cargo clippy -- -D warnings
      - run: cargo fmt --check

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm run build
      - uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      # Render auto-deploys on git push to main
      # No explicit deployment step needed
      - run: echo "Render will auto-deploy backend"
```

---

## 6. Database Backups

Supabase provides automatic daily backups (free tier: 7 days retention).

Manual backup:

```bash
# Export database
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore database
psql $DATABASE_URL < backup_20260102.sql
```

For production, use Supabase's "Point-in-Time Recovery" feature (paid tier).

---

## 7. Monitoring and Logging

### Backend Logs (Render)

- Logs available in Render dashboard: `https://dashboard.render.com/`
- Logs are retained for 7 days (free tier)
- Use `tracing` crate for structured logging:

```rust
use tracing::{info, warn, error};

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    info!("Server starting on port 8080");
    // ...
}
```

### Error Tracking (Optional)

For production, integrate Sentry:

```toml
[dependencies]
sentry = "0.32"
```

```rust
let _guard = sentry::init(("https://[key]@sentry.io/[project]", sentry::ClientOptions {
    release: sentry::release_name!(),
    ..Default::default()
}));
```

### Metrics (Future)

- Track: Games created, games completed, average game duration, player count
- Tool: Supabase Analytics or custom Prometheus/Grafana

---

## 8. Scaling Considerations

MVP uses free/cheap tiers and won't scale beyond ~100 concurrent users.

Bottlenecks:

1. **Render free tier**: Spins down after 15 minutes of inactivity (cold start: 30s)
2. **Single server instance**: No horizontal scaling on free tier
3. **Database connections**: Supabase free tier limits concurrent connections

For production scaling:

- Upgrade Render to paid tier ($7/mo for always-on)
- Use Render's auto-scaling (paid feature)
- Implement connection pooling (`sqlx::Pool`)
- Add Redis for session state (reduce DB load)

---

## 9. Security

### Authentication

- Use Supabase Auth for user management
- JWT tokens for session auth
- Token refresh on expiry

### WebSocket Security

- Validate session token on connection
- Rate limit commands (10/sec per client)
- Validate all commands server-side (never trust client)

### Database Security

- Use Supabase Row Level Security (RLS) policies
- Never expose `DATABASE_URL` in client code
- Use prepared statements (sqlx) to prevent SQL injection

### HTTPS/WSS

- Vercel automatically provides HTTPS
- Render automatically provides WSS (wss://)
- Never use `ws://` in production (unencrypted)

---

## 10. Deployment Checklist

### Initial Setup

- [x] Create Supabase project
- [x] Create Render project (linked to GitHub repo)
- [x] Create Vercel project (linked to GitHub repo)
- [x] Set environment variables in Render dashboard
- [x] Set environment variables in Vercel dashboard
- [x] Run database migrations on Supabase
- [x] Test WebSocket connection from Vercel frontend to Render backend

### Pre-Deployment

- [x] All tests pass (`cargo test`, `npm test`)
- [x] Linting passes (`cargo clippy`, `npm run lint`)
- [x] Code formatted (`cargo fmt`, `npm run format`)
- [x] Build succeeds locally (`cargo build --release`, `npm run build`)
- [x] Manual smoke test (terminal client → server)

### Post-Deployment

- [x] Verify frontend loads at `https://mpmahj.vercel.app`
- [x] Verify WebSocket connects to backend
- [x] Verify database connection works (check logs)
- [ ] Create test game end-to-end
- [ ] Monitor error logs for 24 hours

---

## 11. Rollback Strategy

If deployment breaks:

1. **Frontend (Vercel)**: Revert to previous deployment in Vercel dashboard (one-click)
2. **Backend (Render)**: Redeploy previous commit via Render dashboard
3. **Database**: Restore from Supabase backup (dashboard → Database → Backups)

Always test in staging before deploying to production.

---

## 12. Cost Estimate (MVP)

| Service   | Tier         | Cost         |
| --------- | ------------ | ------------ |
| Vercel    | Hobby (Free) | $0/month     |
| Render    | Free         | $0/month     |
| Supabase  | Free         | $0/month     |
| **Total** |              | **$0/month** |

Production upgrade:

| Service   | Tier    | Cost          |
| --------- | ------- | ------------- |
| Vercel    | Pro     | $20/month     |
| Render    | Starter | $7/month      |
| Supabase  | Pro     | $25/month     |
| **Total** |         | **$52/month** |

---

## 13. Future Enhancements

Post-MVP, consider:

- **CDN for assets**: Cloudflare or Vercel Edge Functions
- **Redis caching**: Reduce database load for session state
- **Load balancer**: Multiple Render instances with Nginx/HAProxy
- **Regional deployment**: Deploy servers closer to users (US East, EU, Asia)
- **Monitoring dashboard**: Grafana for real-time metrics
- **Automated tests in CI**: Run integration tests on every commit
