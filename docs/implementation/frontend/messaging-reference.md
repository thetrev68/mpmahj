# Messaging Reference: Action Pane and Status Bar

**Purpose:** Desired-state specification for action pane and status bar copy.
Incorporates US-061 feedback and replaces the prior current-state audit.

**Source files:**

- `ActionBarDerivations.ts` — instruction text derivation
- `ActionBarPhaseActions.tsx` — renders instruction + buttons
- `GameplayStatusBar.tsx` — top status bar

---

## 1. Action Pane Matrix

The action pane renders, top to bottom:

1. **Instruction text** — static per phase/condition, or dynamic claim status during CallWindow
2. **Proceed button** (`data-testid="proceed-button"`)
3. **Mahjong button** (`data-testid="declare-mahjong-button"`)

Design rules:

- The post-submit "Waiting for other players..." line is **removed** from all Charleston pass stages.
- During CallWindow the claim status renders directly in the instruction text area (no separate
  card widget or card label).
- When the local player cannot act, the action pane renders nothing (no instruction, no buttons).

**Button state key:** Enabled | Disabled | — (not rendered)

**Mahjong button** is always rendered during Charleston and Playing phases. Enabled only when
`canDeclareMahjong` is true; during CallWindow it is additionally gated by `canAct`.

---

### Setup Phase

| Stage | Condition | Proceed | Mahjong | Instruction text |
| --- | --- | --- | --- | --- |
| RollingDice | My seat is East | — (Roll Dice button, enabled) | — | "Roll dice to start the game" |
| RollingDice | My seat is not East | — | — | "Waiting for East to roll dice" |
| Other setup | — | — | — | "Setting up game..." |

> **Future work:** Roll Dice should be triggered by the Proceed button rather than a custom
> button. Needs a separate user story.

---

### Charleston Phase

#### Standard Passes

| Stage | Condition | Proceed | Mahjong | Instruction text |
| --- | --- | --- | --- | --- |
| FirstRight | Fewer than 3 tiles staged | Disabled | Conditional | "Charleston. Select 3 tiles to pass right, then press Proceed." |
| FirstRight | 3 tiles staged | Enabled | Conditional | "Charleston. Select 3 tiles to pass right, then press Proceed." |
| FirstRight | Pass submitted | Disabled | Conditional | "Passing 3 tiles right. Receiving 3 tiles from left." |
| FirstAcross | Fewer than 3 tiles staged | Disabled | Conditional | "Charleston. Select 3 tiles to pass across, then press Proceed." |
| FirstAcross | 3 tiles staged | Enabled | Conditional | "Charleston. Select 3 tiles to pass across, then press Proceed." |
| FirstAcross | Pass submitted | Disabled | Conditional | "Passing 3 tiles across. Receiving 3 tiles from across." |
| SecondLeft | Fewer than 3 tiles staged | Disabled | Conditional | "Charleston. Select 3 tiles to pass left, then press Proceed." |
| SecondLeft | 3 tiles staged | Enabled | Conditional | "Charleston. Select 3 tiles to pass left, then press Proceed." |
| SecondLeft | Pass submitted | Disabled | Conditional | "Passing 3 tiles left. Receiving 3 tiles from right." |
| SecondAcross | Fewer than 3 tiles staged | Disabled | Conditional | "Charleston. Select 3 tiles to pass across, then press Proceed." |
| SecondAcross | 3 tiles staged | Enabled | Conditional | "Charleston. Select 3 tiles to pass across, then press Proceed." |
| SecondAcross | Pass submitted | Disabled | Conditional | "Passing 3 tiles across. Receiving 3 tiles from across." |

#### Blind Passes

| Stage | Condition | Proceed | Mahjong | Instruction text |
| --- | --- | --- | --- | --- |
| FirstLeft (Blind) | Fewer than 3 tiles committed | Disabled | Conditional | "Charleston Blind Pass: Choose 3 tiles to pass using your rack, the blind incoming tiles, or both. Then press Proceed." |
| FirstLeft (Blind) | 3 tiles committed | Enabled | Conditional | "Charleston Blind Pass: Choose 3 tiles to pass using your rack, the blind incoming tiles, or both. Then press Proceed." |
| FirstLeft (Blind) | Pass submitted | Disabled | Conditional | "Charleston Blind Pass: Choose 3 tiles to pass using your rack, the blind incoming tiles, or both. Then press Proceed." |
| SecondRight (Blind) | Fewer than 3 tiles committed | Disabled | Conditional | "Charleston Blind Pass: Choose 3 tiles to pass using your rack, the blind incoming tiles, or both. Then press Proceed." |
| SecondRight (Blind) | 3 tiles committed | Enabled | Conditional | "Charleston Blind Pass: Choose 3 tiles to pass using your rack, the blind incoming tiles, or both. Then press Proceed." |
| SecondRight (Blind) | Pass submitted | Disabled | Conditional | "Charleston Blind Pass: Choose 3 tiles to pass using your rack, the blind incoming tiles, or both. Then press Proceed." |

#### Voting Stage

| Stage | Condition | Proceed | Mahjong | Instruction text |
| --- | --- | --- | --- | --- |
| VotingToContinue | 0 tiles staged, not yet voted | Enabled | Conditional | "Round vote. Stage up to 3 tiles to continue. Stage 0 tiles to stop. Press Proceed when ready." |
| VotingToContinue | 1–2 tiles staged | Disabled | Conditional | "Round vote. Stage up to 3 tiles to continue. Stage 0 tiles to stop. Press Proceed when ready." |
| VotingToContinue | 3 tiles staged, not yet voted | Enabled | Conditional | "Round vote. Stage up to 3 tiles to continue. Stage 0 tiles to stop. Press Proceed when ready." |
| VotingToContinue | Vote submitted | Disabled | Conditional | "Round vote. Stage up to 3 tiles to continue. Stage 0 tiles to stop. Press Proceed when ready." |

> Vote status copy ("You voted to STOP/CONTINUE", "{n}/4 players voted", "Waiting for {seats}...",
> bot vote message) is removed from the action pane and moved to the status bar. See Section 2.

#### Courtesy Pass

| Stage | Condition | Proceed | Mahjong | Instruction text |
| --- | --- | --- | --- | --- |
| CourtesyAcross | Valid tile count (0–3), not submitted | Enabled | Conditional | "Select 0–3 tiles to pass across, then press Proceed." |
| CourtesyAcross | Invalid tile count | Disabled | Conditional | "Select 0–3 tiles to pass across, then press Proceed." |
| CourtesyAcross | Pass submitted | Disabled | Conditional | "Courtesy pass submitted. Waiting for player across..." |

---

### Playing Phase

#### Drawing Stage

| Stage | Condition | Proceed | Mahjong | Instruction text |
| --- | --- | --- | --- | --- |
| Drawing | (any) | Disabled | Conditional | "Drawing tile..." |

#### Discarding Stage

| Stage | Condition | Proceed | Mahjong | Instruction text |
| --- | --- | --- | --- | --- |
| Discarding | My turn, no tile selected | Disabled | Conditional | "Select 1 tile to discard, then press Proceed. If you are Mahjong, press Mahjong." |
| Discarding | My turn, 1 tile selected | Enabled | Conditional | "Select 1 tile to discard, then press Proceed. If you are Mahjong, press Mahjong." |
| Discarding | Another player's turn | Disabled | Conditional | "Waiting for {player} to discard." |

#### Call Window

Claim status renders directly in the instruction text area. No card widget or card label.

| Claim state | Proceed | Mahjong | Instruction text |
| --- | --- | --- | --- |
| Can act — no tiles staged | Enabled | Conditional | "Press Proceed to pass, or add matching tiles to claim." |
| Can act — valid meld staged | Enabled | Conditional | "{MeldType} ready — Press Proceed to call {MeldType}." |
| Can act — invalid staged tiles | Disabled | Conditional | (validation error from engine, or "This staged claim cannot be called.") |
| Cannot act | — | — | (blank) |

#### Awaiting Mahjong

| Stage | Condition | Proceed | Mahjong | Instruction text |
| --- | --- | --- | --- | --- |
| AwaitingMahjong | (any) | Disabled | Conditional | "Waiting for {callerSeat} to confirm Mahjong" |

---

### Terminal and Waiting Phases

| Phase | Proceed | Mahjong | Instruction text |
| --- | --- | --- | --- |
| WaitingForPlayers | — | — | "Waiting for players to join" |
| Scoring | — | — | "Scoring hand..." |
| GameOver | — | — | "Game over" |

### Read-Only / Historical Mode

| Mode | Proceed | Mahjong | Message |
| --- | --- | --- | --- |
| readOnly = true | — | — | readOnlyMessage prop (default: "Historical View - No actions available") |

---

## 2. Status Bar Matrix

The status bar renders during **Charleston and Playing** phases and is visible in both live and
read-only modes.

> **Implementation note:** `GameplayStatusBar` currently renders only during Playing and hides
> when readOnly is true. Update to match the spec below. The Charleston timer bar already follows
> this pattern; the status bar should be consistent with it.

### Charleston Stages

Vote status copy moved from the action pane belongs here for VotingToContinue. Text for other
Charleston stages is TBD per stage name and direction.

| Stage | Condition | Status bar text |
| --- | --- | --- |
| VotingToContinue | Not yet voted | (TBD — stage label) |
| VotingToContinue | Voted Stop | "You voted to STOP — waiting for other players" |
| VotingToContinue | Voted Continue | "You voted to CONTINUE — waiting for other players" |
| VotingToContinue | Partial votes counted | "{n}/4 players voted" |
| VotingToContinue | Some players pending | "Waiting for {seats}..." |
| VotingToContinue | Bot vote received | (dynamic bot vote message from server) |
| All other Charleston stages | — | (TBD) |

### Playing Stages

| Turn stage | Condition | Status bar text |
| --- | --- | --- |
| Drawing | My seat is drawing | "Your turn — Drawing" |
| Drawing | Another player is drawing | "{player}'s turn — Drawing" |
| Discarding | My seat is discarding | "Your turn — Select a tile to discard" |
| Discarding | Another player is discarding | "Waiting for {player} to discard" |
| CallWindow | My seat is in `can_act` | "Call window open — Call or Pass" |
| CallWindow | My seat is not in `can_act` | "Call window open — Waiting for call resolution" |
| AwaitingMahjong | — | "Gameplay in progress" |
| Other / fallback | — | "Gameplay in progress" |

---

## 3. Change Resolution Summary

How each duplication case from the original audit is resolved:

| State | Resolution |
| --- | --- |
| Discarding — my turn | Acceptable. Both panes describe the same state in their own voice; no change. |
| Discarding — other player | Acceptable. Both panes are consistent; no change. |
| CallWindow — can act | Action pane shows dynamic claim status. Status bar shortened to "Call window open — Call or Pass". |
| CallWindow — cannot act | Action pane renders blank. Status bar shows "Call window open — Waiting for call resolution". |
| Charleston — after submit | Instruction text replaced with confirmation ("Passing X tiles..."). Post-submit waiting line removed. |
| VotingToContinue — voted | Vote status sub-messages removed from action pane and moved to status bar. |
