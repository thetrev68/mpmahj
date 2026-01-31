# User Stories Index

## Completed Stories (14 of 36)

### Setup & Deal

- ✅ **US-001**: Roll Dice & Break Wall (Pre-existing)
  - Epic: Setup
  - Priority: HIGH
  - Complexity: 3 points

### Charleston (7 stories)

- ✅ **US-002**: Charleston First Right (Pre-existing)
  - Epic: Charleston
  - Priority: CRITICAL
  - Complexity: 8 points

- ✅ **US-003**: Charleston First Across
  - Epic: Charleston
  - Priority: CRITICAL
  - Complexity: 5 points

- ✅ **US-004**: Charleston First Left (Blind Pass)
  - Epic: Charleston
  - Priority: CRITICAL
  - Complexity: 13 points
  - Special: Blind pass + IOU detection

- ✅ **US-005**: Charleston Voting (Stop/Continue)
  - Epic: Charleston
  - Priority: CRITICAL
  - Complexity: 5 points

- ✅ **US-006**: Charleston Second Charleston (Optional)
  - Epic: Charleston
  - Priority: HIGH
  - Complexity: 8 points
  - Includes: SecondLeft, SecondAcross, SecondRight

- ✅ **US-007**: Courtesy Pass Negotiation
  - Epic: Charleston
  - Priority: HIGH
  - Complexity: 8 points
  - Special: Pair-private negotiation

- ✅ **US-008**: Charleston IOU Detection (Edge Case)
  - Epic: Charleston
  - Priority: MEDIUM
  - Complexity: 5 points
  - Special: Rare scenario handling

### Main Gameplay - Turn Flow

- ✅ **US-009**: Drawing a Tile
  - Epic: Main Game
  - Priority: CRITICAL
  - Complexity: 3 points

- ✅ **US-010**: Discarding a Tile
  - Epic: Main Game
  - Priority: CRITICAL
  - Complexity: 3 points

- ✅ **US-011**: Call Window & Intent Buffering
  - Epic: Main Game
  - Priority: CRITICAL
  - Complexity: 8 points
  - Special: Multi-player intent buffering

- ✅ **US-012**: Call Priority Resolution
  - Epic: Main Game
  - Priority: HIGH
  - Complexity: 3 points

### Main Gameplay - Special Actions

- ✅ **US-013**: Calling Pung/Kong/Quint/Sextet
  - Epic: Main Game
  - Priority: CRITICAL
  - Complexity: 8 points
  - Special: Multiple meld types, replacement draws

- ✅ **US-014**: Exchanging Joker (Single)
  - Epic: Main Game
  - Priority: HIGH
  - Complexity: 5 points

## Remaining Stories (22 of 36)

### Main Gameplay - Special Actions (Continued)

- ⏳ **US-015**: Exchanging Joker (Multiple in One Turn)
  - Epic: Main Game
  - Priority: HIGH
  - Complexity: 3 points
  - Extends: US-014 with multiple exchanges

- ⏳ **US-016**: Upgrading Meld (Pung → Kong → Quint)
  - Epic: Main Game
  - Priority: HIGH
  - Complexity: 5 points
  - Special: Add tiles to existing exposed melds

- ⏳ **US-017**: Wall Closure Rule
  - Epic: Main Game
  - Priority: MEDIUM
  - Complexity: 2 points
  - Special: Last 14 tiles (dead wall) cannot be called

### Winning & End Game

- ⏳ **US-018**: Declaring Mahjong (Self-Draw)
  - Epic: End Game
  - Priority: CRITICAL
  - Complexity: 8 points
  - Special: Hand validation, pattern matching

- ⏳ **US-019**: Declaring Mahjong (Called Discard)
  - Epic: End Game
  - Priority: CRITICAL
  - Complexity: 8 points
  - Special: Call window → validation → scoring

- ⏳ **US-020**: Invalid Mahjong → Dead Hand
  - Epic: End Game
  - Priority: HIGH
  - Complexity: 5 points
  - Special: Penalty for false Mahjong claim

- ⏳ **US-021**: Wall Game (Draw)
  - Epic: End Game
  - Priority: HIGH
  - Complexity: 3 points
  - Special: No winner, wall exhausted

### Advanced Features

- ⏳ **US-022**: Smart Undo (Solo - Immediate)
  - Epic: Advanced
  - Priority: MEDIUM
  - Complexity: 5 points
  - Special: Undo last action if solo game or immediate

- ⏳ **US-023**: Smart Undo (Voting - Multiplayer)
  - Epic: Advanced
  - Priority: MEDIUM
  - Complexity: 8 points
  - Special: All players must vote to approve undo

- ⏳ **US-024**: View Move History
  - Epic: Advanced
  - Priority: MEDIUM
  - Complexity: 3 points
  - Special: Read-only history view

- ⏳ **US-025**: Jump to Historical Move
  - Epic: Advanced
  - Priority: MEDIUM
  - Complexity: 5 points
  - Special: Time-travel to specific move

- ⏳ **US-026**: Resume from History Point
  - Epic: Advanced
  - Priority: MEDIUM
  - Complexity: 8 points
  - Special: Continue game from historical state

- ⏳ **US-027**: Request Hints (AI Analysis)
  - Epic: Advanced
  - Priority: MEDIUM
  - Complexity: 5 points
  - Special: AI-powered hand analysis

- ⏳ **US-028**: Adjust Hint Verbosity
  - Epic: Advanced
  - Priority: LOW
  - Complexity: 2 points
  - Special: Settings for hint detail level

### Room & Session Management

- ⏳ **US-029**: Create Room
  - Epic: Session
  - Priority: CRITICAL
  - Complexity: 5 points
  - Special: Room configuration, card year selection

- ⏳ **US-030**: Join Room
  - Epic: Session
  - Priority: CRITICAL
  - Complexity: 3 points
  - Special: Seat selection, player info

- ⏳ **US-031**: Leave Game
  - Epic: Session
  - Priority: HIGH
  - Complexity: 2 points
  - Special: Graceful exit, bot takeover

- ⏳ **US-032**: Forfeit Game
  - Epic: Session
  - Priority: MEDIUM
  - Complexity: 3 points
  - Special: Surrender, immediate loss

- ⏳ **US-033**: Abandon Game (Voting)
  - Epic: Session
  - Priority: MEDIUM
  - Complexity: 5 points
  - Special: All players vote to abandon

### Settings & Preferences

- ⏳ **US-034**: Configure House Rules
  - Epic: Settings
  - Priority: HIGH
  - Complexity: 5 points
  - Special: Blanks, wall closure, joker pairs, etc.

- ⏳ **US-035**: Animation Settings
  - Epic: Settings
  - Priority: MEDIUM
  - Complexity: 2 points
  - Special: Instant mode, speed, motion reduction

- ⏳ **US-036**: Timer Configuration
  - Epic: Settings
  - Priority: MEDIUM
  - Complexity: 2 points
  - Special: Charleston timers, call windows, turn timers

## Story Point Summary

| Category           | Stories | Total Points | Status          |
| ------------------ | ------- | ------------ | --------------- |
| Setup & Deal       | 1       | 3            | ✅ Complete     |
| Charleston         | 7       | 52           | ✅ Complete     |
| Turn Flow          | 4       | 17           | ✅ Complete     |
| Special Actions    | 5       | 21           | 🔄 2/5 Complete |
| Winning & End Game | 4       | 24           | ⏳ Pending      |
| Advanced Features  | 7       | 36           | ⏳ Pending      |
| Room & Session     | 5       | 18           | ⏳ Pending      |
| Settings           | 3       | 9            | ⏳ Pending      |
| **Total**          | **36**  | **180**      | **14/36 (39%)** |

## Epic Priorities

1. **CRITICAL** (9 stories): Core gameplay blocking features
2. **HIGH** (11 stories): Important gameplay features
3. **MEDIUM** (13 stories): Enhanced features and advanced functionality
4. **LOW** (1 story): Nice-to-have improvements

## Implementation Order (Recommended)

### Phase 1: MVP (Critical Path)

1. Setup & Deal (US-001) ✅
2. Charleston Complete Flow (US-002 through US-008) ✅
3. Turn Flow (US-009 through US-012) ✅
4. Basic Calling (US-013) ✅
5. Winning (US-018, US-019)
6. Room Management (US-029, US-030)

### Phase 2: Core Features

1. Special Actions (US-014, US-015, US-016)
2. End Game Scenarios (US-020, US-021)
3. Session Management (US-031, US-032, US-033)

### Phase 3: Advanced Features

1. History & Undo (US-022, US-023, US-024, US-025, US-026)
2. Hints (US-027, US-028)
3. Settings (US-034, US-035, US-036)
4. Edge Cases (US-017)

## Next Steps

After completing all 36 user stories:

1. **Component Specifications** (~25-30 specs)
   - Presentational components
   - Container components
   - Integration components
   - Hooks and utilities

2. **Test Scenarios** (~30-40 scenarios)
   - Unit test scenarios
   - Integration test scenarios
   - E2E test scenarios
   - Accessibility test scenarios

3. **Mock Data & Fixtures** (~20-30 files)
   - Game state fixtures
   - Event sequence fixtures
   - Sample hand fixtures
   - Error scenario fixtures

4. **Implementation** (TDD cycle)
   - Write tests → Implement components → Refactor
   - Follow priority order above
   - Start with presentational components
   - Progress to containers → integration

## Notes

- Each story includes all 15 required sections per template
- Stories cross-reference related stories
- Backend references link to Rust code locations
- Accessibility considerations included for all stories
- Definition of Done uses unchecked `[ ]` items (not `[x]`)
- Bot behavior specified where applicable
- Animation settings (instant mode) noted throughout
- Timer synchronization emphasized for time-sensitive features
