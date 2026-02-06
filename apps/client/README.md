# American Mahjong (NMJL) - Frontend

This is the React + TypeScript frontend for the American Mahjong (NMJL) game. It uses Vite as the build tool, Tailwind CSS for styling, and shadcn/ui components.

## Quick Start

### Prerequisites

- Node.js >= 18.0.0
- npm >= 9.0.0

### Installation

```bash
cd apps/client
npm install
```

### Development

```bash
# Start development server (http://localhost:5173)
npm run dev

# Run tests in watch mode
npm run test

# Run tests once
npm run test:run

# Generate coverage report
npm run test:coverage

# Build for production
npm run build
```

## Project Structure

```text
apps/client/src/
├── components/
│   ├── ui/           # shadcn/ui components (buttons, dialogs, inputs, etc.)
│   └── game/         # Game-specific components (Tile, GameBoard, etc.)
├── features/         # Feature modules (game, room)
├── hooks/            # Custom hooks (useGameSocket, useTileSelection)
├── lib/              # Utility functions
├── pages/            # Route pages (LobbyScreen)
├── stores/           # Zustand state management (roomStore)
├── test/             # Test infrastructure
│   ├── fixtures/     # Test data (game states, hands, events)
│   ├── mocks/        # Mock implementations (WebSocket)
│   └── test-utils.tsx # Testing utilities
└── types/bindings/   # Auto-generated TypeScript types from Rust
```

## Technology Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS v3
- **UI Components**: shadcn/ui
- **Testing**: Vitest + React Testing Library
- **State Management**: Zustand (lightweight, server-driven)
- **WebSocket**: Custom hook (`useGameSocket`)

## Key Features

- Real-time multiplayer via WebSocket
- Tile rendering and selection
- Game board with wall and player hands
- Charleston phase (tile passing)
- Main gameplay (drawing, discarding, calling)
- Win validation against NMJL rules
- AI hints at various difficulty levels

## Testing

The frontend has comprehensive test infrastructure:

- **Test Setup**: Vitest + React Testing Library
- **Mock Utilities**: WebSocket and Zustand store mocks
- **Fixtures**: 10+ test fixtures for game states, hands, and events
- **Coverage Goals**: 80%+ for stores/hooks, 70%+ for components

For more details, see [TESTING.md](TESTING.md) and the [test README](src/test/README.md).

## Backend Integration

The frontend communicates with the Rust backend via WebSocket using auto-generated TypeScript bindings. For details on the protocol, see the main [README.md](../../README.md#websocket-protocol).

## Contributing

See the main [README.md](../../README.md#contributing) for contribution guidelines.
