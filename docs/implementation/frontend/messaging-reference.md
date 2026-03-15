# Messaging Reference: Action Pane and Status Bar

**Purpose:** Current-state audit of all instructional copy, button states, and status bar text.
Use as a baseline when defining the desired state for US-061.

**Source files:**

- `ActionBarDerivations.ts` — instruction text derivation
- `ActionBarPhaseActions.tsx` — renders instruction + buttons
- `GameplayStatusBar.tsx` — top status bar (Playing phase only)

---

## 1. Action Pane Matrix

The action pane renders, top to bottom:

1. **Claim candidate card** (only during CallWindow when `claimCandidate` prop is set)
2. **Instruction text** (`data-testid="action-instruction"`)
3. **Proceed button** (`data-testid="proceed-button"`)
4. **Mahjong button** (`data-testid="declare-mahjong-button"`)
5. **Post-submit waiting line** (Charleston standard passes only, after submitting)

**Button state key:** Enabled | Disabled | — (not rendered)

### Setup Phase

| Stage | Condition | Proceed | Mahjong | Instruction text |
| ---- | ---- | ---- | ---- | ---- |
| RollingDice | My seat is East | — (Roll Dice button, enabled) | — | "Roll dice to start the game" |
| RollingDice | My seat is not East | — | — | "Waiting for East to roll dice" |
| Other setup stages | — | — | — | "Setting up game..." |

> **Note:** During RollingDice the action area shows a Roll Dice button (not Proceed) for East only.
> Non-East players see instruction text with no buttons.

---

### Charleston Phase

Mahjong button is always rendered during Charleston. Enabled only if `canDeclareMahjong` is true.

#### Standard Passes

| Stage | Condition | Proceed | Mahjong | Instruction text |
| ---- | ---- | ---- | ---- | ---- |
| FirstRight | Fewer than 3 tiles staged | Disabled | Conditional | "Charleston. Select 3 tiles to pass right, then press Proceed." |
| FirstRight | 3 tiles staged, not submitted | Enabled | Conditional | "Charleston. Select 3 tiles to pass right, then press Proceed." |
| FirstRight | Pass submitted | Disabled | Conditional | "Charleston. Select 3 tiles to pass right, then press Proceed." |
| FirstAcross | Fewer than 3 tiles staged | Disabled | Conditional | "Charleston. Select 3 tiles to pass across, then press Proceed." |
| FirstAcross | 3 tiles staged, not submitted | Enabled | Conditional | "Charleston. Select 3 tiles to pass across, then press Proceed." |
| FirstAcross | Pass submitted | Disabled | Conditional | "Charleston. Select 3 tiles to pass across, then press Proceed." |
| SecondLeft | Fewer than 3 tiles staged | Disabled | Conditional | "Charleston. Select 3 tiles to pass left, then press Proceed." |
| SecondLeft | 3 tiles staged, not submitted | Enabled | Conditional | "Charleston. Select 3 tiles to pass left, then press Proceed." |
| SecondLeft | Pass submitted | Disabled | Conditional | "Charleston. Select 3 tiles to pass left, then press Proceed." |
| SecondAcross | Fewer than 3 tiles staged | Disabled | Conditional | "Charleston. Select 3 tiles to pass across, then press Proceed." |
| SecondAcross | 3 tiles staged, not submitted | Enabled | Conditional | "Charleston. Select 3 tiles to pass across, then press Proceed." |
| SecondAcross | Pass submitted | Disabled | Conditional | "Charleston. Select 3 tiles to pass across, then press Proceed." |

> **Post-submit line:** After clicking Proceed on a standard pass, an extra italic line
> "Waiting for other players..." renders below the Mahjong button (`aria-live="polite"`).
> This is the duplication that AC-7 targets.

#### Blind Passes

| Stage | Condition | Proceed | Mahjong | Instruction text |
| ---- | ---- | ---- | ---- | ---- |
| FirstLeft (Blind) | Fewer than 3 tiles committed | Disabled | Conditional | "Charleston Blind Pass: Choose 3 tiles to pass using your rack, the blind incoming tiles, or both. Then press Proceed." |
| FirstLeft (Blind) | 3 tiles committed | Enabled | Conditional | "Charleston Blind Pass: Choose 3 tiles to pass using your rack, the blind incoming tiles, or both. Then press Proceed." |
| FirstLeft (Blind) | Pass submitted | Disabled | Conditional | "Charleston Blind Pass: Choose 3 tiles to pass using your rack, the blind incoming tiles, or both. Then press Proceed." |
| SecondRight (Blind) | Fewer than 3 tiles committed | Disabled | Conditional | "Charleston Blind Pass: Choose 3 tiles to pass using your rack, the blind incoming tiles, or both. Then press Proceed." |
| SecondRight (Blind) | 3 tiles committed | Enabled | Conditional | "Charleston Blind Pass: Choose 3 tiles to pass using your rack, the blind incoming tiles, or both. Then press Proceed." |
| SecondRight (Blind) | Pass submitted | Disabled | Conditional | "Charleston Blind Pass: Choose 3 tiles to pass using your rack, the blind incoming tiles, or both. Then press Proceed." |

> **Post-submit line:** Same "Waiting for other players..." duplication applies.

#### Voting Stage

| Stage | Condition | Proceed | Mahjong | Instruction text |
| ---- | ---- | ---- | ---- | ---- |
| VotingToContinue | 0 tiles staged, not yet voted | Enabled | Conditional | "Round vote. Stage 3 tiles to continue. Stage 0 tiles to stop. Press Proceed when ready." |
| VotingToContinue | 1–2 tiles staged | Disabled | Conditional | "Round vote. Stage 3 tiles to continue. Stage 0 tiles to stop. Press Proceed when ready." |
| VotingToContinue | 3 tiles staged, not yet voted | Enabled | Conditional | "Round vote. Stage 3 tiles to continue. Stage 0 tiles to stop. Press Proceed when ready." |
| VotingToContinue | Vote submitted | Disabled | Conditional | "Round vote. Stage 3 tiles to continue. Stage 0 tiles to stop. Press Proceed when ready." |

Additional sub-messages rendered inside the vote panel, below the instruction:

| Condition | Sub-message |
| ---- | ---- |
| Not voted, 0 tiles staged | "No staged tiles means Proceed will stop Charleston." |
| Not voted, 3 tiles staged | "Three staged tiles means Proceed will continue Charleston." |
| Voted Stop | "You voted to STOP. Waiting for other players..." |
| Voted Continue | "You voted to CONTINUE. Waiting for other players..." |
| 1+ players have voted | "{n}/4 players voted" |
| Some players not yet voted | "Waiting for {seats}..." |
| Bot vote received | _{dynamic bot vote message from server}_ |

#### Courtesy Pass

| Stage | Condition | Proceed | Mahjong | Instruction text |
| ---- | ---- | ---- | ---- | ---- |
| CourtesyAcross | Not yet submitted, valid tile count | Enabled | Conditional | "Courtesy pass. Select 0–3 tiles for your across partner, then press Proceed." |
| CourtesyAcross | Not yet submitted, invalid tile count | Disabled | Conditional | "Courtesy pass. Select 0–3 tiles for your across partner, then press Proceed." |
| CourtesyAcross | Pass submitted | Disabled | Conditional | "Courtesy pass submitted. Waiting for your across partner..." |

> **Note:** CourtesyAcross replaces the instruction text with the post-submit message
> (unlike standard passes which keep the original instruction and add a second line below).

---

### Playing Phase

Mahjong button is always rendered during Playing. Enabled only if `canDeclareMahjong` is true
(and `canAct` is true during CallWindow).

#### Drawing Stage

| Stage | Condition | Proceed | Mahjong | Instruction text |
| ---- | ---- | ---- | ---- | ---- |
| Drawing | (any) | Disabled | Conditional | "Drawing tile..." |

#### Discarding Stage

| Stage | Condition | Proceed | Mahjong | Instruction text |
| ---- | ---- | ---- | ---- | ---- |
| Discarding | My turn, no tile selected | Disabled | Conditional | "Select 1 tile to discard, then press Proceed. If you are Mahjong, press Mahjong." |
| Discarding | My turn, 1 tile selected | Enabled | Conditional | "Select 1 tile to discard, then press Proceed. If you are Mahjong, press Mahjong." |
| Discarding | Another player's turn | Disabled | Conditional | "Waiting for {player} to discard." |

#### Call Window

The **claim candidate card** (above the instruction) is also rendered here when tiles are staged:

| Claim state | Card label | Card detail |
| ---- | ---- | ---- |
| No tiles staged | "Skip claim" | "Press Proceed to pass, or stage matching tiles to claim." |
| Valid meld staged | "{MeldType} ready" | "Press Proceed to call {MeldType}." |
| Invalid staged tiles | "Invalid claim" | _{validation error from engine, or "This staged claim cannot be called."_ |

Instruction and button states:

| Stage | Condition | Proceed | Mahjong | Instruction text |
| ---- | ---- | ---- | ---- | ---- |
| CallWindow | I am in `can_act`, `canProceedCallWindow` true | Enabled | Conditional | "Press Proceed to skip, or stage matching tiles and press Proceed to claim. Mahjong stays separate." |
| CallWindow | I am in `can_act`, `canProceedCallWindow` false | Disabled | Conditional | "Press Proceed to skip, or stage matching tiles and press Proceed to claim. Mahjong stays separate." |
| CallWindow | I am **not** in `can_act` | Disabled | Disabled | "Press Proceed to skip, or stage matching tiles and press Proceed to claim. Mahjong stays separate." |

> **Note:** The instruction text is the same regardless of whether the player can act.
> There is no "Waiting for call resolution" text in the action pane; that only appears in the status bar.
> A `callWindowInstruction` prop can override the default text.

#### Awaiting Mahjong

| Stage | Condition | Proceed | Mahjong | Instruction text |
| ---- | ---- | ---- | ---- | ---- |
| AwaitingMahjong | (any) | Disabled | Conditional | "Waiting for {callerSeat} to confirm Mahjong" |

---

### Terminal / Waiting Phases

| Phase | Proceed | Mahjong | Instruction text |
| ---- | ---- | ---- | ---- |
| WaitingForPlayers | — | — | "Waiting for players to join" |
| Scoring | — | — | "Scoring hand..." |
| GameOver | — | — | "Game over" |

### Read-Only / Historical Mode

| Mode | Proceed | Mahjong | Message |
| ---- | ---- | ---- | ---- |
| readOnly = true | — | — | _{readOnlyMessage prop, default: "Historical View - No actions available"}_ |

---

## 2. Status Bar Matrix

`GameplayStatusBar` is a fixed top banner visible **only during the Playing phase** and only when
`readOnly` is false. It does not render during Setup, Charleston, or terminal phases.

| Turn stage | Condition | Status bar text |
| ---- | ---- | ---- |
| Drawing | My seat is the drawing player | "Your turn — Drawing" |
| Drawing | Another player is drawing | "{player}'s turn — Drawing" |
| Discarding | My seat is the discarding player | "Your turn — Select a tile to discard" |
| Discarding | Another player is discarding | "Waiting for {player} to discard" |
| CallWindow | My seat is in `can_act` | "Call window open — Select claim tiles or press Proceed" |
| CallWindow | My seat is **not** in `can_act` | "Call window open — Waiting for call resolution" |
| Other / fallback | — | "Gameplay in progress" |
| readOnly = true | — | _(bar not rendered)_ |

> **Note:** `AwaitingMahjong` is not a `TurnStage` variant handled by `GameplayStatusBar`,
> so it falls through to "Gameplay in progress".

---

## 3. Overlap / Duplication Notes

These are the cases where the same intent is expressed in multiple places simultaneously:

| State | Action pane says | Status bar says | Duplication type |
| ---- | ---- | ---- | ---- |
| Discarding — my turn | "Select 1 tile to discard, then press Proceed. If you are Mahjong, press Mahjong." | "Your turn — Select a tile to discard" | Both say "your turn + discard a tile" |
| Discarding — other player | "Waiting for {player} to discard." | "Waiting for {player} to discard" | Exact semantic duplicate |
| CallWindow — can act | Full claim instruction | "Call window open — Select claim tiles or press Proceed" | Both prompt the same action |
| CallWindow — cannot act | Claim instruction (unchanged) | "Call window open — Waiting for call resolution" | Status bar gives waiting context; action pane gives action instruction irrelevant to this player |
| Charleston — after submit | Instruction text + "Waiting for other players..." | _(none — bar not shown)_ | Two lines in action pane for same "done, waiting" state |
| VotingToContinue — voted | "Round vote. Stage 3 tiles..." + "You voted to {X}. Waiting for other players..." | _(none)_ | Two lines for same "done, waiting" state |
