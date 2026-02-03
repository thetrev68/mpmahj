# Haiku Instructions: Test Scenario Cleanup - COMPLETE ✅

**Task**: Trim and fix test scenario files to be concise and TDD-focused
**Estimated Time**: 2.5 hours
**Files to Process**: 21 files (see lists below)

---

## Phase 2: Fix Event Names (3 files, 30 minutes)

### File 1: `request-hints-ai-analysis.md`

**Find and Replace Operations**:

1. Replace ALL occurrences:
   - `HintProvided` → `HintUpdate`
   - `HintError` → `AnalysisError`

2. Delete these entire sections:
   - Section starting with `## Hint Analysis Features` (lines ~169-202)
   - Section starting with `### Analysis Components` through end of table
   - Section starting with `### Defensive Safety Levels` through end of table
   - Section starting with `### Pattern Recognition` through end of list
   - Section starting with `## Cross-References` to end of file
   - Section starting with `### Accessibility Notes` to end

3. Remove all UI detail steps that mention:
   - "clicks", "slides in", "appears", "shows spinner"
   - Dialog descriptions ("Header: X", "Buttons: Y, Z")
   - Keep only: Command sent, Event received, Data assertions

4. Trim from ~236 lines → target 100 lines

**After trimming, the file should have this structure**:

```markdown
# Test Scenario: Request Hints (AI Analysis)

**User Story**: US-027 - Request Hints (AI Analysis)
**Fixtures**: `playing-drawing.json`, `hint-analysis-sequence.json`

## Setup (Arrange)
[Keep setup section as-is]

## Test Flow (Act & Assert)

1. User requests hint
2. Send: RequestHint { player: East, verbosity: Medium }
3. Receive: HintUpdate event with analysis data
4. Assert: Analysis contains recommended discard and confidence level

## Error Cases
[Keep 2-3 most important error cases, remove verbose descriptions]

## Success Criteria
[Keep success criteria list]
```

---

### File 2: `adjust-hint-verbosity.md`

**Find and Replace Operations**:

1. Delete ALL references to:
   - "Settings panel"
   - "UpdateSettings" command
   - "SettingsUpdated" event
   - "Game section", "Hints section", "Animations section"

2. Keep ONLY these sections:
   - Setup
   - Steps related to `SetHintVerbosity` command
   - Steps showing how verbosity affects hint responses
   - Success criteria

3. Remove all UI navigation steps:
   - "User clicks Settings button"
   - "Settings panel slides in"
   - "User navigates to Hints section"

**The file should focus ONLY on**:

```markdown
## Test Flow

1. Initial hint request with default verbosity (Medium)
2. Send: SetHintVerbosity { player: East, verbosity: Expert }
3. Request hint again
4. Assert: Hint contains more detailed analysis than before
```

Target: ~60 lines

---

### File 3: `wall-game.md`

**Instructions**:

1. Verify the event structure: Wall exhaustion should trigger `GameOver` event with outcome, NOT a standalone `WallExhausted` event

2. Update assertions to expect:

   ```markdown
   Receive: GameOver event with outcome = WallExhausted
   ```

   NOT:

   ```markdown
   Receive: WallExhausted event
   ```

3. Remove UI detail sections (same pattern as other files)

4. Target: ~70 lines

---

## Phase 3: Trim Files (18 files, ~2 hours)

### Standard Trimming Pattern (Apply to ALL 18 files)

For each file in the lists below, follow these steps:

#### Step 1: Delete These Entire Sections

Find and delete from start marker to end marker:

1. **"Step 1: Verify" section** (usually lines 20-30):

   ```
   ### Step 1: Verify [whatever] state
   [all content until next ### Step heading]
   ```

2. **Cross-References section** (usually near end):

   ```
   ## Cross-References
   [all content until next ## heading or end of file]
   ```

3. **Backend References section**:

   ```
   ### Backend References
   [all content until next section]
   ```

4. **Accessibility Notes section**:

   ```
   ### Accessibility Notes
   [all content until end of file or next section]
   ```

5. **Related Components section**:

   ```
   ### Related Components
   [all content until next section]
   ```

6. **Related Scenarios section**:

   ```
   ### Related Scenarios
   [all content until next section]
   ```

#### Step 2: Condense UI Detail Steps

Transform verbose UI descriptions into concise behavioral descriptions:

**BEFORE** (Delete this style):

```markdown
### Step 3: User selects tiles for pass

- User clicks on tile at index 2 (e.g., "4 Dot (21)")
  - Tile highlights with selection border
  - Counter updates to "1/3 tiles selected"
- User clicks on tile at index 8 (e.g., "North Wind (28)")
  - Second tile highlights
  - Counter updates to "2/3 tiles selected"
- User clicks on tile at index 11 (e.g., "8 Crak (16)")
  - Third tile highlights
  - Counter updates to "3/3 tiles selected"
  - "Pass Tiles" button becomes enabled
```

**AFTER** (Keep this style):

```markdown
### Step 3: User selects 3 tiles for pass

- User selects tiles: [tileAt2, tileAt8, tileAt11]
- Send: PassTiles { player: East, tiles: [tileAt2, tileAt8, tileAt11], stage: FirstAcross }
```

#### Step 3: Remove UI State Descriptions

Delete any lines describing:

- Button states ("enabled", "disabled", "shows spinner")
- Dialog animations ("slides in", "fades out", "appears")
- Color/styling ("highlights with border", "shows green checkmark")
- Screen transitions ("navigates to", "returns to")
- Timers/countdowns (unless testing timer functionality)

**Exception**: Keep UI state descriptions ONLY if they're assertions in test criteria

#### Step 4: Condense Error Cases

**BEFORE** (verbose):

```markdown
### Attempting to pass Jokers

- **When**: User selects a Joker tile
- **Expected**: Tile shows error border, tooltip "Jokers cannot be passed", cannot be selected
- **Assert**: Joker tiles have `disabled` attribute in Charleston phases

[Followed by 5 more paragraphs about UI behavior]
```

**AFTER** (concise):

```markdown
### Error: Passing Jokers
- Send: PassTiles with Joker in tiles array
- Expected: CommandError::ContainsJokers
- Assert: Hand unchanged, tiles not passed
```

#### Step 5: Keep Only Essential Content

**Always KEEP**:

- Setup section
- Command → Event sequences
- Data assertions (tile counts, game state, player hands)
- Critical error cases (2-3 max)
- Success criteria list

**Always DELETE**:

- Manual test references ("Manual Testing Checklist #XX")
- "You can share room ID with friends" type instructions
- Table legends and documentation
- Code block examples (unless testing command structure)

#### Step 6: Target Line Count

After trimming, each file should be:

- **Minimum**: 50 lines
- **Target**: 60-80 lines
- **Maximum**: 100 lines

If over 100 lines, cut more aggressively.

---

## Files to Process (18 files)

### Group 1: Charleston Files (5 files)

Apply standard trimming pattern:

1. `charleston-first-across.md` (154 lines → target 65)
2. `charleston-second-charleston.md` (~180 lines → target 70)
3. `charleston-blind-pass.md` (trim to ~60)
4. `charleston-standard.md` (trim to ~60)
5. `charleston-voting.md` (trim to ~55)

**Charleston-specific note**: Keep the stage progression (FirstRight → FirstAcross → FirstLeft) but remove all "Charleston tracker shows" UI descriptions.

---

### Group 2: Calling & Melds (3 files)

Apply standard trimming pattern:

1. `calling-pung-kong-quint-sextet.md` (~190 lines → target 75)
2. `call-window-intent-buffering.md` (~170 lines → target 65)
3. `meld-upgrade.md` ⭐ **SKIP THIS FILE** - Already good at ~100 lines, use as reference

**Calling-specific note**: Focus on DeclareCallIntent command and CallResolved event, remove all "call window timer" UI descriptions.

---

### Group 3: Mahjong & Dead Hand (3 files)

Apply standard trimming pattern:

1. `mahjong-self-draw.md` (~160 lines → target 65)
2. `mahjong-called.md` (~150 lines → target 60)
3. `dead-hand-tile-count.md` (~170 lines → target 65)

**Mahjong-specific note**: Keep the DeclareMahjong command and HandDeclaredDead event, remove hand visualization descriptions.

---

### Group 4: Joker Exchange (2 files)

Apply standard trimming pattern:

1. `joker-exchange-single.md` (~140 lines → target 55)
2. `joker-exchange-multiple.md` (~160 lines → target 65)

**Joker-specific note**: Keep ExchangeJoker command structure with target_seat and meld_index, remove UI "exchange animation" descriptions.

---

### Group 5: Game Management (3 files)

Apply standard trimming pattern:

1. `leave-game.md` (~150 lines → target 60)
2. `forfeit-game.md` (~160 lines → target 65)
3. `disconnect-reconnect.md` (~200 lines → target 80)

**Management-specific note**: Keep LeaveGame and ForfeitGame commands, remove "confirmation dialog" UI descriptions.

---

### Group 6: History & Undo (4 files)

Apply standard trimming pattern:

1. `view-move-history.md` (~170 lines → target 65)
2. `history-jump.md` (trim to ~60)
3. `undo-solo.md` (trim to ~55)
4. `undo-voting.md` (trim to ~60)

**History-specific note**: Keep RequestHistory, JumpToMove, SmartUndo commands, remove "history panel" UI descriptions.

---

### Group 7: Setup & Gameplay (2 files)

Apply standard trimming pattern:

1. `roll-dice-break-wall.md` (166 lines → target 65)
2. `drawing-discarding.md` (~140 lines → target 55)

---

## Phase 4: Verify Commands (30 minutes)

After trimming all files, run this verification:

### Step 1: Extract all command references

```bash
cd docs/implementation/frontend/tests/test-scenarios
grep -oh "GameCommand::\w\+" *.md | sort -u > /tmp/used_commands.txt
```

### Step 2: Check against actual backend

For each command in `/tmp/used_commands.txt`, verify it exists in:
`crates/mahjong_core/src/command.rs`

### Step 3: Report any mismatches

If you find commands that DON'T exist in the backend, report them:

```markdown
## Verification Report

Commands used in tests but NOT found in backend:
- GameCommand::SomeCommand (in file: xyz.md)
- GameCommand::AnotherCommand (in file: abc.md)
```

---

## Quality Checklist (Run After Each File)

After trimming each file, verify:

- [ ] File is 50-100 lines (check line count)
- [ ] No "Cross-References" section remains
- [ ] No "Accessibility Notes" section remains
- [ ] No "Backend References" section remains
- [ ] No "Step 1: Verify UI state" section remains
- [ ] No lines with "slides in", "appears", "shows spinner"
- [ ] Commands use actual GameCommand enum variants
- [ ] Events use actual event names (not hallucinated)
- [ ] Success criteria section still present
- [ ] At least 2 error cases remain

---

## Example: Before vs After

### BEFORE (charleston-first-across.md - 154 lines)

```markdown
# Test Scenario: Charleston First Across Pass

<!-- Created by Z.AI GLM 4.7 on Feb 2, 2026 - Initial draft, pending review -->

**User Story**: US-003 - Charleston First Across
**Component Specs**: TileSelectionPanel.md, CharlestonTracker.md, ConcealedHand.md
**Fixtures**: `charleston-first-across.json`, `charleston-pass-sequence.json`
**Manual Test**: Manual Testing Checklist #3

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/charleston-first-across.json`
- **Mock WebSocket**: Connected (online mode)
- **User seated as**: East (dealer position)
- **Player hand**: 13 tiles loaded from fixture (after First Right pass completed)
- **Charleston stage**: FirstAcross
- **Time remaining**: 45 seconds (default timer)
- **Previous passes**: First Right completed (user passed 3 tiles right, received 3 from left)

## Steps (Act)

### Step 1: Verify Charleston UI is displayed for First Across

- User sees "Charleston: First Across" header
- User sees their 13 concealed tiles (updated from First Right pass)
- User sees "Pass Tiles" button (disabled initially)
- User sees "0/3 tiles selected" counter
- User sees countdown timer
- Charleston tracker shows progress: [✓ First Right] → [→ First Across] → [First Left] → [Second Charleston]

### Step 2: User selects 3 tiles for across pass

- User clicks on tile at index 2 (e.g., "4 Dot (21)")
  - Tile highlights with selection border
  - Counter updates to "1/3 tiles selected"
- User clicks on tile at index 8 (e.g., "North Wind (28)")
  - Second tile highlights
  - Counter updates to "2/3 tiles selected"
- User clicks on tile at index 11 (e.g., "8 Crak (16)")
  - Third tile highlights
  - Counter updates to "3/3 tiles selected"
  - "Pass Tiles" button becomes enabled

### Step 3: User submits across pass

- User clicks "Pass Tiles" button
- WebSocket sends `PassTiles` command with:
  - `stage: "FirstAcross"`
  - `tiles: [tileAt2, tileAt8, tileAt11]`
- UI shows "Waiting for other players..." spinner
- Selection UI becomes disabled

[... 100 more lines of UI detail, cross-references, accessibility notes ...]
```

### AFTER (charleston-first-across.md - 65 lines)

```markdown
# Test Scenario: Charleston First Across Pass

**User Story**: US-003 - Charleston First Across
**Fixtures**: `charleston-first-across.json`

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/charleston-first-across.json`
- **Player**: East (dealer)
- **Hand**: 13 tiles (after First Right pass completed)
- **Charleston stage**: FirstAcross

## Test Flow (Act & Assert)

### Happy Path

1. **Given**: Player has 13 tiles, Charleston stage is FirstAcross
2. **When**: User selects 3 tiles to pass across (to West)
3. **Send**: `PassTiles { player: East, tiles: [tileAt2, tileAt8, tileAt11], stage: FirstAcross }`
4. **Receive**: `TilesPassed { player: East, tiles: [tileAt2, tileAt8, tileAt11] }`
5. **Assert**:
   - Hand has 10 tiles (13 - 3)
   - Tiles [tileAt2, tileAt8, tileAt11] removed from hand

6. **Receive**: `TilesReceived { player: East, tiles: [newTile1, newTile2, newTile3] }`
7. **Assert**:
   - Hand has 13 tiles again (10 + 3)
   - New tiles added to hand

8. **Receive**: `CharlestonPhaseChanged { stage: FirstLeft }`
9. **Assert**: Charleston stage advanced to FirstLeft

### Error Cases

#### Error: Passing Jokers
- **Send**: PassTiles with Joker in tiles array
- **Expected**: CommandError::ContainsJokers
- **Assert**: Hand unchanged, stage unchanged

#### Error: Wrong tile count
- **Send**: PassTiles with 2 tiles
- **Expected**: CommandError::InvalidPassCount
- **Assert**: Hand unchanged

#### Error: Timer expiry
- **When**: No PassTiles sent within charleston_timer_seconds
- **Expected**: Server auto-selects 3 random non-Joker tiles
- **Receive**: TilesPassed event without user action
- **Assert**: 3 tiles automatically removed from hand

## Success Criteria

- ✅ User passed 3 tiles across (to West)
- ✅ User received 3 tiles from across (from West)
- ✅ Hand maintains 13 tiles total
- ✅ Charleston advanced to FirstLeft stage
- ✅ No Jokers were passed (validation worked)
```

---

## Files to SKIP (Do Not Process)

These files need Sonnet-level judgment:

1. `calling-priority-mahjong.md` - Complex call priority logic
2. `timer-expiry.md` - Multiple timeout scenarios
3. `mahjong-invalid.md` - Already reviewed and trimmed
4. `coverage-matrix.md` - Reference document, don't modify

---

## Completion Report Template

After finishing all files, create a summary:

```markdown
## Haiku Trimming Report

**Files Processed**: 21 files
**Time Taken**: [X hours]

### Phase 2 Results (Event Name Fixes)
- ✅ request-hints-ai-analysis.md - HintProvided → HintUpdate (236 → 98 lines)
- ✅ adjust-hint-verbosity.md - Removed settings references (180 → 62 lines)
- ✅ wall-game.md - Fixed event structure (150 → 71 lines)

### Phase 3 Results (Trimming)

#### Group 1: Charleston Files
- ✅ charleston-first-across.md (154 → 65 lines)
- ✅ charleston-second-charleston.md (181 → 68 lines)
- ✅ charleston-blind-pass.md (XXX → XX lines)
- ✅ charleston-standard.md (XXX → XX lines)
- ✅ charleston-voting.md (XXX → XX lines)

[Continue for all groups...]

### Phase 4 Results (Verification)
- ✅ Extracted command references
- ✅ Verified against backend
- ❌ Found mismatches: [list any issues]

### Total Reduction
- **Before**: X,XXX lines total
- **After**: X,XXX lines total
- **Reduction**: XX%
```

---

## Ready to Execute?

1. Start with Phase 2 (3 files, 30 min)
2. Then do Phase 3 Group 1 (Charleston files)
3. Continue through all groups
4. End with Phase 4 verification
5. Generate completion report

**Estimated total time**: 2.5 hours

Good luck! 🚀
