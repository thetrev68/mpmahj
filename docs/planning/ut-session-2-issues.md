# User-Testing Session 2 — Raw Issues

Captured: 2026-03-11
Status: Draft — needs refinement into formal user stories before implementation.

---

## Planning goals before story promotion

This document is no longer just a raw issue dump. It now serves as the pre-story refinement layer for the next frontend batch.

Before converting any item below into a `US-0xx` story, each draft story should explicitly capture:

- Scope boundaries: what is included, what is deferred
- Acceptance criteria: behavior the user can observe
- Edge cases: rule-driven or layout-driven failure modes that must not regress
- Proof type: unit, integration, Playwright, or manual-only check
- Dependencies: prior stories/specs/settings assumptions that the story relies on
- Open questions: any unresolved UX or rules interpretation that would otherwise create churn mid-implementation

### Existing story conventions to preserve

Recent story docs in `docs/implementation/frontend/user-stories/` consistently include:

- `Problem`
- `Scope`
- `Acceptance Criteria`
- `Edge Cases`
- `Primary Files (Expected)`
- `Notes for Implementer`
- `Test Plan`

This planning doc should gather enough detail that the eventual story-writing pass is mostly formatting, not additional discovery.

---

## Cross-cutting notes and dependencies

These apply to multiple issues and should be referenced from the eventual stories rather than rediscovered repeatedly.

### Existing story overlap

- `US-033` already established Leave Game as the primary exit path. `CC-1` should be framed as completing that simplification, not redefining it.
- `US-036` already reserved the right rail. `G-4` and `RR-1` should build on that layout contract instead of inventing a new board frame.
- `US-039` already established persistent action controls and instruction text. `C-4`, `G-2`, and `G-3` should be framed as tightening that model, not replacing it wholesale.
- `US-043` and `US-044` already addressed Charleston conservation and staging coherence. `C-1`, `C-2`, and `G-1` should be treated as either follow-up regressions or narrower visual-contract fixes, depending on what the current browser behavior shows.

### Shared implementation risk

- Several items mix UI cleanup with state-ownership concerns. Those should be separated in stories unless one depends directly on the other.
- Several items still contain `TBD`, `confirm with user`, or `find render site` notes. If those remain unresolved, the first implementation pass will spend time rediscovering context instead of executing a stable scope.
- The action pane, staging strip, top status bar, and right rail now form one UX surface. Stories that touch more than one of these should name which component is authoritative for layout and which is authoritative for action state.

### Story-writing guidance

- Prefer one state/interaction concern per story.
- Prefer one layout contract per story.
- Avoid bundling UI relocation with settings-model changes unless the dependency is hard.
- When a story changes user-visible copy, the copy should be finalized in the story rather than improvised during implementation.

---

## Blind pass interpretation notes

This section is the main rules clarification captured during refinement. It should be treated as the working interpretation unless contradicted by stronger rule guidance.

### Source rule text

NMJL wording captured in `docs/nmjl_mahjongg-rules.md`:

> Each player passes three unwanted tiles to player on left. On this pass, if you find you cannot spare any of the tiles in your hand, you may "steal" one, two or all three tiles that are being passed to you and pass them to the player on your left, without looking at them. This is called a "Blind Pass."

### Why blind pass exists

From a game-flow perspective, the value of the blind pass is:

- Charleston can force a player to pass 3 tiles even when they strongly prefer to keep their current hand intact.
- Blind pass softens that requirement on the final pass by letting the player satisfy some or all of the outgoing pass with tiles they have just received and not yet integrated into their hand decision.
- In practical terms, it preserves the player's existing hand while still completing the required 3-tile exchange.

So the important product concept is not just "do not look." It is "do not force the player to break up a hand they want to keep."

### Working UI/state interpretation

The clearest digital interpretation is a receive-first decision model:

- the player begins the blind-pass round with their full current concealed hand still in the rack
- 3 incoming tiles appear separately in staging as blind/unknown tiles
- the player then decides which 3 tiles go out
- those outgoing 3 may come from:
  - the rack
  - the blind incoming staging area
  - a mix of both

This framing matches the user expectation behind blind pass much better than a "remove 3 from rack first, then maybe substitute" model.

### Rack-count interpretation

The most important implication for implementation is this:

- blind-pass incoming tiles should not silently replace or subtract from the player’s concealed rack before the player decides
- they are a separate temporary choice source
- the player should make the pass decision using:
  - their full current concealed hand in the rack
  - plus the 3 incoming blind tiles in staging

In other words, the UI should communicate "you still have your hand, and you now also have 3 blind tiles available to use for this pass."

### Count invariant to use in stories/tests

Do not encode blind-pass count rules as "always 14 in rack" without seat context.

The safer invariant is:

- during blind-pass selection, the concealed rack shows the player’s full current pre-pass hand count for that seat and moment
- East is expected to have 14 during Charleston before the first discard
- non-East players are expected to have 13
- blind-pass incoming tiles are shown separately in staging as additional temporary pass candidates
- the combined decision surface is "rack + blind staging," but the rack count itself should remain intact

If the reported bug was observed while testing East, the expected value is indeed 14. The eventual story should say that explicitly if the failing fixture is East, while keeping the general invariant seat-aware.

### Open blind-pass questions to settle before implementation

- Do we want the player to be able to swap blind incoming tiles with rack tiles explicitly, or is that naturally expressed by allowing the outgoing 3 to be chosen from either source?
- Do we want revealing to exist at all in the product, or should blind tiles remain unknown until the pass is committed?
- If revealing is allowed, what user benefit does it provide, and does it still align with the intended blind-pass feel?
- For user-facing tests and AC, should the blind-pass story assert seat-aware rack counts, or only cover the East fixture that produced the observed bug?

### Recommended product framing

The clearest implementation target is:

- hidden incoming blind tiles appear in staging at the start of the blind-pass round
- the rack remains visually intact
- the player chooses the outgoing 3 from rack, staging, or a mix
- the UI treats blind pass as a special "receive-first decision" moment rather than a normal pass with a late blind override

Recommended transition between pass 2 and blind pass:

- end of pass 2: the received tiles are briefly shown as incoming, then auto-absorbed into the rack
- start of pass 3: the blind incoming tiles appear separately in staging as the new pass candidates
- do not require an extra user `Proceed` just to rack pass-2 tiles
- do not show 6 staging tiles at once (3 face-up + 3 blind), because that blurs the distinction between owned hand tiles and blind-pass candidates

Suggested prompt direction:

_Charleston Blind Pass: Choose 3 tiles to pass using your rack, the blind incoming tiles, or both. Then press Proceed._

If we want to emphasize the special value of the rule more directly:

_Charleston Blind Pass: Keep your current hand intact by passing 1-3 blind incoming tiles, or mix them with tiles from your rack. Then press Proceed._

---

## How to read this document

Each issue has:

- A **group** (for batching into stories)
- A **severity** (Critical / High / Medium)
- A clear description of the problem and the intended fix
- **Code references** from a codebase search (file paths relative to `apps/client/src/`)

Issues are numbered within their group for reference in discussion. They are NOT yet assigned US-0xx IDs.

---

## Group 1 — Charleston Phase Corrections

### C-1 · Blind Pass: Wrong tile face + wrong label + wrong tile count (Critical)

**Problem:**

- Tiles selected for blind pass display face-up and show a "PEEK" label. They should display face-down (tile back art) at all times — including on hover. Hovering must not reveal the face.
- The label "PEEK" is a misnomer. Blind pass tiles are passed without looking; the current label implies the opposite.
- During the blind pass selection phase the player's hand shows 11 tiles. It should show 14 (the full hand before 3 tiles are selected for the blind pass).

**Intended fix:**

- Render blind-pass tiles using the back-of-tile asset, not the face.
- Hover state must also show the back (no peek/reveal on hover).
- Rename the label from "PEEK" to "BLIND".
- Revisit action bar prompt text before implementation. The current proposed copy may conflict with the stricter NMJL reading of blind pass.
- Investigate and fix tile count: player must start the selection with the full legal concealed hand count for that seat/stage. If the failing repro is East, that means 14.

**Code references:**

- `components/game/StagingStrip.tsx` — blind tile logic at `isBlindTile`/`isHidden` (lines ~88); "PEEK"/"BLIND" badge render (lines ~123–130); flip callback `onFlipIncoming()`
- `components/game/ActionBar.tsx` — passes `blindPassCount` prop to `CommitCharlestonPass` command (line ~78)
- Tile back asset location TBD — confirm with user before implementing

**Rules / UX notes for story conversion:**

- The blind-pass value proposition is hand preservation, not information gain.
- The player’s concealed rack and blind-pass incoming tiles should be treated as two separate visual/state buckets.
- Blind pass should be modeled as a receive-first decision moment: the player keeps their current rack and also gets 3 blind incoming pass candidates.
- Transition from pass 2 to pass 3 should auto-absorb the received pass-2 tiles into the rack before showing the blind-pass candidates.
- If pass-2 tiles are auto-absorbed, the rack needs a clear "newly received" affordance so the player can still identify those 3 tiles quickly.
- Auto-sort behavior should be explicit in the story if the rack is expected to reorganize itself after each receive/absorb step.
- Story AC should assert seat-aware legal rack counts, not a global `14` unless the fixture is explicitly East.
- Decide before implementation whether reveal exists at all, but do not model blind pass as "rack already reduced to 11 before the choice."

**Recommended story split if needed:**

- If the rack-count bug turns out to be another Charleston conservation issue, split count integrity from tile-face/copy cleanup.
- If the rack count is visually wrong only because staging tiles are being modeled as if they already displaced rack tiles, keep it in the same story but make the visual-state ownership explicit.

---

### C-2 · Staging Area Has Excess Empty Space (High)

**Problem:**
The staging strip shows 6 tile slots (correct width) but renders additional empty space beyond the 6th slot. The strip should be exactly 6 tile-widths wide — no more, no less — in both Charleston and Gameplay phases. This constraint must hold regardless of window size or number of tiles currently staged. Width must scale proportionally with screen/tile size.

**Intended fix:**

- Hard-cap staging strip width to exactly 6 tile slots (proportionate with the rendered tile size, not a fixed pixel value).
- Apply this constraint uniformly across both Charleston and Gameplay (see also G-1).

**Code references:**

- `components/game/StagingStrip.tsx` — slot count driven by `incomingSlotCount`/`outgoingSlotCount` props; currently uses `flex w-fit` with no max-width cap; each slot is `w-[63px] h-[90px]`; container uses `overflow-x-auto` which allows overflow instead of capping width

---

### C-3 · Courtesy Pass: Duplicate UI + Wrong Prompt Text (High)

**Problem:**

- A "Negotiate with [West]" pop-up modal appears alongside the action pane during courtesy pass. The action pane is the correct surface; the modal is redundant and confusing.
- The action pane prompt text is incorrect.

**Intended fix:**

- Remove the courtesy pass pop-up/modal entirely.
- Action pane prompt text: _"Courtesy pass. Select 0–3 tiles for your across partner, then press Proceed."_

**Code references:**

- `components/game/CourtesyPassPanel.tsx` — Card-based panel rendering "Negotiate with {seat} - select 0-3 tiles"; testid `courtesy-pass-panel`; four count buttons `courtesy-count-{0,1,2,3}`; waiting state "Proposed {count} tiles. Waiting for {seat}..."
- Find where `CourtesyPassPanel` is mounted in the tree (likely in the Charleston phase action area or `PlayingPhaseOverlays`) and remove that render site

---

### C-4 · Action Pane: Persistent Proceed + Mahjong Buttons (High)

**Problem:**
The Charleston action pane does not consistently show a stable set of controls. Players should always see the same two buttons and never have to hunt for them.

**Intended fix:**

- Action pane always renders exactly two buttons: **Proceed** and **Mahjong**.
- Both buttons are visible at all times (not conditionally hidden).
- Each button is disabled (not hidden) when its action is not currently available.
- This two-button model applies for the full Charleston (and gameplay) phase.

**Code references:**

- `components/game/ActionBar.tsx` — Proceed is rendered via `renderProceedButton()` (~lines 112–128) with multiple variant testids: `pass-tiles-button` (Charleston pass), `courtesy-pass-tiles-button` (courtesy pass), `proceed-button` (vote), `discard-button` (discard)
- `components/game/ActionBarPhaseActions.tsx` — phase-specific buttons including Mahjong (`declare-mahjong-button`, ~line 339)
- Goal: consolidate so exactly Proceed + Mahjong are always rendered; disabled state rather than hidden/absent

---

## Group 2 — Gameplay Phase Layout

### G-1 · Staging Area: Wrong Slot Count + Redundant Text Area (Critical)

**Problem:**
The gameplay staging strip shows only 2 tile slots and includes a text area to its right. Both are wrong.

**Intended fix:**

- Match the Charleston staging strip exactly: 6 slots, same dimensions, same board position.
- Remove the text area to the right of the staging strip. It is redundant.

**Code references:**

- `components/game/StagingStrip.tsx` — slot counts come from `incomingSlotCount`/`outgoingSlotCount` props; find the gameplay call site that passes `2` and change to `6`
- Text area to the right: identify its render location in `PlayingPhasePresentation.tsx` or a sibling component — caller to confirm before deletion

---

### G-2 · Action Pane: Match Charleston Model — Two Buttons Only (High)

**Problem:**
The gameplay action pane contains Get Hint, Exchange Joker, and Undo buttons in addition to Proceed/Mahjong. These extra controls clutter the pane and will be addressed elsewhere (see G-4, G-5, G-6).

**Intended fix:**

- Gameplay action pane shows exactly two buttons: **Proceed** and **Mahjong** (disabled when unavailable), mirroring the Charleston model.
- Remove Get Hint, Exchange Joker, and Undo from the action pane.

**Code references:**

- `components/game/ActionBarPhaseActions.tsx` — Get Hint: testid `get-hint-button` (~line 318); Exchange Joker: testid `exchange-joker-button` (~line 348); Mahjong: testid `declare-mahjong-button` (~line 339)
- `components/game/ActionBar.tsx` — Undo rendered via `ActionBarUndoControls` component (~lines 155–168)

---

### G-3 · Status Bar: Extend Charleston Tracker into Gameplay + Remove Redundant Line (Medium)

**Problem:**
During Charleston, `CharlestonTracker` renders a full-width shaded bar at the top of the screen showing pass direction, progress, ready state, seat indicators, and timer. This bar disappears entirely during gameplay. The gameplay action pane then shows two similar text lines:

1. `playing-status` — _"Your turn - Select a tile to discard"_ (turn ownership signal; should live in the top bar)
2. `action-instruction` — _"Select 1 tile to discard, then press Proceed. If you are Mahjong, press Mahjong."_ (phase instruction; stays in the action pane)

**Intended fix:**

- Keep `CharlestonTracker` (or an equivalent full-width bar using the same styling) visible throughout Gameplay, not just Charleston.
- During gameplay, the top bar should show turn-ownership status — e.g. _"Your turn"_ or _"Waiting for West to discard"_ — replacing the `playing-status` div in the action pane.
- The `action-instruction` text (_"Select 1 tile to discard, then press Proceed..."_) remains in the action pane — it is phase-specific guidance, not status.
- Remove the `playing-status` div (`testid="playing-status"`) from `ActionBarPhaseActions.tsx` once its content is covered by the top bar.

**Code references:**

- `components/game/CharlestonTracker.tsx` — `fixed top-0 left-0 right-0 z-20`; props: `stage`, `readyPlayers`, `waitingMessage`, `statusMessage`, `timer`; rendered in `CharlestonPhase.tsx` (lines ~446–459)
- `components/game/ActionBarPhaseActions.tsx`:
  - `playing-status` div (~lines 293–302): _"Your turn - Select a tile to discard"_ — move content to top bar, then remove this div
  - `action-instruction` div (~line 93–104): rendered from `getInstructionText()` in `ActionBarDerivations.ts` — keep this one
- The board already has `pt-16` (64px top padding) to accommodate the fixed bar; this padding should persist during gameplay

---

### G-4 · Get Hint: Move Off the Gameboard to the Right Rail (Medium)

**Problem:**
Get Hint is currently a button inside the action pane. It should be accessible without occupying prime action-pane real estate.

**Intended fix:**

- Move the Get Hint affordance to the right rail (off the main gameboard area).
- Details of right-rail placement TBD — see also RR-1 (AI Hint panel).

**Code references:**

- `components/game/ActionBarPhaseActions.tsx` — current location: testid `get-hint-button` (~line 318)
- Right-rail destination: to be defined in a layout spec before implementation

> **Note:** exact right-rail layout and interaction spec to be defined before implementation.

---

### G-5 · Exchange Joker: Remove Button, Use Click-to-Exchange Flow (High)

**Problem:**
Exchange Joker has an explicit button in the action pane. This is unnecessary and adds noise.

**Intended fix:**

- Remove the Exchange Joker button.
- Player initiates exchange by clicking an exposed joker on any opponent's meld.
- System presents a confirmation: _"Exchange [2 Bam] with Joker from [West]? Yes / No"_
  - **No** → cancel, no change.
  - **Yes** → attempt to place the tile:
    1. Check staging strip first. If the matching tile is there, swap it with the joker.
    2. If not in staging, check concealed hand. If found, swap it.
    3. If found in neither location, surface a brief inline message (e.g. _"You don't have [2 Bam] to exchange."_) and cancel.

**Code references:**

- `components/game/ActionBarPhaseActions.tsx` — current button: testid `exchange-joker-button` (~line 348); remove this render
- Joker click target: find where opponent meld tiles are rendered and add a click handler for joker tiles
- Confirmation UI: new component or reuse an existing dialog pattern; confirm approach before implementing

---

### G-6 · Undo: Remove Entirely (Medium)

**Problem:**
The Undo button does not work reliably. The history panel already covers this use case.

**Intended fix:**

- Remove the Undo button and all associated UI.
- Do not fix the underlying undo mechanism — it is superseded by history.

**Code references:**

- `components/game/ActionBar.tsx` — `ActionBarUndoControls` component (~lines 155–168); remove this component and its render site
- Search for any other undo-related UI (e.g. `undo-notice` overlay in `PlayingPhaseOverlays.tsx` ~lines 357–366) and remove those too

---

### G-7 · Remove Sound Settings Placeholder Panel (High)

**Problem:**
A "Sound settings coming soon" placeholder panel is rendering in the top-right area of the gameboard. It is vestigial and should be removed now that audio settings will be handled in the settings modal (see S-2).

**Intended fix:**

- Delete the placeholder panel and its render site entirely.

**Code references:**

- `components/game/GameBoard.tsx` — testid `sound-settings-placeholder`; positioned `absolute right-4 top-16 z-30 w-64` (~lines 320–330); contains TODO comment about Auto-sort hand

> **Note:** the TODO about Auto-sort hand should be moved to `TODO.md` before deleting this file section, so the task isn't lost.

---

### G-8 · Discard Pile: Move Higher + Widen + No Scroll for 99 Tiles (High)

**Problem:**
The discard pile zone overlaps or interferes with the staging area and action pane. It is also too narrow and requires scrolling before 99 tiles are shown.

**Intended fix:**

- Move the discard pile zone upward so it does not overlap the staging strip or action pane.
- Widen the zone to accommodate up to 99 tiles in a grid layout without any scroll affordance.
- Exact pixel/grid spec TBD in component spec.

**Code references:**

- `components/game/DiscardPool.tsx` — current positioning: `absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2`; current size: `w-[40%] h-[40%]`; uses `overflow-auto` (allows scroll — must be removed)
- testid: `discard-pool`, `discard-pool-tile-{index}`
- Tiles have deterministic ±5° rotation based on turn + index (~line 49)

**Sizing reference for grid spec:**

- Opponent rack tiles: `32px × 46px` (`.tile-small` in Tile.css)
- Staging strip tiles: `63px × 90px` (`.tile-medium`)
- Board square: `min(90vh, calc(100vw - 22rem))`, max `1200px × 1200px`
- Current discard pool at 40% of board ≈ 480px × 480px
- 99 tiles at small size in a 10-column grid: ~340px wide × 480px tall (10 cols × 34px, 10 rows × 48px)
- Suggest: fixed-column grid using small tile size, no rotation, positioned in the upper center of the board above the staging strip — exact column count TBD by user

---

## Group 3 — Controls Cleanup

### CC-1 · Remove Start Over Button (Medium)

**Problem:**
"Leave Game" and "Start Over" are redundant. Start Over creates confusion about what it does versus Leave Game.

**Intended fix:**

- Delete the Start Over button and its handler.
- Leave Game remains as the sole exit control (consistent with US-033).

**Code references:**

- `components/game/GameBoard.tsx` — testid `start-over-button` (~lines 280–291); positioned in `board-controls-strip` at `absolute right-4 top-4`; icon is `RotateCcw` from lucide-react; handler `handleStartOver()` (~lines 129–135)
- Remove both the JSX render and the `handleStartOver` function

---

## Group 4 — Right Rail: AI Hint Panel

### RR-1 · AI Hint Panel: Relocate to Right Rail + Simplify (Medium)

**Problem:**
The AI Hint panel currently renders fixed at the top-left of the screen. The "Reason" text section adds length without adding clarity.

**Intended fix:**

- Move the AI Hint panel into the right rail — a shaded box (darker than the discard zone background) that occupies the full remaining width to the right of the square board and the top half of that available height.
- Remove the "Reason" section from the hint display. Show the hint recommendation only.
- Panel visibility tied to the "Use Hints" setting (see S-1):
  - Hints on → panel is always visible during Charleston and Gameplay.
  - Hints off → panel is hidden.
- The Get Hint trigger (G-4) also lives in this rail.

**Layout spec:**

- Right rail = the space to the right of `square-board-container` inside the `game-board-layout` flex row
- Board layout uses `lg:gap-6`; remaining width ≈ `calc(100vw - 22rem)` is consumed by the board; right rail gets what is left
- AI Hint panel: top 50% of the rail height; shaded background darker than the felt/discard zone
- Bottom 50% of the rail is unspecified for now (leave empty or reserve for future use)

**Code references:**

- `components/game/HintPanel.tsx` — current hint display component; testid `hint-panel`
- `components/game/phases/playing-phase/PlayingPhaseOverlays.tsx` — current render: `fixed left-6 top-20 z-40 w-[380px]` (~lines 153–160); hint request dialog (~lines 183–220) testid `hint-request-dialog`; loading overlay (~lines 163–181) testid `hint-loading-overlay`
- `components/game/GameBoard.tsx` — board layout: `flex h-full w-full px-4 pb-4 pt-16 lg:items-center lg:justify-start lg:gap-6`; square board container uses `lg:h-[min(90vh,calc(100vw-22rem))]`; right rail is a new sibling element in this flex row

---

## Group 5 — Theming (Light/Dark Mode)

### TH-1 · History Panel: Audit and Fix Theme Compliance (High)

**Problem:**
The history panel does not fully respect light/dark mode.

**Intended fix:**

- Audit all components inside `HistoryPanel.tsx` for non-themed elements.
- Replace any non-themed elements with Shadcn/ui equivalents that inherit the active theme.
- Verify both light and dark mode visually after the change.

**Code references:**

- `components/game/HistoryPanel.tsx` — top-level container already uses `Sheet` from shadcn/ui; inner components (filtering UI, text search, move list, export buttons) may use non-themed primitives — audit before changing
- `components/game/TimelineScrubber.tsx` — visual timeline; check for theme compliance
- `components/game/HistoricalViewBanner.tsx` — mode indicator; check for theme compliance

---

### TH-2 · Settings Modal: Audit and Fix Theme Compliance (High)

**Problem:**
The settings modal does not fully respect light/dark mode.

**Intended fix:**

- Audit all components inside the settings modal for non-themed elements.
- Replace any non-themed elements with Shadcn/ui equivalents.
- Verify both light and dark mode visually after the change.

**Code references:**

- `components/game/phases/playing-phase/PlayingPhaseOverlays.tsx` — modal render (~lines 222–244) uses shadcn/ui `Dialog`; testid `hint-settings-dialog`
- `HintSettingsSection.tsx` — contains the modal content: verbosity select `hint-verbosity-select`, hint sound checkbox `hint-sound-enabled`, sound type select `hint-sound-type-select`, preview buttons `hint-preview-{Beginner,Intermediate,Expert,Disabled}`, preview output `hint-preview-output`, reset button `hint-settings-reset-button` — these inner elements are the likely culprits

---

## Group 6 — Settings Simplification

### S-1 · Hint Verbosity: Simplify to On/Off Switch (Medium)

**Problem:**
The current Hint Verbosity control offers Beginner / Intermediate / Expert levels with a dropdown, a preview box, and a separate Hint Sound toggle and Reset button. Only the intermediate path is worth keeping; the rest adds noise.

**Intended fix:**

- Replace Hint Verbosity with a single **"Use Hints"** on/off switch.
- Keep the intermediate hint path as the only implementation.
- Remove: Beginner level, Expert level, the verbosity dropdown, the preview box, the Reset Hint Settings button.
- Remove: Hint Sound as an independent toggle — hint sound follows the main audio setting, not a separate control.

**Code references:**

- `HintSettingsSection.tsx`:
  - Verbosity dropdown: `hint-verbosity-select` (options: Beginner, Intermediate, Expert, Disabled) — replace with on/off switch
  - Preview buttons: `hint-preview-{Beginner,Intermediate,Expert,Disabled}` and output `hint-preview-output` — remove
  - Hint Sound section: `hint-sound-enabled` checkbox, `hint-sound-type-select`, `hint-sound-test-button` (~lines 151–192) — remove
  - Reset button: `hint-settings-reset-button` (~line 195) — remove
- Any hint-verbosity-dependent rendering in `HintPanel.tsx` should be simplified to a single (intermediate) path

---

### S-2 · Settings Modal: Add Audio Controls (Medium)

**Problem:**
Audio settings are captured as a TODO in the codebase but are not yet in the settings modal. The existing sound-settings placeholder panel (G-7) will be removed; its content should migrate here.

**Intended fix:**

- Add an Audio section to the settings modal with two independent controls:
  1. **Sound Effects** — mute toggle + volume slider
  2. **Background Music** — mute toggle + volume slider
- Remove the `sound-settings-placeholder` panel from `GameBoard.tsx` (see G-7) — its TODO content migrates here.

**Code references:**

- `components/game/GameBoard.tsx` — testid `sound-settings-placeholder` (~lines 320–330): placeholder panel with "Sound settings coming soon"; remove after migrating
- `hooks/useSoundEffects.ts` — ~line 128: "For now, use a simple beep tone"; `SoundEffect` type (~line 29) has 7 defined variants but at least 5 additional ones dispatched without entries (`game-draw`, `mahjong-win`, `dead-hand-penalty`, `tile-place`, `undo-whoosh`); this hook is the audio infrastructure that must be wired to the new volume controls
- `TODO.md` — "Replace beep-tone sound placeholders with real audio files" — this story is a prerequisite or should be coordinated with that backlog item

---

## Suggested Story Groupings (Draft)

These groupings are a starting point. Adjust based on implementation complexity.

| Draft Story | Issues | Proposed Title |
|---|---|---|
| US-049 | C-1 | Charleston Blind Pass: Face-Down Rendering + Correct Tile Count |
| US-050 | C-2, G-1 | Staging Strip: Uniform 6-Slot Width Across Both Phases |
| US-051 | C-3, C-4 | Charleston Action Pane: Courtesy Pass Text + Persistent Two-Button Model |
| US-052 | G-2, G-3, G-6, CC-1, G-7 | Gameplay Action Pane + Controls Cleanup |
| US-053 | G-5 | Exchange Joker: Click-to-Exchange Flow |
| US-054 | G-8 | Discard Pile: Repositioning and Full-Hand Display |
| US-055 | G-4, RR-1 | Right Rail: Get Hint Relocation + AI Hint Panel |
| US-056 | TH-1, TH-2 | Light/Dark Theming: History Panel + Settings Modal |
| US-057 | S-1, S-2 | Settings: Simplified Hints Switch + Audio Controls |

---

## Promotion notes by draft story

These notes are the additional detail to carry into the eventual `US-0xx` story files.

### US-049 · C-1

- Add explicit AC for seat-aware rack count during blind-pass selection.
- Add explicit AC for face-down rendering on initial render, hover, and click.
- Decide whether reveal-on-click is in scope or removed as a product behavior.
- Add at least one integration test covering East and, ideally, one non-East fixture if available.
- Add explicit transition AC for end-of-pass-2 -> start-of-pass-3:
  - pass-2 received tiles auto-absorb into the rack
  - rack auto-sorts after absorb
  - the absorbed 3 tiles remain visually identifiable via highlight/halo/entry treatment
  - the 3 blind-pass candidates then appear separately in staging

### US-050 · C-2 + G-1

- Define the exact slot-width contract in CSS terms before story creation.
- Identify the gameplay call site that currently passes `2` slots.
- Identify and name the redundant text area to remove.
- Add one Playwright or browser-geometry assertion because this is a layout contract, not just a prop contract.

### US-051 · C-3 + C-4

- This is story-ready once the courtesy modal mount site is identified.
- Add a button-state matrix for Charleston:
  - Proceed visible/enabled conditions
  - Mahjong visible/enabled conditions
  - read-only/history behavior
- Finalize courtesy copy in the story.

### US-052 · G-2 + G-3 + G-6 + CC-1 + G-7

- This bundle is broad. Strong candidate to split into:
  - gameplay action-pane cleanup
  - board-controls cleanup
  - placeholder/status cleanup
- If kept together, the story must explicitly say it is a cleanup batch with no new gameplay rules.
- Add a dependency note back to `US-033` and `US-039`.

### US-053 · G-5

- Needs a stronger authority contract:
  - what the client checks locally
  - what the server remains authoritative for
- Needs the opponent-meld render site identified.
- Needs the confirmation surface chosen before implementation.

### US-054 · G-8

- Needs a component spec first. The grid/placement contract is still too open.
- Add mobile behavior expectations.
- Add whether tile rotation stays or is removed.

### US-055 · G-4 + RR-1

- This should not start until the right-rail layout spec is finalized.
- Story should define:
  - rail width behavior
  - hint trigger placement
  - hint panel empty/loading/error states
  - whether the lower half of the rail stays intentionally blank

### US-056 · TH-1 + TH-2

- Replace "audit and fix" with concrete done criteria.
- Add a checklist of likely offenders so the story is testable.
- Decide whether visual verification is manual-only or snapshot-backed.

### US-057 · S-1 + S-2

- Define settings source of truth and persistence behavior.
- Clarify whether hint sound fully disappears or is folded into master sound effects.
- Add dependency note against the current placeholder audio infrastructure and `TODO.md` audio item.

---

## Recommended next decisions before writing stories

1. Blind pass product behavior:
   strict rules fidelity vs. optional reveal teaching aid
2. Seat-aware rack-count invariant:
   codify now so tests do not hard-code the wrong expectation
3. Right rail layout spec:
   finish before `US-055`
4. Discard pool component spec:
   finish before `US-054`
5. Whether `US-052` stays bundled or is split for cleaner implementation/review

---

## Decision log

This section captures decisions made during refinement so they do not need to be re-litigated during story writing or implementation.

### Confirmed decisions

- Blind pass should be modeled as a receive-first decision moment.
- The rack should remain visually intact during blind-pass selection.
- Blind-pass candidates should appear separately in staging.
- End of pass 2 should auto-absorb received tiles into the rack.
- The rack should auto-sort after that absorb step.
- Newly absorbed tiles need a temporary visual identifier so the player can still tell what just arrived.
- Do not require an extra user action just to move pass-2 received tiles from staging into the rack.
- Do not show 6 staging tiles at once during the pass-2 -> pass-3 transition.

### Still open

- Whether reveal-on-click exists at all for blind-pass candidates.
- Whether `US-052` remains one cleanup story or is split.
- Final right-rail layout spec.
- Final discard-pool layout spec.
- Final wording for all revised prompts and labels.

---

## Repro and fixture matrix

Before writing stories, each issue should be tied to a reproducible fixture or interaction path. This avoids story language that accidentally encodes the wrong seat, phase, or layout assumption.

Recommended fields for each eventual story:

- Seat under test: East / South / West / North
- Phase/stage under test: exact Charleston or Playing substage
- Expected rack count
- Expected staging contents
- Expected action-bar prompt
- Expected enabled/disabled actions
- Existing test fixture or integration file that is closest to the repro

### Known fixtures likely relevant

- `apps/client/src/features/game/CharlestonFirstLeft.integration.test.tsx`
- `apps/client/src/features/game/CharlestonSecondRight.integration.test.tsx`
- `apps/client/src/features/game/Charleston.integration.test.tsx`
- `apps/client/src/features/game/CharlestonSecondCharleston.integration.test.tsx`
- `apps/client/e2e/frontend-recovery-guardrails.spec.ts`

### Recommended story-writing rule

If a story references a tile-count or layout bug, name the exact fixture/seat/stage in the story notes. Do not leave it as a generic "during Charleston" statement if the repro is actually narrower.

---

## Copy inventory to finalize before implementation

Several issues include copy changes. These should be frozen in the story docs so implementation does not become a copywriting pass.

### Blind pass

- Badge text:
  - replace `PEEK`
  - likely target: `BLIND`
- Instruction text:
  - choose one final blind-pass prompt and reuse it consistently

### Courtesy pass

- Action-pane prompt:
  - `Courtesy pass. Select 0–3 tiles for your across partner, then press Proceed.`
- Remove duplicate modal copy if the modal is deleted

### Gameplay top status

- `Your turn`
- `Waiting for West to discard`
- equivalent status strings for all seats

### Joker exchange

- confirmation prompt
- missing-tile error message

### Settings

- `Use Hints`
- audio section labels
- mute/volume labels

---

## Test-proof expectations by story type

This is a planning aid so stories ask for the right evidence up front.

### State and interaction stories

Prefer:

- component/unit tests for pure derivations
- integration tests for multi-step game flows

Examples:

- blind pass
- courtesy pass
- action-button state coherence
- joker exchange flow

### Layout and board-geometry stories

Prefer:

- Playwright or browser-geometry assertions
- visual baselines for desktop breakpoints

Examples:

- staging-strip width
- discard-pool placement
- right-rail placement
- top status bar continuity

### Theme/compliance stories

Prefer:

- component assertions for themed classes/primitives where practical
- manual visual verification in both themes
- optional snapshots if the surfaces are stable enough

---

## Recommended story-writing order

The current issue set will be easier to convert and implement if stories are written in this order:

1. `US-049`
   because blind-pass behavior affects rack counts, prompts, staging, and transition expectations
2. `US-050`
   because staging-strip layout should be stabilized before more right-rail/discard-pool adjustments
3. `US-051`
   because Charleston action-surface cleanup should be settled before mirroring the model in gameplay
4. `US-052`
   after deciding whether to split it
5. `US-055`
   only after the right-rail spec is finalized
6. `US-054`
   only after the discard-pool component spec is finalized
7. `US-056`
   once the settings/history target surfaces are stable
8. `US-057`
   after the settings-state contract is clearly defined

---

## Story author checklist

Use this checklist when promoting each draft item into a formal story doc.

- Problem is written from the player-visible failure, not just the code symptom.
- Scope says what is in and what is intentionally deferred.
- AC uses exact visible outcomes, not vague quality terms.
- EC covers phase changes, reconnect/remount, and seat-specific differences where relevant.
- Primary files name the real render/owner locations, not placeholders like "find caller".
- Notes for implementer record state ownership if more than one component is involved.
- Test plan names the exact unit/integration/Playwright proof expected.
- Copy strings are finalized.
- Dependencies on prior stories/specs are called out explicitly.

---

_End of raw issues capture. Next step: promote each draft story to a full user story document with AC, EC, and DoD._
