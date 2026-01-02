# Technical Architecture - American Mahjong Game

> **Note**: This document provides an overview and table of contents. Each section has been split into its own file for easier navigation and maintenance.

See also: [PLANNING.md](PLANNING.md) for user-facing feature descriptions.

---

## Architecture Documents

1. [System Overview](docs/architecture/01-system-overview.md)
2. [Technology Stack](docs/architecture/02-technology-stack.md)
3. [Module Architecture](docs/architecture/03-module-architecture.md)
4. [State Machine Design](docs/architecture/04-state-machine-design.md)
5. [Data Models](docs/architecture/05-data-models.md)
6. [Command/Event System (API Contract)](docs/architecture/06-command-event-system-api-contract.md)
7. [The Card Schema](docs/architecture/07-the-card-schema.md)
8. [Validation Engine](docs/architecture/08-validation-engine.md)
9. [Network Protocol](docs/architecture/09-network-protocol.md)
10. [Frontend Architecture](docs/architecture/10-frontend-architecture.md)
11. [AI System](docs/architecture/11-ai-system.md)
12. [Testing Strategy](docs/architecture/12-testing-strategy.md)

---

## Quick Reference

### Completed Sections

- ✅ **Section 4**: State Machine Design - Game phases, Charleston, turn flow
- ✅ **Section 5**: Data Models - Tile, Hand, Player, Table structures
- ✅ **Section 6**: Command/Event System - API contract between client/server
- ✅ **Section 7**: The Card Schema - Pattern representation (using proven format with 5 years of data)

### In Progress

- 🚧 **Section 8**: Validation Engine
- 🚧 **Section 9**: Network Protocol
- 🚧 **Section 10**: Frontend Architecture
- 🚧 **Section 11**: AI System
- 🚧 **Section 12**: Testing Strategy

### TODO

- **Section 1**: System Overview
- **Section 2**: Technology Stack
- **Section 3**: Module Architecture

---

## Key Design Decisions

1. **Server-Authoritative**: Rust backend holds truth, React frontend is presentation
2. **Command/Event Pattern**: Clean separation between intent (commands) and reality (events)
3. **Type-Driven State Machine**: Impossible states are impossible (can't discard during Charleston)
4. **Proven Card Format**: Using battle-tested format with 5 years of NMJL card data
5. **Variable Suits (VSUIT1/2/3)**: Elegant solution for 'same suit' constraints

---

## Development Status

This is a **design document**. Implementation follows the patterns documented here.

For implementation progress, see the main README.md.