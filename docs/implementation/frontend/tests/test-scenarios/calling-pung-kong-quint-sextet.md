# Test Scenario: Calling Pung, Kong, Quint, and Sextet

<!-- Created by Z.AI GLM 4.7 on Feb 2, 2026 - Initial draft, pending review -->

**User Story**: US-013 - Calling Pung/Kong/Quint/Sextet
**Component Specs**: CallWindow.md, MeldConfirmationDialog.md, ExposedMeldsDisplay.md
**Fixtures**: `playing-call-window.json`, `meld-calling-sequence.json`
**Manual Test**: Manual Testing Checklist #13

## Setup (Arrange)

- **Game state**: Load `fixtures/game-states/playing-call-window.json`
- **Mock WebSocket**: Connected
- **User seated as**: West
- **Current turn**: North (just discarded a tile)
- **Player hand**: 13 tiles with various meld opportunities
- **Discard pile**: 10 tiles (North just discarded "5 Bam (4)")
- **Call window**: Open (5 seconds remaining)

## Part 1: Calling a Pung

### Step 1: Discard appears, call window opens

- North discards "5 Bam (4)"
- UI shows "5 Bam (4)" tile prominently
- CallWindow overlay appears for West (user)
- Buttons appear: "Call for Pung", "Call for Kong", "Call for Quint", "Pass"
- Timer shows 5 seconds countdown

### Step 2: User evaluates hand for Pung

- UI highlights matching tiles in user's hand:
  - User has two "5 Bams (4)" in hand
  - Tiles highlight with "can call" indicator
- "Call for Pung" button is **enabled**
- "Call for Kong" button is **disabled** (user only has two, not three)
- "Call for Quint" button is **disabled** (user only has two, not four)

### Step 3: User declares Pung intent

- User clicks "Call for Pung" button
- WebSocket sends `DeclareCallIntent` command:
  - `intent: Meld(Pung)`
  - `target_tile: 4 (5 Bam)`
- UI shows "Intent Submitted: Pung" with spinner

### Step 4: Server resolves call

- WebSocket receives `CallResolved` event:
  - `resolution: Meld(Pung, West)`
- UI shows "You won the call with Pung!" notification

### Step 5: User confirms the Pung

- WebSocket receives `CallConfirmed` event
- UI shows "Confirm Pung" dialog:
  - "You called Pung on 5 Bam (4)"
  - Shows the three tiles: [5 Bam, 5 Bam, 5 Bam]
- User clicks "Confirm" button
- WebSocket sends `ConfirmCall` command

### Step 6: Server processes the Pung

- WebSocket receives `MeldExposed` event:
  - `player: "West"`
  - `meld_type: Pung`
  - `tiles: [4, 4, 4]` (three 5 Bams)
- UI updates:
  - User's hand removes two "5 Bams (4)"
  - Exposed meld appears: [5 Bam, 5 Bam, 5 Bam]
- WebSocket receives `TurnChanged` event:
  - `player: "West"`
  - `stage: "Discarding"`

## Part 2: Calling a Kong

### Step 7: Later in game, another discard appears

- East discards "8 Crak (16)"
- CallWindow overlay appears for West (user)
- Buttons appear: "Call for Pung", "Call for Kong", "Call for Quint", "Pass"

### Step 8: User evaluates hand for Kong

- UI highlights matching tiles in user's hand:
  - User has three "8 Craks (16)" in hand
  - Tiles highlight with "can call" indicator
- "Call for Pung" button is **enabled** (can call with 3 tiles)
- "Call for Kong" button is **enabled** (can call with 3 tiles + discard)
- "Call for Quint" button is **disabled** (user only has three, not four)

### Step 9: User declares Kong intent

- User clicks "Call for Kong" button
- WebSocket sends `DeclareCallIntent` command:
  - `intent: Meld(Kong)`
  - `target_tile: 16 (8 Crak)`
- UI shows "Intent Submitted: Kong" with spinner

### Step 10: Server resolves call

- WebSocket receives `CallResolved` event:
  - `resolution: Meld(Kong, West)`
- UI shows "You won the call with Kong!" notification

### Step 11: User confirms the Kong

- WebSocket receives `CallConfirmed` event
- UI shows "Confirm Kong" dialog:
  - "You called Kong on 8 Crak (16)"
  - Shows the four tiles: [8 Crak, 8 Crak, 8 Crak, 8 Crak]
- User clicks "Confirm" button
- WebSocket sends `ConfirmCall` command

### Step 12: Server processes the Kong

- WebSocket receives `MeldExposed` event:
  - `player: "West"`
  - `meld_type: Kong`
  - `tiles: [16, 16, 16, 16]` (four 8 Craks)
- UI updates:
  - User's hand removes three "8 Craks (16)"
  - Exposed meld appears: [8 Crak, 8 Crak, 8 Crak, 8 Crak]
- WebSocket receives `TurnChanged` event:
  - `player: "West"`
  - `stage: "Discarding"`

## Part 3: Calling a Quint

### Step 13: Later in game, another discard appears

- South discards "3 Dot (19)"
- CallWindow overlay appears for West (user)
- Buttons appear: "Call for Pung", "Call for Kong", "Call for Quint", "Pass"

### Step 14: User evaluates hand for Quint

- UI highlights matching tiles in user's hand:
  - User has four "3 Dots (19)" in hand
  - Tiles highlight with "can call" indicator
- "Call for Pung" button is **enabled** (can call with 4 tiles)
- "Call for Kong" button is **enabled** (can call with 4 tiles + discard)
- "Call for Quint" button is **enabled** (can call with 4 tiles + discard)

### Step 15: User declares Quint intent

- User clicks "Call for Quint" button
- WebSocket sends `DeclareCallIntent` command:
  - `intent: Meld(Quint)`
  - `target_tile: 19 (3 Dot)`
- UI shows "Intent Submitted: Quint" with spinner

### Step 16: Server resolves call

- WebSocket receives `CallResolved` event:
  - `resolution: Meld(Quint, West)`
- UI shows "You won the call with Quint!" notification

### Step 17: User confirms the Quint

- WebSocket receives `CallConfirmed` event
- UI shows "Confirm Quint" dialog:
  - "You called Quint on 3 Dot (19)"
  - Shows the five tiles: [3 Dot, 3 Dot, 3 Dot, 3 Dot, 3 Dot]
- User clicks "Confirm" button
- WebSocket sends `ConfirmCall` command

### Step 18: Server processes the Quint

- WebSocket receives `MeldExposed` event:
  - `player: "West"`
  - `meld_type: Quint`
  - `tiles: [19, 19, 19, 19, 19]` (five 3 Dots)
- UI updates:
  - User's hand removes four "3 Dots (19)"
  - Exposed meld appears: [3 Dot, 3 Dot, 3 Dot, 3 Dot, 3 Dot]
- WebSocket receives `TurnChanged` event:
  - `player: "West"`
  - `stage: "Discarding"`

## Part 4: Calling a Sextet

### Step 19: Later in game, another discard appears

- North discards "6 Bam (5)"
- CallWindow overlay appears for West (user)
- Buttons appear: "Call for Pung", "Call for Kong", "Call for Quint", "Call for Sextet", "Pass"

### Step 20: User evaluates hand for Sextet

- UI highlights matching tiles in user's hand:
  - User has five "6 Bams (5)" in hand
  - Tiles highlight with "can call" indicator
- "Call for Pung" button is **enabled** (can call with 5 tiles)
- "Call for Kong" button is **enabled** (can call with 5 tiles + discard)
- "Call for Quint" button is **enabled** (can call with 5 tiles + discard)
- "Call for Sextet" button is **enabled** (can call with 5 tiles + discard)

### Step 21: User declares Sextet intent

- User clicks "Call for Sextet" button
- WebSocket sends `DeclareCallIntent` command:
  - `intent: Meld(Sextet)`
  - `target_tile: 5 (6 Bam)`
- UI shows "Intent Submitted: Sextet" with spinner

### Step 22: Server resolves call

- WebSocket receives `CallResolved` event:
  - `resolution: Meld(Sextet, West)`
- UI shows "You won the call with Sextet!" notification

### Step 23: User confirms the Sextet

- WebSocket receives `CallConfirmed` event
- UI shows "Confirm Sextet" dialog:
  - "You called Sextet on 6 Bam (5)"
  - Shows the six tiles: [6 Bam, 6 Bam, 6 Bam, 6 Bam, 6 Bam, 6 Bam]
- User clicks "Confirm" button
- WebSocket sends `ConfirmCall` command

### Step 24: Server processes the Sextet

- WebSocket receives `MeldExposed` event:
  - `player: "West"`
  - `meld_type: Sextet`
  - `tiles: [5, 5, 5, 5, 5, 5]` (six 6 Bams)
- UI updates:
  - User's hand removes five "6 Bams (5)"
  - Exposed meld appears: [6 Bam, 6 Bam, 6 Bam, 6 Bam, 6 Bam, 6 Bam]
- WebSocket receives `TurnChanged` event:
  - `player: "West"`
  - `stage: "Discarding"`

## Expected Outcome (Assert)

- ✅ User successfully called Pung on 5 Bam (4)
- ✅ User successfully called Kong on 8 Crak (16)
- ✅ User successfully called Quint on 3 Dot (19)
- ✅ User successfully called Sextet on 6 Bam (5)
- ✅ All melds exposed correctly on board
- ✅ Turn changed to West (caller) after each meld
- ✅ WebSocket command/event sequence correct for each call
- ✅ UI state correctly reflects Playing phase, Discarding stage

## Error Cases

### Calling with insufficient tiles

- **When**: User clicks "Call for Kong" but only has two matching tiles
- **Expected**: "Call for Kong" button disabled (client-side validation)
- **Assert**: Button's `disabled` state reflects `matchingTiles.length < 3`

### Server rejects call (invalid meld)

- **When**: User declares Pung but doesn't actually have two matching tiles
- **Expected**: Server validates and rejects via `CallRejected` event
- **Assert**:
  - WebSocket receives `CallRejected` event:
    - `reason: "Invalid meld - insufficient matching tiles"`
  - UI shows error: "Invalid call - you don't have enough matching tiles"

### Calling on wrong tile

- **When**: User's hand has three "5 Bams (4)" but North discarded "6 Bam (5)"
- **Expected**: "Call for Pung" button disabled (client-side hinting only)
- **Assert**: Button's `disabled` state reflects `canCallWithTile(discardedTile) === false`

### Multiple players call same meld

- **When**: Both West (user) and East declare Pung on same discard
- **Expected**: Turn order priority: closest player clockwise wins
- **Assert**:
  - Server resolves to East (if East is closer to North than West)
  - User receives `CallResolved` with `winner: "East"`
  - UI shows "East won the call with Pung, turn order priority"

### Timer expires before user acts

- **When**: User doesn't click any button within 5 seconds
- **Expected**: Call window auto-closes, defaults to "Pass"
- **Assert**:
  - Server receives no `DeclareCallIntent` from user
  - Call resolves to "NoAction"
  - UI shows "Call window closed" notification

### Calling Sextet when Quint is available

- **When**: User has five matching tiles and can call either Quint or Sextet
- **Expected**: Both buttons enabled, user can choose
- **Assert**:
  - "Call for Quint" button enabled
  - "Call for Sextet" button enabled
  - User's choice determines which meld is exposed

## Meld Calling Priority Matrix

| Meld Type | Tiles Required | Scoring Value | Button Enabled When |
|-----------|----------------|---------------|---------------------|
| Pung      | 2 in hand + 1 discard | Low | `matchingTiles.length >= 2` |
| Kong      | 3 in hand + 1 discard | Medium | `matchingTiles.length >= 3` |
| Quint     | 4 in hand + 1 discard | High | `matchingTiles.length >= 4` |
| Sextet    | 5 in hand + 1 discard | Very High | `matchingTiles.length >= 5` |

## Cross-References

### Related Scenarios

- `calling-priority-mahjong.md` - Mahjong beats all melds
- `calling-priority-turn-order.md` - Turn order breaks ties
- `call-window-intent-buffering.md` - Intent buffering mechanism
- `meld-upgrade.md` - Upgrading Pung → Kong → Quint

### Related Components

- [CallWindow](../../component-specs/game/CallWindow.md)
- [MeldConfirmationDialog](../../component-specs/game/MeldConfirmationDialog.md)
- [ExposedMeldsDisplay](../../component-specs/game/ExposedMeldsDisplay.md)
- [ActionBar](../../component-specs/game/ActionBar.md)

### Backend References

- Commands: `mahjong_core::command::DeclareCallIntent`, `ConfirmCall`
- Events: `mahjong_core::event::CallResolved`, `CallConfirmed`, `CallRejected`, `MeldExposed`, `TurnChanged`
- Logic: `mahjong_core::call_resolution::resolve_calls()`
- Validation: `mahjong_core::rules::meld::validate_meld_call()`

### Accessibility Notes

- Call window announced: "5 Bam (4) discarded by North, call window open, 5 seconds"
- Button options announced: "Call for Pung available, Press P. Call for Kong unavailable. Call for Quint unavailable. Pass, Press Escape."
- Intent submission announced: "Intent submitted: Pung"
- Resolution announced: "You won the call with Pung!" or "East won the call with Pung, turn order priority"
- Confirmation dialog announced: "Confirm Pung on 5 Bam (4). Press Enter to confirm, Escape to cancel."
- Meld exposed announced: "Pung exposed: 5 Bamboo, 5 Bamboo, 5 Bamboo"
- Timer countdown announced at 3s, 1s
