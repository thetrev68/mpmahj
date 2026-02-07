# US-005 Charleston Voting - Implementation Scope

**Status:** ⏳ Awaiting Approval
**Created:** 2026-02-06

## Summary

Implement Charleston voting phase where players vote to Stop or Continue Charleston after FirstLeft pass completes. Any Stop vote ends Charleston; unanimous Continue votes trigger Second Charleston.

## Components to Create

### New Components
- [ ] `VotingPanel.tsx` - Stop/Continue buttons, vote progress UI
- [ ] `VotingPanel.test.tsx` - Component tests
- [ ] `VoteResultOverlay.tsx` - Vote result display with breakdown
- [ ] `VoteResultOverlay.test.tsx` - Component tests

### Components to Update
- [ ] `CharlestonTracker.tsx` - Display "VotingToContinue" stage
- [ ] `CharlestonTracker.test.tsx` - Update tests for voting stage
- [ ] `GameBoard.tsx` - Handle voting events, orchestrate voting UI
- [ ] `GameBoard.test.tsx` - Update integration tests
- [ ] `ActionBar.tsx` - No changes needed (voting uses separate panel)

## State Management

### GameBoard New State
- [ ] `votingState: { hasVoted: boolean, voteCount: number, myVote: CharlestonVote | null }`
- [ ] `voteResult: { result: CharlestonVote, breakdown: Record<Seat, CharlestonVote> } | null`
- [ ] `showVoteResultOverlay: boolean`

### PlayerStatus Updates
- [ ] Add `hasVoted: boolean` flag per player (for checkmarks)

## Events to Handle (GameBoard)

- [ ] `CharlestonPhaseChanged { stage: "VotingToContinue" }` - Enter voting phase
- [ ] `CharlestonTimerStarted { stage: "VotingToContinue", duration: 30, ... }` - Start 30s timer
- [ ] `PlayerVoted { player: Seat }` - Track vote progress
- [ ] `VoteResult { result: "Stop" | "Continue" }` - Show result overlay
- [ ] `CharlestonComplete` - Charleston ends if Stop
- [ ] `CharlestonPhaseChanged { stage: "SecondLeft" }` - Second Charleston starts if Continue

## Commands to Send

- [ ] `VoteCharleston { player: mySeat, vote: "Stop" | "Continue" }`

## Acceptance Criteria Checklist

### AC-1: Voting Phase Entry
- [ ] Charleston tracker displays "Vote: Stop or Continue?"
- [ ] Timer starts at 30 seconds
- [ ] Two buttons appear: "Stop Charleston" and "Continue Charleston"
- [ ] Message: "Vote now - any Stop vote ends Charleston"
- [ ] Hand visible but non-interactive

### AC-2: Vote Submission (Stop)
- [ ] Click "Stop Charleston" sends `VoteCharleston { vote: "Stop" }`
- [ ] Button shows loading state (spinner, disabled)
- [ ] Both buttons disabled after vote
- [ ] Message: "You voted to STOP. Waiting for other players..."
- [ ] Checkmark appears next to my name

### AC-3: Vote Submission (Continue)
- [ ] Click "Continue Charleston" sends `VoteCharleston { vote: "Continue" }`
- [ ] Button shows loading state (spinner, disabled)
- [ ] Both buttons disabled after vote
- [ ] Message: "You voted to CONTINUE. Waiting for other players..."
- [ ] Checkmark appears next to my name

### AC-4: Vote Progress Tracking
- [ ] `PlayerVoted` events update progress
- [ ] Progress indicator shows "3/4 players voted"
- [ ] Message updates: "Waiting for [PlayerName]..."
- [ ] Cannot see HOW others voted (just that they voted)

### AC-5: Vote Result (Stop - Any Stop Vote)
- [ ] Server emits `VoteResult { result: "Stop" }`
- [ ] Vote UI dismisses
- [ ] Message: "Charleston STOPPED by vote. Main game starting..."
- [ ] `CharlestonComplete` event received
- [ ] Phase advances to `Playing`

### AC-6: Vote Result (Continue - Unanimous)
- [ ] All 4 players voted "Continue"
- [ ] Server emits `VoteResult { result: "Continue" }`
- [ ] Vote UI dismisses
- [ ] Message: "Charleston CONTINUES - Second Charleston starting..."
- [ ] `CharlestonPhaseChanged { stage: "SecondLeft" }` received
- [ ] Timer resets for next pass (60 seconds)

### AC-7: Early Vote Resolution (Optimization)
- [ ] Backend handles early resolution (frontend just responds to events)
- [ ] Vote UI dismisses gracefully if result arrives early

### AC-8: Timer Expiry (Auto-Vote)
- [ ] ❌ **OUT OF SCOPE** - No auto-vote on timer expiry per user clarification
- [ ] Timer is for reference and notification only
- [ ] Backend will handle any timeout behavior

### AC-9: Bot Auto-Vote
- [ ] Bots vote automatically (backend-handled)
- [ ] See "PlayerName (Bot) has voted" message
- [ ] **DEFERRED** - Bot vote messages not in scope (backend feature)

### AC-10: Vote Display After Result
- [ ] ⚠️ **SIMPLIFIED** - Backend doesn't expose individual votes in `VoteResult` event
- [ ] Can show final result: "Charleston STOPPED" or "Charleston CONTINUES"
- [ ] Cannot show per-seat breakdown (backend clears votes before sending result)
- [ ] UI displays for 3 seconds before auto-dismissing
- [ ] **Alternative**: Show vote count "X players voted" (track locally from `PlayerVoted` events)

## Edge Cases to Test

### EC-1: Timer Expiry (Auto-Stop)
- [ ] ❌ **OUT OF SCOPE** - No auto-vote behavior (per user clarification) without vote

### EC-2: Any Stop Vote Ends Charleston
- [ ] 3 Continue + 1 Stop = Stop result

### EC-3: Unanimous Continue Required
- [ ] All 4 Continue = Continue result
- [ ] Any Stop = Stop result

### EC-4: Early Vote Resolution
- [ ] UI handles early result gracefully

### EC-5: Disconnection During Voting
- [ ] **DEFERRED** - Reconnection logic out of scope
- [ ] Note: Will handle gracefully by server state sync

### EC-6: Double-Submit Prevention
- [ ] Button disabled after first click
- [ ] Only one command sent

### EC-7: Network Error on Vote
- [ ] **DEFERRED** - Network retry logic out of scope for this story
- [ ] Note: Basic error handling via CommandRejected event

## Accessibility (In Scope)

- [ ] Keyboard navigation: Tab between buttons
- [ ] Space/Enter submits vote
- [ ] **DEFERRED** - Keyboard shortcuts (S/C keys) - future enhancement
- [ ] ARIA labels on vote buttons
- [ ] Screen reader announcements for vote progress

## Out of Scope (Explicitly Deferred)

- ❌ **Auto-vote on timer expiry** (AC-8, EC-1) - Timer is reference only per user
- ❌ **Individual vote breakdown** (AC-10) - Backend doesn't expose, would need backend update
- ❌ Bot vote strategy display (backend-only)
- ❌ Network retry logic (US-002 EC-5 pattern not yet implemented)
- ❌ Keyboard shortcuts (S/C keys)
- ❌ Reconnection state sync (will rely on server state restoration)
- ❌ Vote result animation timing (will use instant mode for now)

## Test Files to Create/Update

### New Test Files
- [ ] `VotingPanel.test.tsx` - Component unit tests
- [ ] `VoteResultOverlay.test.tsx` - Component unit tests
- [ ] `charleston-voting.integration.test.tsx` - Full voting flow

### Update Existing Tests
- [ ] `CharlestonTracker.test.tsx` - Add VotingToContinue stage test
- [ ] `GameBoard.integration.test.tsx` - Add voting phase tests

### Test Fixtures to Create
- [ ] `game-states/charleston-voting.json` - State after FirstLeft
- [ ] `event-sequences/charleston-vote-stop.json` - Stop vote flow
- [ ] `event-sequences/charleston-vote-continue.json` - Continue vote flow

## Implementation Order

1. **Phase 1: Core Voting UI** (VotingPanel)
   - Create VotingPanel component with Stop/Continue buttons
   - Implement vote submission and loading states
   - Add unit tests

2. **Phase 2: Vote Result Display** (VoteResultOverlay)
   - Create VoteResultOverlay with breakdown display
   - Implement 3-second auto-dismiss
   - Add unit tests

3. **Phase 3: GameBoard Integration**
   - Handle voting events in GameBoard
   - Update player status tracking
   - Wire up voting UI rendering
   - Add integration tests

4. **Phase 4: CharlestonTracker Updates**
   - Update to show VotingToContinue stage
   - Update tests

5. **Phase 5: Timer Expiry**
   - Implement auto-vote logic when timer expires
   - Test timer expiry behavior

6. **Phase 6: Full Integration Test**
   - End-to-end voting scenarios (Stop/Continue)
   - Vote progress tracking
   - Result resolution

## Success Criteria

- ✅ All 10 ACs pass with tests
- ✅ All EC tests pass (EC-1 through EC-4, EC-6)
- ✅ Component tests pass for new components
- ✅ Integration tests pass for voting flow
- ✅ No TypeScript errors
- ✅ No console warnings
- ✅ Prettier formatting applied
- ✅ Follows existing patterns (useTileSelection, ActionBar structure)

## Questions/Clarifications

1. **Vote reveal timing**: US-005 AC-10 says individual votes are revealed after result
   - **Issue Found**: Backend tracks votes in `HashMap<Seat, CharlestonVote>` but clears them before sending `VoteResult`
   - **Decision**: Frontend cannot show individual votes (only final result). Need backend update to include votes in event, or simplify AC-10
   - **Implementation**: Show result message without per-seat breakdown
   - **TODO**: 🔧 Backend enhancement needed - Add `votes: HashMap<Seat, CharlestonVote>` to `VoteResult` event before clearing in `vote_charleston()` handler (crates/mahjong_core/src/table/handlers/charleston.rs:452)

2. **Timer expiry behavior**: AC-8 says "automatic Stop vote is cast"
   - **User Clarification**: NO auto-vote on timer expiry. Timer is for reference only.
   - **Decision**: AC-8 and EC-1 marked OUT OF SCOPE. Backend handles timeout.

3. **Bot vote messages**: AC-9 mentions bot vote messages but no event for this in bindings
   - **Decision**: Deferred - bots use same `PlayerVoted` event as humans

## Estimated Complexity

**Story Points:** 5 (Medium-High)
- Two new components with tests
- Complex state tracking (4 players voting)
- Timer integration
- Event sequencing (vote → result → phase change)
- Result overlay with auto-dismiss

---

**Ready for Review:** Please approve this scope before I begin implementation.
