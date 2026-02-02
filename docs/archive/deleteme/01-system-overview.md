# 1. System Overview

This document provides a high-level view of the **American Mahjong** system, outlining its purpose, scope, and interaction with the external world.

## 1.1 Project Scope & Goals

The goal of this project is to build a robust, cross-platform, multiplayer digital adaptation of **American Mahjong** (following National Mah Jongg League rules).

### Key Objectives

1. **Rule Fidelity**: Absolute correctness in implementing complex NMJL rules (The Charleston, Joker usage, "The Card" pattern matching).
2. **Performance**: Near-instant response times for gameplay actions using a Rust backend.
3. **Cross-Platform**: A unified codebase serving Web, Windows, macOS, iOS, and Android.
4. **Training Focus**: A strong AI system to help players practice and learn new yearly Cards.

---

## 1.2 System Context

The system operates as a client-server architecture where the server is the authoritative source of truth.

```mermaid
graph TD
    User[Player]
    Admin[Administrator]

    subgraph "American Mahjong System"
        Client[Client App\n(Web / Desktop / Mobile)]
        Server[Game Server]
        Core[Game Core Logic]
    end

    DataStore[(Game DB)]
    CardData[NMJL Card Definitions\n(JSON)]

    User -->|Plays via| Client
    Admin -->|Updates Card| Server

    Client <-->|WebSocket| Server
    Server -->|Uses| Core
    Server -->|Persists| DataStore
    Core -->|Validates against| CardData
```

### External Dependencies

- **NMJL Card Data**: The winning patterns change annually. The system loads these from external JSON definitions (`data/cards/cardYYYY.json`), allowing the game to support multiple years (e.g., "2024", "2025") without code changes.

---

## 1.3 Core Capabilities

### 1.3.1 Gameplay

- **Lobby System**: Room creation, joining via code, and spectator support.
- **The Charleston**: Complete implementation of the mandatory and optional tile passing phases, including blind passes and courtesy passes.
- **Turn Cycle**: Enforced draw/discard loop with strict timing for call windows.
- **Pattern Matching**: Real-time validation of hands against the complex, variable-logic patterns of American Mahjong.

### 1.3.2 AI & Training

- **Bots**: Server-side AI agents capable of filling empty seats or playing full practice games.
- **Hint System**: Analysis engine that can suggest moves to human players (e.g., "You are 2 tiles away from _2468 Run_").

### 1.3.3 Platform Support

- **Desktop**: Native window management, keyboard shortcuts.
- **Mobile**: Touch-optimized controls, haptic feedback, simplified UI.
- **Web**: Zero-install instant play.

---

## 1.4 High-Level Architecture

The system uses a **Monorepo** structure separating logic, server, and view.

1. **The "Truth" (Rust)**:
   - `mahjong_core`: Pure game logic, state machines, and rule validation. Zero I/O.
   - `mahjong_server`: Handles networking (WebSockets), room management, and AI execution.

2. **The "View" (TypeScript/React)**:
   - `client`: A unified React application using Zustand for state and Framer Motion for animation.
   - `tauri`: A thin wrapper enabling native file system access and system integration for desktop/mobile builds.

---

## 1.5 User Personas

| Persona                     | Needs                                          | System Feature                                                |
| :-------------------------- | :--------------------------------------------- | :------------------------------------------------------------ |
| **The Traditionalist**      | Wants exact NMJL rules, familiar visuals.      | "Traditional" tile set, strict Charleston enforcement.        |
| **The Commuter**            | Fast, one-handed play on mobile.               | Portrait mode (mobile), Haptic feedback, Resume on reconnect. |
| **The Student**             | Wants to learn the 2025 card without pressure. | "Bot Match" mode, "Best Move" hints, Pattern browser.         |
| **The Tournament Director** | Needs to organize distinct tables.             | Private rooms, Custom timers (e.g., 10s turns).               |

---

## 1.6 Key User Flows

### 1.6.1 Game Lifecycle

1. **Setup**: Host selects "2025 Card", "Private", "Add 2 Bots".
2. **Room**: Players join via Room ID.
3. **Charleston**: Synchronous tile exchange. All 4 players must act to advance stages.
4. **Play**: Turn-based action. Server broadcasts state; Clients animate results.
5. **Win**: Player clicks "Mahjong". Server validates. If valid, game ends. If invalid, hand is dead.

### 1.6.2 The "Call" Interrupt

American Mahjong allows out-of-turn actions ("Calls").

1. Player A discards a tile.
2. Server starts a **Call Window** (e.g., 4 seconds).
3. Player C clicks "Call" for a Pung.
4. Server validates the call.
5. If valid, turn jumps to Player C. Player B is skipped.
