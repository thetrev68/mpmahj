# TODO: Backend Enhancement - Charleston Vote Details

**Priority:** Medium
**Component:** Backend (mahjong_core)
**Related US:** US-005 Charleston Voting
**Created:** 2026-02-06

## Issue

Frontend cannot display individual vote breakdown (AC-10 requirement: "East: Stop, South: Continue, West: Stop, North: Stop") because backend clears votes before emitting the result.

## Current Behavior

```rust
// crates/mahjong_core/src/table/handlers/charleston.rs:443-455
pub fn vote_charleston(table: &mut Table, player: Seat, vote: CharlestonVote) -> Vec<Event> {
    let mut events = vec![Event::Public(PublicEvent::PlayerVoted { player })];

    if let Some(charleston) = &mut table.charleston_state {
        charleston.votes.insert(player, vote);

        if charleston.voting_complete() {
            if let Some(result) = charleston.vote_result() {
                events.push(Event::Public(PublicEvent::VoteResult { result }));

                // ❌ Votes cleared BEFORE frontend can see them
                charleston.votes.clear();

                // ... rest of handler
            }
        }
    }
    events
}
```

## Proposed Solution

Update `VoteResult` event to include individual vote breakdown:

### 1. Update Event Definition

```rust
// crates/mahjong_core/src/event/public_events.rs
pub enum PublicEvent {
    // ... existing events

    VoteResult {
        result: CharlestonVote,
        /// Individual votes by seat for display purposes
        votes: HashMap<Seat, CharlestonVote>,
    },

    // ... rest of events
}
```

### 2. Update Handler

```rust
// crates/mahjong_core/src/table/handlers/charleston.rs:452
if let Some(result) = charleston.vote_result() {
    // ✅ Clone votes BEFORE clearing
    let votes = charleston.votes.clone();

    events.push(Event::Public(PublicEvent::VoteResult {
        result,
        votes,
    }));

    // Now safe to clear
    charleston.votes.clear();

    // ... rest of handler
}
```

### 3. Update TypeScript Bindings

After Rust changes, regenerate bindings:

```bash
cd crates/mahjong_core
cargo test export_bindings
```

Verify `apps/client/src/types/bindings/generated/PublicEvent.ts` includes:

```typescript
{ "VoteResult": {
    result: CharlestonVote,
    votes: Record<Seat, CharlestonVote>
} }
```

### 4. Update Frontend (US-005)

Once backend is updated, enhance `VoteResultOverlay` to show breakdown:

```typescript
// VoteResultOverlay.tsx
const breakdown = Object.entries(votes)
  .map(([seat, vote]) => `${seat}: ${vote}`)
  .join(', ');

// Display: "East: Stop, South: Continue, West: Stop, North: Stop"
```

## Impact

- **Backend files affected:**
  - `crates/mahjong_core/src/event/public_events.rs`
  - `crates/mahjong_core/src/table/handlers/charleston.rs`
  - TypeScript bindings regeneration
- **Frontend files affected:**
  - `apps/client/src/components/game/VoteResultOverlay.tsx`
  - `apps/client/src/components/game/GameBoard.tsx` (event handling)
- **Tests to update:**
  - `crates/mahjong_core/src/flow/charleston/tests.rs` (vote result assertions)
  - `apps/client/src/components/game/VoteResultOverlay.test.tsx`

## Acceptance Criteria

- [ ] `VoteResult` event includes `votes: HashMap<Seat, CharlestonVote>`
- [ ] Votes emitted before being cleared
- [ ] TypeScript bindings reflect new event shape
- [ ] Backend tests pass with updated event
- [ ] Frontend can display: "3 Stop, 1 Continue - Charleston STOPPED"
- [ ] Frontend can display: "East: Stop, South: Continue, West: Stop, North: Stop"

## Notes

- This enhancement is **non-breaking** for existing clients (they can ignore `votes` field)
- Votes are already tracked in `CharlestonState.votes`, just need to expose them
- No performance impact (HashMap clone is negligible for 4 entries)

---

**Status:** Done
**Assignee:** Gemini
**Completed:** 2026-02-07

## Implementation Details

- **Backend:**
  - Updated `PublicEvent::VoteResult` to include `votes: HashMap<Seat, CharlestonVote>`
  - Updated `vote_charleston` handler to capture and send votes before clearing
  - Verified with `crates/mahjong_core/tests/charleston_voting.rs` (passed)
- **Frontend:**
  - Regenerated TypeScript bindings
  - Updated `VoteResultOverlay.tsx` to display seat breakdown
  - Updated `GameBoard.tsx` to handle new event payload
  - Updated `VoteResultOverlay.test.tsx` to verify breakdown display (all tests passed)
