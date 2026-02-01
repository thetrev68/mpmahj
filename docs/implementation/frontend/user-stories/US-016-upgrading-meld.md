# US-016: Upgrading Meld (Pung → Kong → Quint)

## Story

**As a** player on my turn
**I want** to add tiles to my exposed melds to upgrade them (Pung→Kong, Kong→Quint, Quint→Sextet)
**So that** I can progress toward patterns requiring larger melds

## Acceptance Criteria

### AC-1: Upgrade Opportunity Detected

**Given** it is my turn (Discarding stage)
**When** I have an exposed Pung of Dot5 (3 tiles)
**And** I have Dot5 in my concealed hand
**Then** the exposed Pung is highlighted as "upgradeable"
**And** a visual indicator appears: "Click to upgrade to Kong"

### AC-2: Initiate Upgrade

**Given** I have an upgradeable meld
**When** I click on the exposed Pung
**Then** a confirmation dialog appears: "Upgrade Pung to Kong with your 5 Dots?"
**And** my Dot5 tile is highlighted in my hand

### AC-3: Confirm Upgrade

**Given** the upgrade confirmation dialog is open
**When** I click "Confirm Upgrade"
**Then** an `AddToExposure { player: me, meld_index: 0, tile: Dot5 }` command is sent
**And** the dialog shows loading state

### AC-4: Upgrade Complete (Pung → Kong)

**Given** I sent the `AddToExposure` command
**When** the server emits `MeldUpgraded { player: me, meld_index: 0, new_meld_type: Kong }`
**Then** my Pung meld is upgraded to a Kong (4 tiles)
**And** my Dot5 is removed from my hand
**And** the Dot5 is added to the meld
**And** an animation plays (tile slides from hand to meld, 0.4s)
**And** the server emits `ReplacementDrawn { player: me, tile: Bam8, reason: Kong }`
**And** I draw a replacement tile (Bam8)
**And** my tile count remains 14

### AC-5: Upgrade Kong → Quint

**Given** I have an exposed Kong and a matching tile or Joker
**When** I upgrade to Quint
**Then** same process as AC-4, meld becomes Quint (5 tiles)
**And** I draw 1 replacement tile

### AC-6: Upgrade Quint → Sextet

**Given** I have an exposed Quint and a matching tile or Joker
**When** I upgrade to Sextet
**Then** the meld becomes Sextet (6 tiles)
**And** I draw 1 replacement tile (Sextet draws 2 total, but 1 already drawn for Quint)

### AC-7: Upgrade Before Discard

**Given** I upgraded a meld
**When** I drew the replacement tile
**Then** I am still in Discarding stage
**And** I can upgrade additional melds if available
**And** I must discard to complete my turn

### AC-8: Multiple Upgrades in One Turn

**Given** I have multiple upgradeable melds
**When** I upgrade one meld
**Then** other upgradeable melds remain highlighted
**And** I can upgrade them sequentially before discarding

## Technical Details

### Commands (Frontend → Backend)

````typescript
{
  AddToExposure: {
    player: Seat,
    meld_index: number,  // Index in my exposed melds array
    tile: Tile           // Tile being added from hand
  }
}
```text

### Events (Backend → Frontend)

```typescript
{
  kind: 'Public',
  event: {
    MeldUpgraded: {
      player: Seat,
      meld_index: number,
      new_meld_type: "Kong"  // or "Quint", "Sextet"
    }
  }
}

{
  kind: 'Private',
  event: {
    ReplacementDrawn: {
      player: Seat,
      tile: Tile,
      reason: "Kong"  // or "Quint"
    }
  }
}
```text

### Backend References

- **Rust Code**:
  - `crates/mahjong_core/src/command.rs` - `AddToExposure`
  - `crates/mahjong_core/src/event/public_events.rs` - `MeldUpgraded`
- **Game Design Doc**: Section 3.5 (Upgrading Melds)

## Components Involved

- **`<ExposedMeldsArea>`** - Shows upgradeable melds
- **`<UpgradeIndicator>`** - Highlights upgradeable melds
- **`<UpgradeConfirmationDialog>`** - Confirmation dialog
- **`<UpgradeAnimationLayer>`** - Tile addition animation

**Component Specs:**

- `component-specs/presentational/UpgradeIndicator.md` (NEW)
- `component-specs/presentational/UpgradeConfirmationDialog.md` (NEW)

## Test Scenarios

- **`tests/test-scenarios/meld-upgrade-pung-to-kong.md`**
- **`tests/test-scenarios/meld-upgrade-kong-to-quint.md`**
- **`tests/test-scenarios/meld-upgrade-multiple.md`**

## Edge Cases

### EC-1: Replacement Draw After Kong/Quint

Kong and Quint trigger 1 replacement draw each.

### EC-2: Joker Can Upgrade Meld

Can use Joker to upgrade if meld allows Jokers.

### EC-3: Cannot Upgrade Pair Melds

Some patterns have pairs (2 tiles); these cannot be upgraded.

### EC-4: Only During Discarding Stage

Cannot upgrade during Drawing stage.

## Related User Stories

- **US-013**: Calling Pung/Kong/Quint - Creates initial exposed melds
- **US-010**: Discarding a Tile - Must discard after upgrades

## Accessibility Considerations

### Keyboard Navigation

- **U Key**: Focus on upgradeable melds
- **Enter**: Initiate upgrade
- **Escape**: Cancel upgrade dialog

### Screen Reader

- **Upgradeable**: "Exposed Pung of 5 Dots is upgradeable to Kong with your 5 Dots."
- **Upgraded**: "Upgraded Pung to Kong. Drew replacement tile: 8 Bamboo."

### Visual

- **High Contrast**: Upgradeable melds have pulsing border
- **Animation**: Clear tile movement from hand to meld

## Priority

**HIGH** - Important strategic mechanic

## Story Points / Complexity

**5** - Medium-High complexity

- Detect upgradeable melds
- Confirmation dialog
- Upgrade animation
- Replacement draw logic
- Multiple meld types (Pung/Kong/Quint/Sextet)

## Definition of Done

- [ ] Upgradeable melds highlighted during Discarding stage
- [ ] Click meld opens confirmation dialog
- [ ] Confirm sends `AddToExposure` command
- [ ] `MeldUpgraded` event updates meld
- [ ] Tile removed from hand, added to meld
- [ ] Upgrade animation plays
- [ ] Replacement draw for Kong/Quint
- [ ] Still in Discarding stage after upgrade
- [ ] Can upgrade multiple melds per turn
- [ ] Component tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Code reviewed and approved

## Notes for Implementers

### Detecting Upgradeable Melds

```typescript
function findUpgradeableMelds(myExposedMelds: Meld[], myHand: Tile[]): UpgradeOpportunity[] {
  return myExposedMelds.flatMap((meld, index) => {
    const baseTile = meld.getBaseTile();
    const canAdd = myHand.filter((t) => t === baseTile || t === 'Joker');

    if (meld.type === 'Pung' && canAdd.length > 0) {
      return [{ meldIndex: index, upgrade: 'Kong', tiles: canAdd }];
    } else if (meld.type === 'Kong' && canAdd.length > 0) {
      return [{ meldIndex: index, upgrade: 'Quint', tiles: canAdd }];
    } else if (meld.type === 'Quint' && canAdd.length > 0) {
      return [{ meldIndex: index, upgrade: 'Sextet', tiles: canAdd }];
    }
    return [];
  });
}
```text

### Replacement Draw Count

- **Pung → Kong**: 1 replacement
- **Kong → Quint**: 1 replacement (cumulative: 2 total)
- **Quint → Sextet**: 1 replacement (cumulative: 3 total, but draws happen incrementally)

### Zustand Store Updates

```typescript
case 'MeldUpgraded':
  state.exposedMelds[event.player][event.meld_index].type = event.new_meld_type;
  // Tile already removed from hand by AddToExposure
  break;

case 'ReplacementDrawn':
  if (event.player === mySeat) {
    state.yourHand.push(event.tile);
    state.yourHand = sortHand(state.yourHand);
  }
  break;
```text

```text

```text
````
