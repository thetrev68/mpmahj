# US-016: Upgrading Meld (Pung → Kong → Quint)

## Story

**As a** player on my turn
**I want** to add tiles to my exposed melds to upgrade them (Pung→Kong, Kong→Quint, Quint→Sextet)
**So that** I can progress toward patterns requiring larger melds

## Acceptance Criteria

### AC-1: Upgrade Opportunity Detected

**Given** it is my turn (Discarding stage, after drawing)
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
**And** I remain in the Discarding stage with 14 total tiles (including exposures)

### AC-5: Upgrade Kong → Quint

**Given** I have an exposed Kong and a matching tile or Joker
**When** I upgrade to Quint
**Then** same process as AC-4, meld becomes Quint (5 tiles)
**And** I remain in the Discarding stage

### AC-6: Upgrade Quint → Sextet

**Given** I have an exposed Quint and a matching tile or Joker
**When** I upgrade to Sextet
**Then** the meld becomes Sextet (6 tiles)
**And** I remain in the Discarding stage

### AC-7: Upgrade Before Discard

**Given** I upgraded a meld
**When** the upgrade animation completes
**Then** I am still in Discarding stage
**And** I can upgrade additional melds if available
**And** I must discard to complete my turn (returning to 13 tiles)

### AC-8: Multiple Upgrades in One Turn

**Given** I have multiple upgradeable melds
**When** I upgrade one meld
**Then** other upgradeable melds remain highlighted
**And** I can upgrade them sequentially before discarding

## Technical Details

### Commands (Frontend → Backend)

```typescript
{
  AddToExposure: {
    player: Seat,
    meld_index: number,  // Index in my exposed melds array
    tile: Tile           // Tile being added from hand
  }
}
```

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
```

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

- `component-specs/presentational/UpgradeIndicator.md`
- `component-specs/presentational/UpgradeConfirmationDialog.md`

## Test Scenarios

- **`tests/test-scenarios/meld-upgrade-pung-to-kong.md`**
- **`tests/test-scenarios/meld-upgrade-kong-to-quint.md`**
- **`tests/test-scenarios/meld-upgrade-multiple.md`**

## Edge Cases

### EC-1: Joker Can Upgrade Meld

Can use Joker to upgrade if meld allows Jokers.

### EC-2: Cannot Upgrade Pair Melds

Some patterns have pairs (2 tiles); these cannot be upgraded.

### EC-3: Only During Discarding Stage

Cannot upgrade during Drawing stage (must have 14 tiles).

## Related User Stories

- **US-013**: Calling Pung/Kong/Quint - Creates initial exposed melds
- **US-010**: Discarding a Tile - Must discard after upgrades
- **US-009**: Drawing a Tile - Turn start

## Accessibility Considerations

### Keyboard Navigation

- **U Key**: Focus on upgradeable melds
- **Enter**: Initiate upgrade
- **Escape**: Cancel upgrade dialog

### Screen Reader

- **Upgradeable**: "Exposed Pung of 5 Dots is upgradeable to Kong with your 5 Dots."
- **Upgraded**: "Upgraded Pung to Kong."

### Visual

- **High Contrast**: Upgradeable melds have pulsing border
- **Animation**: Clear tile movement from hand to meld

## Priority

**HIGH** - Important strategic mechanic

## Story Points / Complexity

**4** - Medium complexity

- Detect upgradeable melds
- Confirmation dialog
- Upgrade animation
- Multiple meld types (Pung/Kong/Quint/Sextet)

## Definition of Done

- [ ] Upgradeable melds highlighted during Discarding stage
- [ ] Click meld opens confirmation dialog
- [ ] Confirm sends `AddToExposure` command
- [ ] `MeldUpgraded` event updates meld
- [ ] Tile removed from hand, added to meld
- [ ] Upgrade animation plays
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
```

### Hand Size Consistency

Upgrading a meld moves a tile from the hand to the exposure. The total number of tiles (hand + exposures) remains 14 until the player discards.

### Zustand Store Updates

```typescript
case 'MeldUpgraded':
  state.exposedMelds[event.player][event.meld_index].type = event.new_meld_type;
  // Tile already removed from hand by AddToExposure or local state update
  break;
```

```text

```

```text

```
