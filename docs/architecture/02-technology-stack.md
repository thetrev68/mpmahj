# 2. Technology Stack

The American Mahjong project is built on a modern, high-performance stack designed for type safety, real-time interactivity, and cross-platform portability.

## 2.1 Language Summary

| Layer               | Language       | Rationale                                                                           |
| :------------------ | :------------- | :---------------------------------------------------------------------------------- |
| **Backend & Logic** | **Rust**       | Memory safety, performance, and powerful Enums for modeling complex game states.    |
| **Frontend & UI**   | **TypeScript** | Rapid UI development, rich ecosystem, and strict typing that matches the Rust core. |
| **Data Definition** | **JSON**       | Human-readable and widely supported format for annual Card definitions.             |

---

## 2.2 Backend Stack (The Logic & Server)

The backend is divided into a pure logic crate and a networking binary.

### 2.2.1 Core Logic (`mahjong_core`)

- **Target**: `wasm32`, `x86_64`, `aarch64`.
- **Key Libraries**:
  - `serde`: Serialization/Deserialization of game states.
  - `ts-rs`: Auto-generation of TypeScript interfaces.
  - `rand`: Cryptographically secure shuffling.
  - `itertools`: Complex permutations for Joker validation.

### 2.2.2 Game Server (`mahjong_server`)

- **Framework**: **Axum** (built on `tokio` and `tower`).
- **Concurrency**: Asynchronous tasks for handling hundreds of concurrent rooms.
- **Networking**: **WebSockets** for low-latency state synchronization.
- **Storage**: (Planned) **PostgreSQL** with `sqlx` for persistent player stats and game history.

---

## 2.3 Frontend Stack (The Presentation)

The frontend is a single-page application (SPA) optimized for high-frame-rate animations.

### 2.3.1 Framework & Build

- **Framework**: **React 18+**.
- **Build Tool**: **Vite** (for sub-second Hot Module Replacement).
- **Styling**: **Tailwind CSS** for responsive, utility-first UI.

### 2.3.2 State & Animation

- **State Management**: **Zustand** (Global state) + **React Context** (Local UI state).
- **Animations**: **Framer Motion** (Spring-physics based animations for tile movement).
- **Icons/Assets**: SVG-based tile faces for resolution independence.

---

## 2.4 Native Wrapper (Tauri v2)

We use **Tauri** to package the web frontend into native applications without the overhead of Electron.

- **Runtime**: Uses the system's native WebView (WebView2 on Windows, WebKit on macOS/iOS).
- **Security**: Strict IPC (Inter-Process Communication) between the UI and the Rust backend.
- **Native Features**: Used for Haptics (mobile), File I/O (saving preferences), and Window management.

---

## 2.5 Infrastructure & DevOps

- **Monorepo Tooling**:
  - **Cargo Workspaces**: Manages Rust dependencies.
  - **npm Workspaces**: Manages frontend packages.
- **Communication Protocol**:
  - **JSON-RPC style** messages over WebSockets.
  - **Type Sharing**: Rust structs serve as the source of truth; TypeScript types are generated at build time.
- **CI/CD**:
  - **GitHub Actions**: Automates linting, testing, and multi-platform builds.

---

## 2.6 Technology Choice Rationale

### Why Rust for Game Logic?

American Mahjong involves complex validation (checking a hand against hundreds of patterns with 8 wildcards). Rust’s performance ensures this validation happens in milliseconds, and its exhaustive pattern matching (`match` statements) ensures every edge case in the rules is handled.

### Why React for the UI?

The game board is highly component-driven (Tiles, Hands, Walls). React’s declarative nature, combined with Framer Motion, makes it easy to handle complex visual transitions (like the Charleston tile swap) while keeping the code maintainable.

### Why Tauri instead of Electron?

Tauri produces binaries that are ~90% smaller than Electron and use significantly less RAM. This is crucial for a game intended to run on older laptops and mobile devices.
