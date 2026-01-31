# Complete User Story List

## Setup & Deal (1)

- US-001: Roll Dice & Break Wall ✅

## Charleston (7)

- US-002: Charleston First Right (Standard Pass) ✅
- US-003: Charleston First Left (Blind Pass)
- US-004: Charleston First Across
- US-005: Charleston Voting (Stop/Continue)
- US-006: Charleston Second Charleston (Optional)
- US-007: Courtesy Pass Negotiation
- US-008: Charleston IOU Detection (Edge Case)

## Main Gameplay - Turn Flow (4)

- US-009: Drawing a Tile
- US-010: Discarding a Tile
- US-011: Call Window & Intent Buffering
- US-012: Call Priority Resolution

## Main Gameplay - Special Actions (5)

- US-013: Calling Pung/Kong/Quint/Sextet
- US-014: Exchanging Joker (Single)
- US-015: Exchanging Joker (Multiple in One Turn)
- US-016: Upgrading Meld (Pung → Kong → Quint)
- US-017: Wall Closure Rule

## Winning & End Game (4)

- US-018: Declaring Mahjong (Self-Draw)
- US-019: Declaring Mahjong (Called Discard)
- US-020: Invalid Mahjong → Dead Hand
- US-021: Wall Game (Draw)

## Advanced Features (7)

- US-022: Smart Undo (Solo - Immediate)
- US-023: Smart Undo (Voting - Multiplayer)
- US-024: View Move History
- US-025: Jump to Historical Move
- US-026: Resume from History Point
- US-027: Request Hints (AI Analysis)
- US-028: Adjust Hint Verbosity

## Room & Session Management (5)

- US-029: Create Room
- US-030: Join Room
- US-031: Leave Game
- US-032: Forfeit Game
- US-033: Abandon Game (Voting)

## Settings & Preferences (3)

- US-034: Configure House Rules
- US-035: Animation Settings
- US-036: Timer Configuration

### Total: 36 User Stories

## Next Steps (After User Stories)

### Component Specifications (~25-30 specs)

**Presentational**: Tile, TurnIndicator, WallCounter, CharlestonTracker, etc.
**Container**: ConcealedHand, PlayerRack, ActionBar, CallWindowPanel, etc.
**Integration**: CharlestonFlow, TurnFlow, CallWindowFlow
Mock Data Fixtures (~15-20 JSON files)

### Game states for each phase

- Sample hands (winning, charleston, dead hand)
- Event sequences for flows
- Test Scenarios (~20-25 scenarios)

- Step-by-step test scripts mapping user stories to executable tests

### Implementation (TDD cycle begins)

- Write tests → Implement components → Refactor
- Start with presentational components (easiest)
- Move to containers → integration
