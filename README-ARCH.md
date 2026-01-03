# Project Context: American Mahjong Monorepo

## 1. Project DNA

- **Goal:** Build a high-performance, multiplayer **American Mahjong** game.
- **Core Philosophy:** Server-Authoritative "Truth" (Rust) vs. Reactive "Presentation" (React/Tauri).
- **Target Platforms:** Desktop (Windows/macOS), Web, Mobile (iOS/Android).
- **Vibe:** "Vibe Coding" on frontend (React/TS), Strict/Robust on backend (Rust).

## 2. Architecture: The Monorepo

We use a **Rust-centric Monorepo**.

- **Workspace Root:** Cargo workspace managing backend crates.
- **Apps Root:** Node/Turborepo managing frontend clients.

### The "Truth" (Backend)

- **`mahjong_core` (Crate):** Pure Rust library. Contains all game logic, state machines, and validation. NO network code. NO UI code.
- **`mahjong_server` (Binary):** The "Traffic Cop." Uses `axum` for WebSockets/HTTP. Manages rooms, player connections, and persistence.
- **Shared Types:** We use `ts-rs` or `typeshare` to auto-generate TypeScript interfaces from Rust structs to ensure type safety across the network boundary.

### The "View" (Frontend)

- **`client` (React + Vite):** The visual layer.
  - **State:** Uses `Zustand` to mirror server state.
  - **Animation:** Uses `Framer Motion` for tile movements (hand -> discard).
  - **Pattern:** Uses an "Action Queue" to decouple instant Server State updates from timed UI animations.
- **`mobile_desktop` (Tauri v2):** Wraps the `client` web app into native binaries (`.exe`, `.apk`, `.dmg`). Handles native features (haptics, file I/O).

## 3. Domain Specifics: American Mahjong (CRITICAL)

**NOTE TO AI:** This is **American Mahjong** (NMJL rules), NOT Riichi or Chinese Mahjong.

- **Jokers:** The game includes 8 Joker tiles. These are wildcards used in sets (Pungs/Kongs/Quints) but _never_ in a pair (unless the pair is the literal Joker pair).
- **The Card:** Winning hands are defined by an external data source (The National Mahjong League card), which changes annually. Validation logic must be data-driven/pluggable, not hardcoded.
- **The Charleston:** A mandatory tile-exchange phase before play begins (Right, Across, Left).
- **Tile Set:** 152 Tiles total.
  - **Suits:** Dots, Bams, Cracks (1-9).
  - **Winds:** N, E, S, W.
  - **Dragons:** Green, Red, White (Soap). _Note: White Dragon is used as 'Zero' in numerical runs._
  - **Flowers:** 8 Flowers (No distinct scoring per flower, just a group).
  - **Jokers:** 8 Jokers.

## 4. Tech Stack Choices

| Component              | Technology        | Reason                                                                        |
| :--------------------- | :---------------- | :---------------------------------------------------------------------------- |
| **Lang (Logic)**       | **Rust**          | Memory safety, performance, correctness (Enums are powerful for tile states). |
| **Lang (UI)**          | **TypeScript**    | Rapid UI development, great ecosystem.                                        |
| **Server**             | **Axum**          | Robust, ergonomic Rust web server.                                            |
| **Communication**      | **WebSockets**    | Real-time state syncing (Server pushes state to Client).                      |
| **Frontend Framework** | **React**         | Component-based UI.                                                           |
| **Build Tool**         | **Vite**          | Fast HMR.                                                                     |
| **Native Wrapper**     | **Tauri v2**      | Lightweight, secure native apps using the web frontend.                       |
| **State Sync**         | **Zustand**       | Simple client-side state management.                                          |
| **Animation**          | **Framer Motion** | declarative animations for tiles.                                             |

## 5. Folder Structure

```text
/root
├── Cargo.toml            # Rust Workspace
├── package.json          # Frontend Dependencies
├── crates/
│   ├── mahjong_core/     # PURE LOGIC (Structs: Tile, Hand, Wall)
│   └── mahjong_server/   # AXUM SERVER (WebSockets, Room Manager)
└── apps/
    └── client/           # REACT FRONTEND (UI, Animations, Tauri Config)
        ├── src/          # React Code
        └── src-tauri/    # Rust wrapper code

---Trevor's update...

/mahjong-project
├── Cargo.toml                <-- 🦀 Rust Workspace (Manages all crates)
├── package.json              <-- 📦 Node Workspace (Manages all JS/TS apps)
│
├── 📂 crates/                <-- THE BRAINS (Rust Backend & Logic)
│   │
│   ├── 📦 mahjong_core/      <-- 🧠 PURE LOGIC (The "Truth")
│   │   ├── src/lib.rs
│   │   ├── src/hand.rs       <-- "Is this hand a win?"
│   │   ├── src/scoring.rs    <-- "Calculate Fu/Fan"
│   │   └── Cargo.toml        <-- No network code here. Just math & rules.
│   │
│   └── 📦 mahjong_server/    <-- ☁️ THE SERVER (The "Traffic Cop")
│       ├── src/main.rs       <-- Starts the server
│       ├── src/ws.rs         <-- WebSockets (Room handling)
│       ├── src/db.rs         <-- Postgres connection (Save stats)
│       └── Cargo.toml        <-- Depends on `mahjong_core`
│
├── 📂 apps/                  <-- THE LOOKS (Frontend & Clients)
│   │
│   └── 🎨 client/            <-- 📱 ONE APP TO RULE THEM ALL (React + Tauri)
│       │
│       ├── package.json      <-- React/Vite config
│       ├── vite.config.ts
│       │
│       ├── 📂 src/           <-- 🖌️ YOUR VIBE CODING ZONE (React)
│       │   ├── App.tsx
│       │   ├── 📂 assets/    <-- Images, Sounds
│       │   │
│       │   ├── 📂 store/     <-- State Management (Zustand)
│       │   │   └── game.ts   <-- Syncs with Server State
│       │   │
│       │   ├── 📂 animations/<-- ✨ ANIMATION LOGIC
│       │   │   ├── variants.ts   <-- Framer Motion definitions
│       │   │   └── sequences.ts  <-- "Deal Tiles", "Win Effect"
│       │   │
│       │   └── 📂 components/
│       │       ├── Table.tsx     <-- The green board
│       │       ├── Tile.tsx      <-- The tile UI
│       │       └── MobileUI.tsx  <-- Layout adjustments for phones
│       │
│       └── 📂 src-tauri/     <-- 🏗️ THE NATIVE WRAPPER (Tauri v2)
│           ├── tauri.conf.json <-- "Build for iOS? Build for Windows?"
│           ├── Cargo.toml
│           ├── src/lib.rs    <-- Rust Bridge (File I/O, Haptics)
│           │
│           └── 📂 gen/       <-- 🤖 GENERATED NATIVE PROJECTS
│               ├── apple/    <-- Xcode project (iOS/macOS)
│               └── android/  <-- Android Studio project
│
└── 📂 scripts/               <-- Automation (e.g., "Run local server & client")
```
