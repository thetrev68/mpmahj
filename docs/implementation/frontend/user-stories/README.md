# User Stories

Complete acceptance criteria for all 36 frontend features, organized by game phase.

## Quick Reference

Each story file (`US-XXX-name.md`) contains:

- Acceptance criteria (what must work)
- UI/UX requirements (how it looks and behaves)
- Backend integration (commands/events to send/receive)
- Error handling (what can go wrong)
- Accessibility requirements
- Testing strategy

## Stories by Game Phase

### 1. Room Setup & Session Management

**US-029: Create Room** ⭐ CRITICAL
Create a game room with configuration options (card year, house rules, bot difficulty)

**US-030: Join Room** ⭐ CRITICAL
Join an existing room by code, select seat, see player roster

**US-031: Leave Game** 🔶 HIGH
Exit gracefully with bot takeover if game in progress

**US-032: Forfeit Game** 🟡 MEDIUM
Surrender and accept immediate loss (scored as if you paid everyone max)

**US-033: Abandon Game (Voting)** 🟡 MEDIUM
All players vote to cancel game without scoring (e.g., disconnect issues)

---

### 2. Game Start

**US-001: Roll Dice & Break Wall** 🔶 HIGH
Determine dealer, roll dice, animate wall break, show starting position

---

### 3. Charleston (Tile Passing)

**US-002: Charleston First Right** ⭐ CRITICAL
Pass 3 tiles to the right, receive 3 from the left (First Charleston)

**US-003: Charleston First Across** ⭐ CRITICAL
Pass 3 tiles across, receive 3 from across

**US-004: Charleston First Left (Blind Pass)** ⭐ CRITICAL
Pass 1-3 tiles left (can do blind pass/steal on last tile)

**US-005: Charleston Voting (Stop/Continue)** ⭐ CRITICAL
Vote to stop Charleston or continue to Second Charleston

**US-006: Charleston Second Charleston (Optional)** 🔶 HIGH
Reverse direction passes (Left → Across → Right) if all players agree

**US-007: Courtesy Pass Negotiation** 🔶 HIGH
Optional across-only pass (0-3 tiles) between you and opposite player

**US-008: Charleston IOU Detection (Edge Case)** 🟡 MEDIUM
Detect rare scenario where all players blind-passed everything

---

### 4. Main Gameplay - Core Turn Flow

**US-009: Drawing a Tile** ⭐ CRITICAL
Draw tile from wall on your turn, add to hand (14 tiles total)

**US-010: Discarding a Tile** ⭐ CRITICAL
Select and discard one tile, opening call window for other players

**US-011: Call Window & Intent Buffering** ⭐ CRITICAL
5-second window for players to call discarded tile; buffer simultaneous intents

**US-012: Call Priority Resolution** 🔶 HIGH
Resolve conflicts when multiple players call (Mahjong > Meld, then turn order)

---

### 5. Main Gameplay - Special Actions

**US-013: Calling Pung/Kong/Quint/Sextet** ⭐ CRITICAL
Call discarded tile to form exposed meld (Pung=3, Kong=4, Quint=5, Sextet=6)

**US-014: Exchanging Joker (Single)** 🔶 HIGH
Replace Joker in opponent's exposed meld with natural tile from your hand

**US-015: Exchanging Joker (Multiple in One Turn)** 🔶 HIGH
Exchange multiple Jokers in one turn (if house rules allow)

**US-016: Upgrading Meld (Pung → Kong → Quint)** 🔶 HIGH
Add tiles to your own exposed melds (Pung+1 → Kong, Kong+1 → Quint)

**US-017: Wall Closure Rule** 🟡 MEDIUM
Last 14 tiles (dead wall) cannot be called, only drawn

---

### 6. Winning & End Game

**US-018: Declaring Mahjong (Self-Draw)** ⭐ CRITICAL
Win by drawing the final tile yourself; validate hand against NMJL patterns

**US-019: Declaring Mahjong (Called Discard)** ⭐ CRITICAL
Win by calling opponent's discard; validate and score

**US-020: Invalid Mahjong → Dead Hand** 🔶 HIGH
Penalty for false Mahjong claim: hand becomes dead, cannot win rest of game

**US-021: Wall Game (Draw)** 🔶 HIGH
Wall exhausted with no winner; game ends in draw

---

### 7. Advanced Features - History & Undo

**US-022: Smart Undo (Solo - Immediate)** 🟡 MEDIUM
Undo last action in solo game or immediately after action in multiplayer

**US-023: Smart Undo (Voting - Multiplayer)** 🟡 MEDIUM
Request undo in multiplayer; all players vote to approve/deny

**US-024: View Move History** 🟡 MEDIUM
Browse full game history (read-only timeline of all moves)

**US-025: Jump to Historical Move** 🟡 MEDIUM
Navigate to specific point in history to review state

**US-026: Resume from History Point** 🟡 MEDIUM
Rewind game to historical state and continue from there (if all agree)

---

### 8. Advanced Features - AI Hints

**US-027: Request Hints (AI Analysis)** 🟡 MEDIUM
Ask AI for strategic advice (what to discard, which pattern to pursue)

**US-028: Adjust Hint Verbosity** 🟢 LOW
Control detail level of AI hints (brief/detailed/expert)

---

### 9. Settings & Preferences

**US-034: Configure House Rules** 🔶 HIGH
Toggle variations (allow Joker pairs, wall closure enforcement, blanks as Jokers, etc.)

**US-035: Animation Settings** 🟡 MEDIUM
Control animation speed or enable instant mode (accessibility/speed preference)

**US-036: Timer Configuration** 🟡 MEDIUM
Adjust time limits for Charleston, call windows, turns (or disable)

---

## Priority Legend

- ⭐ **CRITICAL** (9 stories) - Core gameplay, MVP blockers
- 🔶 **HIGH** (11 stories) - Important features, strong UX impact
- 🟡 **MEDIUM** (15 stories) - Enhanced features, quality-of-life
- 🟢 **LOW** (1 story) - Nice-to-have polish

## Status

- ✅ **Documented**: All 36 stories complete with full acceptance criteria
- 🚧 **Implementation**: Test infrastructure ready, starting component tests
- 📋 **Next**: Begin TDD cycle (tests → components → integration)

## Implementation Order

### MVP (Ship First)

1. Room Setup (US-029, US-030)
2. Game Start (US-001)
3. Charleston (US-002 through US-008)
4. Core Turn Flow (US-009 through US-012)
5. Calling & Melds (US-013)
6. Winning (US-018, US-019, US-020, US-021)

### Phase 2

1. Special Actions (US-014, US-015, US-016, US-017)
2. Session Management (US-031, US-032, US-033)

### Phase 3

1. History & Undo (US-022, US-023, US-024, US-025, US-026)
2. Hints (US-027, US-028)
3. Settings (US-034, US-035, US-036)

## Related Documentation

When implementing a story, also reference:

- **Component Specs**: [../component-specs/](../component-specs/) - Which components to build
- **Test Scenarios**: [../tests/test-scenarios/](../tests/test-scenarios/) - How to test the feature
- **Fixtures**: [../../../apps/client/src/test/fixtures/](../../../apps/client/src/test/fixtures/) - Mock data for tests
- **Backend API**: See CLAUDE.md for Rust commands/events (e.g., `PassTiles` command → `TilesPassed` event)

## Example: Finding What You Need

**"I'm implementing the Charleston pass feature"**
→ Read: US-002, US-003, US-004
→ Component: `TileSelectionPanel.md`, `CharlestonTracker.md`
→ Test scenario: `charleston-standard.md`
→ Fixture: `charleston-first-right.json`

**"User reported a bug with calling priority"**
→ Read: US-012 (Call Priority Resolution)
→ Related: US-011 (Intent Buffering), US-019 (Mahjong declaration)
→ Test scenario: `calling-priority-mahjong.md`

**"What's the difference between US-014 and US-015?"**
→ US-014: Exchange **one** Joker per turn (standard rule)
→ US-015: Exchange **multiple** Jokers per turn (house rule variant)
