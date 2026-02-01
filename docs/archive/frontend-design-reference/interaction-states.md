# Component Interaction States

This document defines the behavior, appearance, and accessibility requirements for each interactive component across all possible states. Use this as a reference when implementing components to ensure consistency.

---

## State Notation

Each component is documented with:

- **Visual**: How it looks (CSS, layout)

- **Interactive**: Can it be clicked/tapped?

- **Keyboard**: Keyboard navigation behavior

- **Screen Reader**: ARIA labels and announcements

- **Transitions**: Animation between states

---

## 1. Tile Component

The most critical component in the game. Must handle 8+ distinct states.

### 1.1 Default (Idle)

**Context**: Tile in player's hand, no interaction yet.

| Aspect            | Specification                                                                                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Visual**        | - Background: White with suit-colored border (Bam=green, Crak=red, Dot=blue)<br>- Shadow: `0 2px 4px rgba(0,0,0,0.1)`<br>- Text: Black, centered<br>- Size: 48×64px (mobile), 64×80px (desktop) |
| **Interactive**   | ✅ Yes - Clickable                                                                                                                                                                              |
| **Cursor**        | `pointer`                                                                                                                                                                                       |
| **Keyboard**      | Focusable with `Tab`, activate with `Space` or `Enter`                                                                                                                                          |
| **Screen Reader** | `role="button"`, `aria-label="3 Bamboo"`                                                                                                                                                        |
| **Touch**         | 44×44pt minimum touch target (expand hitbox with `::before` pseudo-element)                                                                                                                     |
| **Performance**   | No animations at rest (static)                                                                                                                                                                  |

---

### 1.2 Hover (Desktop Only)

**Context**: Mouse over tile.

| Aspect            | Specification                                                                                                                               |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Visual**        | - Lift: `translateY(-4px)`<br>- Shadow: `0 4px 8px rgba(0,0,0,0.2)` (stronger)<br>- Scale: `1.05` (subtle grow)<br>- Border: Thicken to 3px |
| **Interactive**   | ✅ Yes                                                                                                                                      |
| **Cursor**        | `pointer`                                                                                                                                   |
| **Transition**    | `transform 150ms ease-out, box-shadow 150ms ease-out`                                                                                       |
| **Screen Reader** | No change (hover is visual only)                                                                                                            |

**Implementation**:

```css
.tile:hover {
  transform: translateY(-4px) scale(1.05);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
  border-width: 3px;
}
```text

text

text

text

text

text

---

### 1.3 Selected (Charleston / Discard Selection)

**Context**: Tile selected for Charleston pass or discard.

| Aspect            | Specification                                                                                                                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Visual**        | - Lift: `translateY(-16px)` (significant raise)<br>- Border: 4px solid blue (`--color-primary`)<br>- Glow: `0 0 12px rgba(37, 99, 235, 0.6)`<br>- Checkmark overlay: ✓ icon in top-right corner |
| **Interactive**   | ✅ Yes - Click again to deselect                                                                                                                                                                |
| **Cursor**        | `pointer`                                                                                                                                                                                       |
| **Keyboard**      | `Space` toggles selection                                                                                                                                                                       |
| **Screen Reader** | `aria-pressed="true"`, announce "3 Bamboo, selected"                                                                                                                                            |
| **Transition**    | `transform 200ms cubic-bezier(0.68, -0.55, 0.265, 1.55)` (bounce effect)                                                                                                                        |
| **Animation**     | Checkmark fades in (100ms)                                                                                                                                                                      |

**Multi-Selection (Charleston)**:

- Show counter badge: "2/3 selected"

- Disable selection if 3 already selected (except when deselecting)

---

### 1.4 Disabled (Non-Interactive)

**Context**: Joker during Charleston (cannot be passed), or tile in opponent's hand.

| Aspect            | Specification                                                                                                                  |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| **Visual**        | - Grayscale filter: `filter: grayscale(100%)`<br>- Opacity: `0.5`<br>- Strikethrough or "X" overlay (for Jokers in Charleston) |
| **Interactive**   | ❌ No                                                                                                                          |
| **Cursor**        | `not-allowed`                                                                                                                  |
| **Keyboard**      | Not focusable (`tabindex="-1"`)                                                                                                |
| **Screen Reader** | `aria-disabled="true"`, `aria-label="Joker, cannot be passed"`                                                                 |
| **Tooltip**       | On hover: "Jokers cannot be passed during Charleston"                                                                          |

**Variants**:

- **Joker in Charleston**: Red "X" overlay with tooltip

- **Dead tile** (all 4 discarded): Grayed out with strikethrough

---

### 1.5 Concealed (Opponent Tile)

**Context**: Tile in opponent's hand (hidden from player).

| Aspect              | Specification                                                                                                                |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| **Visual**          | - Back face: Solid color (e.g., teal pattern)<br>- 3D effect: Slight bevel to indicate "face down"<br>- No suit/rank visible |
| **Interactive**     | ❌ No                                                                                                                        |
| **Cursor**          | `default`                                                                                                                    |
| **Keyboard**        | Not focusable                                                                                                                |
| **Screen Reader**   | `aria-label="Concealed tile"` (don't announce suit/rank)                                                                     |
| **Count Indicator** | Show "13 concealed" label near opponent's area                                                                               |

---

### 1.6 Exposed (In Meld)

**Context**: Tile in exposed Pung, Kong, or Quint after calling.

| Aspect            | Specification                                                                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Visual**        | - Horizontal layout (rotated 90°)<br>- Grouped with other meld tiles<br>- Border: Gray (inactive)<br>- Background: Slightly darker (to differentiate from hand) |
| **Interactive**   | ❌ No (once exposed, cannot be moved)                                                                                                                           |
| **Cursor**        | `default`                                                                                                                                                       |
| **Keyboard**      | Not focusable                                                                                                                                                   |
| **Screen Reader** | `aria-label="7 Dot, in exposed Pung"`                                                                                                                           |
| **Grouping**      | Melds are wrapped in container: `<div class="meld" role="group" aria-label="Pung of 7 Dot">`                                                                    |

**Layout**:

```text
┌─────┐
│ 7 D │ (Horizontal orientation)
└─────┘
┌─────┐
│ 7 D │
└─────┘
┌─────┐
│ 7 D │
└─────┘

```text

text

text

text

text

text

---

### 1.7 Highlighted (Hint / Pattern Match)

**Context**: AI hint system highlights tiles that match a pattern.

| Aspect            | Specification                                                                                                             |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Visual**        | - Pulsing glow: `0 0 16px rgba(16, 185, 129, 0.8)` (green)<br>- Border: 3px solid green<br>- Pulse animation: 1s infinite |
| **Interactive**   | ✅ Yes                                                                                                                    |
| **Cursor**        | `pointer`                                                                                                                 |
| **Screen Reader** | `aria-describedby="hint-tooltip"`, announce "3 Bamboo, suggested for pattern 2468 Consecutive"                            |
| **Animation**     | Pulse between 1.0 and 1.1 scale                                                                                           |

**Implementation**:

```css
@keyframes pulse {
  0%,
  100% {
    transform: scale(1);
  }
  50% {
    transform: scale(1.1);
  }
}

.tile.highlighted {
  animation: pulse 1s ease-in-out infinite;
  box-shadow: 0 0 16px rgba(16, 185, 129, 0.8);
}
```text

text

text

text

text

text

---

### 1.8 Discarded (In Discard Pile)

**Context**: Tile has been discarded to center pile.

| Aspect            | Specification                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Visual**        | - Flat (no shadow, no depth)<br>- Slightly smaller: 80% scale<br>- Chronological order (newest on top/right)<br>- Background: Transparent or light gray |
| **Interactive**   | ❌ No (unless call window is open)                                                                                                                      |
| **Cursor**        | `default` (or `pointer` during call window)                                                                                                             |
| **Keyboard**      | Not focusable                                                                                                                                           |
| **Screen Reader** | `aria-label="5 Dot, discarded by East"`                                                                                                                 |
| **Layout**        | Grid or flex row, max 6 per row, wrap                                                                                                                   |

**Call Window Variant**:

- **Callable tile** (last discard): Glow effect, cursor changes to `pointer`

- **Screen reader**: "5 Dot, discarded by East. Press C to call, Escape to pass."

---

### 1.9 Dead Tile (All 4 Out)

**Context**: All 4 copies of a tile have been discarded or exposed.

| Aspect            | Specification                                                                                                                         |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Visual**        | - Grayscale: `filter: grayscale(100%)`<br>- Opacity: `0.6`<br>- Red strikethrough diagonal line<br>- Tooltip: "Dead tile (all 4 out)" |
| **Interactive**   | ❌ No                                                                                                                                 |
| **Cursor**        | `default`                                                                                                                             |
| **Screen Reader** | `aria-label="2 Bamboo, dead tile, all 4 have been played"`                                                                            |

**Context**: This state only appears in The Card viewer, to show which patterns are no longer achievable.

---

### 1.10 Animated (Drawing / Discarding)

**Context**: Tile is animating from wall to hand, or hand to discard pile.

| Aspect            | Specification                                                                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Visual**        | - Moves along curved path (Bezier curve)<br>- Rotate slightly (5-10°) during flight<br>- Scale: Start at 1.0, shrink to 0.9 at midpoint, grow back to 1.0 |
| **Interactive**   | ❌ No (during animation)                                                                                                                                  |
| **Duration**      | 500ms (discard), 300ms (draw)                                                                                                                             |
| **Easing**        | `cubic-bezier(0.4, 0, 0.2, 1)` (ease-out)                                                                                                                 |
| **Screen Reader** | Announce start and end: "Drawing tile... 3 Bamboo drawn."                                                                                                 |

**Performance**:

- Use `transform` and `opacity` only (GPU-accelerated)

- Avoid `left`/`top` (causes reflow)

---

### Tile State Transition Matrix

| From → To           | Trigger            | Animation          | Duration |
| ------------------- | ------------------ | ------------------ | -------- |
| Default → Hover     | Mouse enter        | Lift + shadow      | 150ms    |
| Hover → Default     | Mouse leave        | Lower + shadow     | 150ms    |
| Default → Selected  | Click/Space        | Bounce lift        | 200ms    |
| Selected → Default  | Click/Space again  | Drop               | 200ms    |
| Default → Disabled  | Game state change  | Fade to grayscale  | 300ms    |
| Concealed → Default | Charleston receive | Flip animation     | 400ms    |
| Default → Exposed   | Call accepted      | Slide to meld area | 400ms    |
| Default → Discarded | Discard action     | Arc path           | 500ms    |

---

## 2. Button Component

### 2.1 Primary Button (e.g., "Discard", "Confirm Pass")

| State                | Visual                                              | Interactive                  | Screen Reader                                |
| -------------------- | --------------------------------------------------- | ---------------------------- | -------------------------------------------- |
| **Idle**             | Solid blue (`--color-primary`), white text, shadow  | ✅ Yes                       | `role="button"`, `aria-label="Discard tile"` |
| **Hover**            | Darken to `--color-primary-hover`, shadow grows     | ✅ Yes                       | No change                                    |
| **Active** (pressed) | Scale(0.95), inset shadow                           | ✅ Yes                       | No change                                    |
| **Disabled**         | Gray background, opacity 0.5, `cursor: not-allowed` | ❌ No                        | `aria-disabled="true"`                       |
| **Loading**          | Spinner icon, text "Processing...", cursor: `wait`  | ❌ No (prevent double-click) | Announce "Loading..."                        |

**Transitions**:

```css
.button-primary {
  background: var(--color-primary);
  transition:
    background 150ms,
    box-shadow 150ms,
    transform 100ms;
}

.button-primary:hover {
  background: var(--color-primary-hover);
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
}

.button-primary:active {
  transform: scale(0.95);
  box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.2);
}

.button-primary:disabled {
  background: var(--color-text-disabled);
  cursor: not-allowed;
  opacity: 0.5;
}
```text

text

text

text

text

text

---

### 2.2 Secondary Button (e.g., "Sort", "Cancel")

| State        | Visual                                           | Interactive | Screen Reader          |
| ------------ | ------------------------------------------------ | ----------- | ---------------------- |
| **Idle**     | Outline blue, transparent bg, blue text          | ✅ Yes      | `role="button"`        |
| **Hover**    | Background: light blue (`--color-primary-light`) | ✅ Yes      | No change              |
| **Active**   | Background: medium blue                          | ✅ Yes      | No change              |
| **Disabled** | Gray outline, gray text, opacity 0.5             | ❌ No       | `aria-disabled="true"` |

---

### 2.3 Danger Button (e.g., "Leave Game", "Forfeit")

| State      | Visual                                  | Interactive | Screen Reader                                           |
| ---------- | --------------------------------------- | ----------- | ------------------------------------------------------- |
| **Idle**   | Solid red (`--color-error`), white text | ✅ Yes      | `aria-label="Leave game, this action cannot be undone"` |
| **Hover**  | Darken red, shadow                      | ✅ Yes      | No change                                               |
| **Active** | Scale(0.95)                             | ✅ Yes      | No change                                               |

**Special Behavior**: Require confirmation modal before executing destructive actions.

```text

Click "Leave Game" → Show modal:

┌────────────────────────────────────┐
│ ⚠️ Leave Game?                     │
├────────────────────────────────────┤
│ Are you sure? You will forfeit.    │
│                                    │
│ [Cancel] [Yes, Leave]              │
└────────────────────────────────────┘

```text

text

text

text

text

text

---

### 2.4 Icon Button (e.g., Settings Gear, Close X)

| State                | Visual                                           | Interactive | Screen Reader                                             |
| -------------------- | ------------------------------------------------ | ----------- | --------------------------------------------------------- |
| **Idle**             | Icon only, circular background (transparent)     | ✅ Yes      | `aria-label="Open settings"` (text alternative required!) |
| **Hover**            | Background: light gray (`--color-surface-hover`) | ✅ Yes      | No change                                                 |
| **Active**           | Background: medium gray                          | ✅ Yes      | No change                                                 |
| **Focus** (keyboard) | Blue focus ring, 2px solid                       | ✅ Yes      | No change                                                 |

**Accessibility Requirement**: Icon-only buttons MUST have `aria-label`.

---

## 3. Modal / Dialog Component

### 3.1 Call Window Modal

**Context**: Time-sensitive decision during discard.

| Aspect            | Specification                                                                                                                                            |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Visual**        | - Centered overlay<br>- Backdrop: `rgba(0, 0, 0, 0.5)` blur<br>- Card: White, rounded corners, shadow<br>- Timer: Progress bar at top (shrinks over 10s) |
| **Interactive**   | ✅ Buttons inside modal, backdrop NOT clickable (prevent accidental dismiss)                                                                             |
| **Keyboard**      | `Esc` closes (counts as "Pass"), `C` for Call, `P` for Pass                                                                                              |
| **Screen Reader** | `role="dialog"`, `aria-modal="true"`, `aria-labelledby="call-window-title"`, announce "Call window opened. 10 seconds remaining."                        |
| **Auto-Close**    | After 10s, auto-dismisses and announces "Call window closed. Passed."                                                                                    |
| **Animation**     | Fade in + scale from 0.95 to 1.0 (200ms)                                                                                                                 |

**Layout**:

```html
<div role="dialog" aria-modal="true" aria-labelledby="call-title">
  <div
    class="timer-bar"
    role="progressbar"
    aria-valuenow="10"
    aria-valuemin="0"
    aria-valuemax="10"
  ></div>
  <h2 id="call-title">Call Window (10s)</h2>
  <p>East discarded: <Tile>7D</Tile></p>
  <div role="group" aria-label="Call options">
    <button>Pung</button>
    <button>Kong</button>
    <button>Pass</button>
  </div>
</div>
```text

text

text

text

text

text

---

### 3.2 Reconnection Modal

**Context**: Network disconnection.

| Aspect            | Specification                                                                                             |
| ----------------- | --------------------------------------------------------------------------------------------------------- |
| **Visual**        | Same styling as Call Window, but with spinner icon                                                        |
| **Interactive**   | [Retry] and [Cancel] buttons only                                                                         |
| **Keyboard**      | `Esc` closes modal and returns to lobby                                                                   |
| **Screen Reader** | Announce "Connection lost. Attempting to reconnect. Attempt 1 of 3." Live region updates with each retry. |
| **Auto-Retry**    | Retry automatically (don't require user to click Retry)                                                   |

---

### 3.3 Confirmation Modal (Destructive Actions)

**Context**: "Are you sure?" prompts for leaving game, forfeiting, etc.

| Aspect            | Specification                                                             |
| ----------------- | ------------------------------------------------------------------------- |
| **Visual**        | Warning icon, red accent color                                            |
| **Interactive**   | ✅ Two buttons: [Cancel] (primary) and [Confirm] (danger)                 |
| **Keyboard**      | `Esc` cancels, `Enter` does NOT confirm (prevent accidental confirmation) |
| **Screen Reader** | `role="alertdialog"`, `aria-describedby="warning-message"`                |
| **Button Order**  | Safest action on left (Cancel), destructive on right (Confirm)            |

**UX Principle**: Destructive action should require extra effort (prevent accidents).

---

## 4. Hand Container Component

### 4.1 Desktop Layout

| Aspect            | Specification                                                                        |
| ----------------- | ------------------------------------------------------------------------------------ |
| **Visual**        | Horizontal row, all 13 tiles visible, sorted by suit                                 |
| **Overflow**      | None (all tiles fit on screen at 1024px+ width)                                      |
| **Sorting**       | Auto-sort button triggers smooth shuffle animation (tiles swap positions over 400ms) |
| **Selection**     | Shift+Click for range select (Charleston)                                            |
| **Keyboard**      | Arrow keys navigate between tiles, Space selects                                     |
| **Screen Reader** | `role="list"`, each tile is `role="listitem"`, announce "Your hand: 13 tiles."       |

---

### 4.2 Mobile Layout

| Aspect            | Specification                                                                   |
| ----------------- | ------------------------------------------------------------------------------- |
| **Visual**        | Horizontal scroll (swipe), tiles slightly compressed                            |
| **Overflow**      | `overflow-x: scroll`, snap to tile boundaries (`scroll-snap-type: x mandatory`) |
| **Touch**         | Swipe left/right to scroll, tap to select                                       |
| **Indicator**     | Scroll indicator dots below hand (show position: "tile 5 of 13")                |
| **Screen Reader** | Announce "Swipe to browse tiles. Currently viewing tile 1."                     |

**Performance**: Use `transform` for scrolling (not `scroll-left` property).

---

### 4.3 Sorting Animation

**Trigger**: User clicks "Sort" button.

**Steps**:

1. Fade out all tiles (100ms)

1. Rearrange DOM order (instant)

1. Fade in tiles in new positions with stagger (50ms delay per tile)

**Total Duration**: ~750ms for 13 tiles.

**Screen Reader**: Announce "Sorting hand by suit. Sorted."

---

## 5. Discard Pile Component

### 5.1 Grid Layout

| Aspect            | Specification                                                        |
| ----------------- | -------------------------------------------------------------------- |
| **Visual**        | Grid layout, 6 tiles per row, chronological order (newest top-right) |
| **Tile Size**     | 80% of normal size (visual hierarchy: hand > discard)                |
| **Hover**         | Show tooltip: "5 Dot, discarded by East on turn 12"                  |
| **Screen Reader** | `role="list"`, `aria-label="Discard pile: 23 tiles"`                 |

---

### 5.2 Last Discard Highlight

| Aspect            | Specification                                            |
| ----------------- | -------------------------------------------------------- |
| **Visual**        | Last discarded tile has glow effect (during call window) |
| **Animation**     | Pulse effect (same as Tile.Highlighted)                  |
| **Interactive**   | Clickable during call window (trigger "Call" modal)      |
| **Screen Reader** | Announce "East discarded 5 Dot. Press C to call."        |

---

## 6. The Card Viewer Component

### 6.1 Pattern List

| Aspect                | Specification                                               |
| --------------------- | ----------------------------------------------------------- |
| **Visual**            | Scrollable list, each pattern is a card component           |
| **Filter Tabs**       | Top nav: [All] [2468] [Quints] [Consecutive] [Winds]        |
| **Search**            | Live search bar: "Type to filter patterns"                  |
| **Pattern Highlight** | Patterns matching 5+ tiles in hand have ⭐ indicator        |
| **Screen Reader**     | `role="region"`, `aria-label="NMJL Card patterns for 2025"` |

---

### 6.2 Pattern Card

**Context**: Individual pattern display.

| Aspect            | Specification                                                                                                |
| ----------------- | ------------------------------------------------------------------------------------------------------------ |
| **Visual**        | - Pattern name + point value<br>- Tile visualization<br>- Suit requirements<br>- Concealed/exposed indicator |
| **Interactive**   | ✅ Click to expand details (joker rules, variations)                                                         |
| **Keyboard**      | `Enter` expands, `Esc` collapses                                                                             |
| **Screen Reader** | `role="article"`, `aria-label="2468 Consecutive, 25 points"`                                                 |

**Expansion**:

```text
Collapsed:
┌────────────────────────────────────┐
│ 2468 Consecutive (25 points) ⭐    │
│ 2222 4444 6666 88                  │
└────────────────────────────────────┘

Expanded:
┌────────────────────────────────────┐
│ 2468 Consecutive (25 points) ⭐    │
│ 2222 4444 6666 88                  │
├────────────────────────────────────┤
│ Requirements:                      │
│ • All same suit                    │
│ • Jokers allowed in quads, not pair│
│ • Concealed or exposed             │
│                                    │
│ Variations:                        │
│ • Bam suit: [tiles]                │
│ • Crak suit: [tiles]               │
│ • Dot suit: [tiles]                │
└────────────────────────────────────┘

```text

text

text

text

text

text

---

### 6.3 Dead Pattern Indicator

**Context**: Pattern is no longer achievable (dead tiles).

| Aspect            | Specification                                                                                           |
| ----------------- | ------------------------------------------------------------------------------------------------------- |
| **Visual**        | - Grayscale entire card<br>- Opacity: 0.5<br>- "❌ Impossible" badge<br>- Strikethrough on pattern name |
| **Interactive**   | ❌ Not selectable (still visible for reference)                                                         |
| **Tooltip**       | "This pattern requires 2B, but all 4 are out."                                                          |
| **Screen Reader** | `aria-label="2468 Consecutive, impossible, 2 Bamboo is dead"`                                           |

---

## 7. Player Area Component (Opponents)

### 7.1 Opponent Display (North/East/West)

| Aspect            | Specification                                                                                                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Visual**        | - Player name<br>- Seat label (East, South, West, North)<br>- Concealed tile count: "13 concealed"<br>- Exposed melds (visible tiles)<br>- Turn indicator (glowing border when active) |
| **Interactive**   | ❌ No (display only)                                                                                                                                                                   |
| **Screen Reader** | `role="region"`, `aria-label="East: Player Name, 13 concealed tiles, 1 exposed Pung of 7 Dot"`                                                                                         |

---

### 7.2 Turn Indicator

**Context**: Highlights whose turn it is.

| Aspect            | Specification                                                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| **Visual**        | - Glowing border: 4px solid green (`--color-my-turn` or `--color-opponent-turn`)<br>- Pulse animation<br>- "⏰ Your Turn" label (for self) |
| **Screen Reader** | Live region announces: "It's East's turn." or "It's your turn."                                                                            |

---

### 7.3 Disconnected Player Indicator

| Aspect            | Specification                                                        |
| ----------------- | -------------------------------------------------------------------- |
| **Visual**        | - Red dot icon: 🔴<br>- "Reconnecting..." text<br>- Grayscale avatar |
| **Screen Reader** | Announce: "East has disconnected. AI is taking over."                |

---

## 8. Timer Components

### 8.1 Turn Timer (60s default)

| Aspect            | Specification                                                                                                          |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Visual**        | - Circular progress bar<br>- Countdown number in center: "45s"<br>- Color: Green (> 30s), Yellow (30-10s), Red (< 10s) |
| **Warning**       | At 10s remaining: pulse + audio beep                                                                                   |
| **Screen Reader** | Live region announces: "10 seconds remaining." at T=50s and T=10s                                                      |

---

### 8.2 Call Window Timer (10s)

| Aspect            | Specification                                                                                                       |
| ----------------- | ------------------------------------------------------------------------------------------------------------------- |
| **Visual**        | - Horizontal progress bar at top of modal<br>- Shrinks from 100% to 0% over 10s<br>- Color: Blue (> 5s), Red (< 5s) |
| **Screen Reader** | Announce: "Call window: 10 seconds remaining."                                                                      |

---

## 9. Toast / Notification Component

### 9.1 Info Toast

**Context**: Non-critical information (e.g., "Player joined", "Charleston starting").

| Aspect            | Specification                                                                                          |
| ----------------- | ------------------------------------------------------------------------------------------------------ |
| **Visual**        | - Bottom-center position<br>- Blue background<br>- White text<br>- Icon: ℹ️<br>- Auto-dismiss after 3s |
| **Interactive**   | ❌ No (auto-dismiss only)                                                                              |
| **Screen Reader** | `role="status"`, `aria-live="polite"`, announce once                                                   |

---

### 9.2 Warning Toast

**Context**: Something went wrong, but recoverable (e.g., "Room full", "Call rejected").

| Aspect            | Specification                                                                |
| ----------------- | ---------------------------------------------------------------------------- |
| **Visual**        | - Yellow background<br>- Black text<br>- Icon: ⚠️<br>- Auto-dismiss after 5s |
| **Interactive**   | ✅ [X] close button                                                          |
| **Screen Reader** | `role="alert"`, `aria-live="assertive"`, announce immediately                |

---

### 9.3 Error Toast

**Context**: Critical error (e.g., "Server error", "Invalid command").

| Aspect            | Specification                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------- |
| **Visual**        | - Red background<br>- White text<br>- Icon: ❌<br>- Does NOT auto-dismiss (requires user to close) |
| **Interactive**   | ✅ [X] close button                                                                                |
| **Screen Reader** | `role="alert"`, `aria-live="assertive"`                                                            |

---

## 10. Progress Indicators

### 10.1 Spinner (Loading)

**Context**: Waiting for server response.

| Aspect            | Specification                                                                  |
| ----------------- | ------------------------------------------------------------------------------ |
| **Visual**        | - Circular spinner<br>- Blue color<br>- Rotation animation: 1s linear infinite |
| **Screen Reader** | `role="status"`, `aria-label="Loading..."`                                     |

---

### 10.2 Progress Bar (Charleston Waiting)

**Context**: Waiting for all players to select tiles.

| Aspect            | Specification                                                                       |
| ----------------- | ----------------------------------------------------------------------------------- |
| **Visual**        | - Horizontal bar<br>- Fill: 3/4 = 75% filled<br>- Label: "3/4 players ready"        |
| **Screen Reader** | `role="progressbar"`, `aria-valuenow="3"`, `aria-valuemin="0"`, `aria-valuemax="4"` |

---

## Component State Summary Table

| Component    | Total States | Keyboard Nav    | Screen Reader Required | Animation |
| ------------ | ------------ | --------------- | ---------------------- | --------- |
| Tile         | 10           | ✅ Yes          | ✅ Yes                 | ✅ Yes    |
| Button       | 5            | ✅ Yes          | ✅ Yes                 | ✅ Yes    |
| Modal        | 3            | ✅ Yes          | ✅ Yes                 | ✅ Yes    |
| Hand         | 2            | ✅ Yes          | ✅ Yes                 | ✅ Yes    |
| Discard Pile | 2            | ❌ No           | ✅ Yes                 | ✅ Yes    |
| Card Viewer  | 3            | ✅ Yes          | ✅ Yes                 | ❌ No     |
| Player Area  | 3            | ❌ No           | ✅ Yes                 | ✅ Yes    |
| Timer        | 2            | ❌ No           | ✅ Yes                 | ✅ Yes    |
| Toast        | 3            | ✅ Close button | ✅ Yes                 | ✅ Yes    |
| Progress     | 2            | ❌ No           | ✅ Yes                 | ✅ Yes    |

---

## Testing Checklist

For each component, verify:

- [ ] All states render correctly

- [ ] Transitions are smooth (60fps)

- [ ] Keyboard navigation works (Tab, Enter, Esc, Arrow keys)

- [ ] Screen reader announces all state changes

- [ ] Touch targets are minimum 44×44pt on mobile

- [ ] Disabled states are visually distinct

- [ ] Focus indicators are visible (never `outline: none` without alternative)

- [ ] Animations respect `prefers-reduced-motion` setting

---

## Performance Benchmarks

| Component                 | Render Time (Target) | Animation FPS (Target) |
| ------------------------- | -------------------- | ---------------------- |
| Tile                      | < 16ms               | 60fps                  |
| Hand (13 tiles)           | < 100ms              | 60fps                  |
| Modal open                | < 200ms              | 60fps                  |
| Card Viewer (50 patterns) | < 300ms              | N/A (static)           |
| Discard animation         | 500ms total          | 60fps                  |

**Measurement**: Use Chrome DevTools Performance tab, record 6x CPU slowdown.

---

## Related Documentation

- [UI/UX Design](../architecture/frontend/11-ui-ux-design.md) - Visual design system

- [User Journeys](user-journeys.md) - How components are used in context

- [Edge Cases](edge-cases.md) - Error state handling

---

**Last Updated**: 2026-01-10
