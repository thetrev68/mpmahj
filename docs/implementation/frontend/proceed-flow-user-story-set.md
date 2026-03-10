# Proceed-Flow Implementation Story Set

**Status:** Proposed
**Source docs:** [proceed-driven-action-flow-spec.md](C:/Repos/mpmahj/docs/implementation/frontend/proceed-driven-action-flow-spec.md), [layout-polish-plan.md](C:/Repos/mpmahj/docs/implementation/frontend/layout-polish-plan.md)

---

## Purpose

This document converts the proceed-driven interaction spec into an implementation story set and explicitly folds in the overlapping layout work from `layout-polish-plan.md`.

The intent is to avoid building the new interaction model on top of geometry that is already known to be too cramped or poorly positioned.

---

## Product Outcome

The finished gameplay flow should feel like this:

1. The player reads one clear instruction area.
2. The player stages tiles visually.
3. The player presses one dominant `Proceed` button.
4. `Mahjong` remains separate and prominent.
5. Utility controls stay out of the main decision flow.

---

## Story Sequence

### US-046: Proceed-First Action Bar

Primary outcome:

- Replace multi-button action language with one instruction-led `Proceed` flow for Charleston and discard turns.

Depends on:

- existing action-bar instruction work from US-039

### US-047: Selection-Driven Calling Without Modal

Primary outcome:

- Remove the modal call window and move discard-response flow into the rack + staging + `Proceed` model.

Depends on:

- US-046

### US-048: Layout Support + Rack-Local Utilities

Primary outcome:

- Make the board geometry and local rack controls support the proceed/staging model cleanly.

Depends on:

- can be started in parallel where changes are layout-only
- must land before final polishing of US-047

---

## Layout Plan Overlap

The following items from `layout-polish-plan.md` should be treated as supporting work for the proceed-flow migration instead of separate unrelated cleanup:

- left-anchored board layout
- flush alignment of side opponent racks
- widened staging area so 6 tiles fit in one row
- removal of Charleston-specific settings clutter
- repurposing settings affordances toward gameplay utilities

The tile artwork cleanup item is unrelated to proceed flow and should remain independent.

---

## Scope Boundaries

Included in this batch:

- `Proceed` as the dominant primary CTA
- instruction-led Charleston
- instruction-led discard flow
- staging-driven claim flow
- removal of the modal call window
- moving `Sort` out of the action bar and onto the rack edge
- TODO capture for future `Auto-sort hand`

Not included in this batch:

- backend command redesign
- new history/undo behavior
- hint engine changes
- branching replay/history

---

## Story Files

- [US-046-proceed-first-action-bar.md](C:/Repos/mpmahj/docs/implementation/frontend/user-stories/US-046-proceed-first-action-bar.md)
- [US-047-selection-driven-calling-without-modal.md](C:/Repos/mpmahj/docs/implementation/frontend/user-stories/US-047-selection-driven-calling-without-modal.md)
- [US-048-layout-support-and-rack-local-utilities.md](C:/Repos/mpmahj/docs/implementation/frontend/user-stories/US-048-layout-support-and-rack-local-utilities.md)

---

## Recommended Delivery Order

1. Land US-048 layout prerequisites that unblock the new staging-heavy flow.
2. Land US-046 to establish the new `Proceed` mental model.
3. Land US-047 to remove the old call modal and finish the new gameplay interaction loop.

This order keeps the UI stable while the claim-flow rewrite is in progress.
