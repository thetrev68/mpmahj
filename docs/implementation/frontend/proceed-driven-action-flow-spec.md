# Proceed-Driven Action Flow Spec

**Status:** Proposed
**Audience:** Frontend / UX / gameplay integration
**Relates to:** `ActionBar`, `CallWindowPanel`, `StagingStrip`, `PlayingPhasePresentation`, `usePlayingPhaseActions`

---

## Goal

Adopt a selection-first interaction model with one dominant primary action: `Proceed`.

The player should learn one core pattern:

1. Read the instruction box
2. Select tiles if needed
3. Press `Proceed`

`Mahjong` remains a distinct, explicit action because it is exceptional, high-value, and should never be hidden behind a generic confirmation button.

---

## Product Direction

We are intentionally aligning the game flow with the clearer interaction model seen in Mahjong4Friends:

- one large contextual primary button
- explicit instructional copy above it
- staging area as the main workspace
- minimal action vocabulary
- tile selection determines intent more often than button choice

This replaces the current pattern where gameplay meaning is split across many separate action buttons.

---

## Core Principles

### 1. One Primary CTA

At any decision point, the UI should present a single large primary CTA:

- `Proceed`

The label should stay stable across phases unless there is a very strong reason not to.

### 2. Instruction Text Carries Meaning

The instruction panel explains what `Proceed` will do in the current context.

Examples:

- "Welcome to Charleston. Select 3 tiles to pass right, then press Proceed."
- "Bot 2 discarded Green Dragon. To skip, press Proceed. To claim it, select matching tiles and press Proceed. If you are Mahjong, press Mahjong."
- "You drew 3 Dot. Select a tile to discard, then press Proceed. If you are Mahjong, press Mahjong."

### 3. Selection Determines Intent

Whenever possible, the selected tiles plus current phase determine the command:

- no selection + call window -> skip claim
- valid selection + call window -> declare call intent
- one selected tile + discard stage -> discard selected tile
- staged Charleston tiles -> commit pass/vote/courtesy pass

### 4. Exceptional Actions Stay Separate

These should not be folded into `Proceed`:

- `Mahjong`
- utility actions such as `History`, `Hint`, `Undo`, `Pause`, `Sort`

---

## Placement Model

### Persistent bottom action bar

Owns the active turn workflow:

- instruction box
- large `Proceed` button
- `Mahjong` button when eligible
- optional small `Sort` button

### Staging area

Owns selection and visual confirmation:

- outgoing Charleston tiles
- incoming blind/courtesy tiles
- gameplay call selections if claim flow is moved onto the main board

### Utility cluster

Remains separate from the main decision flow:

- `History`
- `Hint`
- `Undo`
- `Pause`
- settings

### Overlay usage

Overlays should be used only when they add clarity, not by default.

The current `CallWindowPanel` should be simplified or removed if the same flow can be handled with:

- instruction box
- tile selection
- one `Proceed`
- one `Mahjong`

---

## Phase Behavior

### Setup / Charleston start

Instruction box explains the current Charleston step and direction.

`Proceed` behavior:

- commits the current staged pass when the required count is valid

Selection behavior:

- player taps tiles to move them between rack and staging area

Examples:

- first right: select 3 and proceed
- across: move tiles between staging and hand, then proceed
- blind pass: choose 1-3 tiles by preference, then proceed

### Charleston round vote

This should be treated as a variation of the same workflow, not as a separate button vocabulary.

Instruction box:

- "Round vote. Stage 3 tiles to continue. Stage 0 tiles to stop. Press Proceed when ready."

`Proceed` behavior:

- `0` staged -> submit stop vote
- `3` staged -> submit continue vote and pass selection

This is intentionally more human-readable than exposing a separate `VoteCharleston` control.

### Courtesy pass

Instruction box explains negotiated count.

`Proceed` behavior:

- submits the selected courtesy pass once the exact negotiated count is staged

### Gameplay: call / skip

This is the main redesign target.

Instruction box:

- identifies the discarded tile
- explains that `Proceed` skips when no valid claim selection exists
- explains that selecting tiles + `Proceed` claims
- explains that `Mahjong` is separate

Target interaction:

- no selection -> `Proceed` sends `Pass`
- valid selection -> `Proceed` sends `DeclareCallIntent`
- `Mahjong` -> separate button sends Mahjong path

The player should not choose from a button grid such as `Pung`, `Kong`, `Quint`, `Sextet`.
The UI should infer the claim from selection.

### Gameplay: own turn / discard

Instruction box:

- announces drawn tile when useful
- tells the player to select one tile and press `Proceed`

`Proceed` behavior:

- discards the selected tile

`Mahjong` remains available when eligible.

---

## Command Mapping

This design changes the UI surface, not the backend contract.

Existing backend commands remain the source of truth:

- Charleston commit -> `CommitCharlestonPass`
- Charleston stop/continue -> existing courtesy / vote commands
- skip claim -> `Pass`
- claim discard -> `DeclareCallIntent`
- discard selected tile -> `DiscardTile`
- self/called win -> `DeclareMahjong`

The frontend should derive the command from context and selection rather than exposing command names as buttons.

---

## Required Frontend Changes

### Action bar

Refactor `ActionBar` / `ActionBarPhaseActions` to support:

- one large `Proceed` button
- context-specific disabled reason
- instruction-first rendering
- secondary `Mahjong` action

### Call resolution flow

Refactor `CallWindowPanel` and `usePlayingPhaseActions` so claim type is inferred from selected tiles instead of picked from explicit claim buttons.

Needed support:

- validation for legal claim shapes from current hand + discarded tile
- clear feedback when selection is invalid
- deterministic mapping from selection to `Pung` / `Kong` / `Quint` / `Sextet`

### Playing presentation

Selection must remain available during call windows, not only during discard turns.

That likely means `PlayerRack` and related adapters need a mode that allows:

- selecting multiple tiles for a claim
- highlighting valid claim candidates
- clearing selection on pass / resolution / timeout

### Instruction system

`ActionBarDerivations.ts` should become the central source for:

- headline copy
- support copy
- Proceed enabled/disabled state
- Proceed action meaning

---

## UX Requirements

- The instruction copy must always explain what happens if the player presses `Proceed`.
- The interface must never require players to understand backend terms like `DeclareCallIntent`.
- `Proceed` must be disabled only when an action truly cannot be completed.
- In a call window, `Proceed` should remain enabled for "skip" even when no tiles are selected.
- Invalid claim selections should not silently fail; the UI should explain why the current selection cannot be claimed.
- `Mahjong` should always remain visually distinct from `Proceed`.

---

## Explicit Non-Goals

- This spec does not change server command shapes.
- This spec does not redesign hint/history/undo internals.
- This spec does not require branching timeline history.
- This spec does not force every utility action into the bottom action bar.

---

## Recommended Implementation Order

1. Add a phase-aware `Proceed` model to the action bar without changing backend commands.
2. Rewrite Charleston and discard flows to use `Proceed` terminology and instruction-led copy.
3. Enable multi-select and claim validation for call windows.
4. Replace the current call button grid with selection-driven claims.
5. Re-test history, undo, hint, and Mahjong overlays against the new primary flow.

---

## Resolved Decisions

- Gameplay call selection uses the staging strip, not the main rack as the action surface. The rack remains the source; staged tiles are the explicit "selected for action" state, and `Proceed` acts on what is currently staged.
- Invalid call selections do not disable `Proceed`. The player may press it and receive a clear validation message explaining why the staged combination cannot be claimed.
- The existing modal call window is removed from the target design. The opponent's discarded tile should appear in the staging area, and the player either:
  - presses `Proceed` with no valid staged claim to skip, or
  - stages matching tiles from their rack and presses `Proceed` to claim.
- `Sort` does not belong in the action pane. It should move to the bottom-left edge of the local rack as a rack-local utility.
- Add a follow-up TODO for an `Auto-sort hand` setting in the settings surface.
