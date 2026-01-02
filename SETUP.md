# Setup Complete

Your American Mahjong monorepo is now fully configured and ready for development.

## What Was Set Up

### 1. Monorepo Structure

- **Root package.json**: Manages the monorepo with npm workspaces
- **Cargo workspace**: Manages Rust crates (mahjong_core, mahjong_server)
- **.gitignore**: Proper ignore rules for Rust, Node, Tauri, and IDE files

### 2. Backend (Rust)

- **mahjong_core**: Pure game logic library
  - Added `ts-rs` for TypeScript type generation
  - Dependencies: `serde`, `ts-rs`
- **mahjong_server**: Axum-based WebSocket server
  - Dependencies: `axum`, `tokio`, `serde`, `serde_json`

### 3. Frontend (React + Vite)

- **apps/client**: React application with Vite
  - Dependencies: `react`, `react-dom`, `zustand`, `framer-motion`
  - DevDependencies: TypeScript, ESLint, Vite plugins
  - Configured for hot module replacement (HMR)

### 4. Native Wrapper (Tauri v2)

- **apps/client/src-tauri**: Tauri native wrapper
  - Configured for Windows, macOS, Linux desktop builds
  - Android/iOS mobile support available
  - Icons and build configuration ready

## Verified Working

All builds are passing:

- Rust workspace builds successfully
- React client builds successfully
- TypeScript compilation works
- All dependencies installed correctly

## Project Structure

```text
mpmahj/
├── Cargo.toml                 # Rust workspace config
├── package.json               # Root package management
├── .gitignore                 # Version control ignores
├── README-ARCH.md             # Architecture documentation
├── SETUP.md                   # This file
├── crates/
│   ├── mahjong_core/          # Pure game logic (Rust)
│   │   ├── Cargo.toml
│   │   └── src/lib.rs
│   └── mahjong_server/        # WebSocket server (Rust + Axum)
│       ├── Cargo.toml
│       └── src/main.rs
└── apps/
    └── client/                # React frontend
        ├── package.json
        ├── index.html
        ├── vite.config.ts
        ├── src/               # React code
        └── src-tauri/         # Tauri wrapper (Rust)
            ├── Cargo.toml
            ├── tauri.conf.json
            └── src/
```

## Available Commands

### Development

```bash
# Start React dev server
npm run dev

# Start React dev server (from root)
npm run dev:client

# Start Rust server
cargo run --bin mahjong_server

# Start Tauri desktop app (dev mode)
cd apps/client
cargo tauri dev
```

### Building

```bash
# Build React client
npm run build:client

# Build Rust server (release mode)
npm run build:server

# Build everything
npm run build:all

# Build Tauri desktop app
cd apps/client
cargo tauri build
```

### Testing & Linting

```bash
# Run Rust tests
cargo test

# Run frontend linting
npm run lint
```

## Next Steps for Development

### 1. Define Core Types (mahjong_core)

Start by defining your tile types, game state, and validation logic in [crates/mahjong_core/src/lib.rs](crates/mahjong_core/src/lib.rs):

```rust
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub enum Suit {
    Dots,
    Bams,
    Cracks,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
pub enum Wind {
    North,
    East,
    South,
    West,
}

// Add more types...
```

### 2. Generate TypeScript Types

After defining Rust types with `#[derive(TS)]`:

```bash
# Types will be generated to bindings/ folder
cargo test  # ts-rs generates types during test compilation
```

### 3. Set Up Zustand Store

Create state management in [apps/client/src/store/](apps/client/src/store/):

```typescript
import { create } from 'zustand';

interface GameState {
  tiles: Tile[];
  // Add state...
}

export const useGameStore = create<GameState>((set) => ({
  tiles: [],
  // Add actions...
}));
```

### 4. Implement WebSocket Communication

- Server: Add WebSocket handlers in mahjong_server
- Client: Connect to server and sync state via Zustand

### 5. Add Animations with Framer Motion

```typescript
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
>
  {/* Your tile components */}
</motion.div>
```

## Tech Stack Summary

| Component | Technology | Version |
| --------- | --------- | ------- |
| Backend Language | Rust | 1.92.0 |
| Frontend Language | TypeScript | 5.9.3 |
| Frontend Framework | React | 19.2.0 |
| Build Tool | Vite | 7.2.4 |
| Server Framework | Axum | 0.7 |
| State Management | Zustand | 5.0.2 |
| Animations | Framer Motion | 11.15.0 |
| Native Wrapper | Tauri | 2.9.6 |
| Type Generation | ts-rs | 10.1.0 |

## Troubleshooting

### Common Issues

1. **Tauri build fails**: Ensure you have the required system dependencies for your platform
   - Windows: WebView2 runtime
   - macOS: Xcode command line tools
   - Linux: webkit2gtk

2. **TypeScript types not found**: Run `cargo test` to regenerate TypeScript bindings

3. **Port conflicts**: Default dev server runs on port 5173. Change in [apps/client/vite.config.ts](apps/client/vite.config.ts)

## Resources

- [Tauri Documentation](https://tauri.app/v2/)
- [Axum Documentation](https://docs.rs/axum/)
- [Zustand Documentation](https://docs.pmnd.rs/zustand/)
- [Framer Motion Documentation](https://www.framer.com/motion/)
- [ts-rs Documentation](https://docs.rs/ts-rs/)

---

Happy coding! Your American Mahjong game is ready to be built.
