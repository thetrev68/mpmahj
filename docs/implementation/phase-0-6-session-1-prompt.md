# Phase 0.6 Session 1: Core Timer Implementation

## Context

You are implementing **Session 1 of Phase 0.6: Timer Behavior** for an American Mahjong game server written in Rust.

**Read the full implementation plan first:**
[docs/implementation/phase-0-6-timer-behavior-plan.md](../phase-0-6-timer-behavior-plan.md)

**Focus on:** The "Implementation Sessions > Session 1" section for your task checklist.

## Your Mission

Implement core timer functionality and fix all broken tests. This session gets the code compiling and all tests passing.

**Steps:** 0.6.1 - 0.6.6, 0.6.10 (see detailed instructions in the plan document)

**Key Points:**

1. **Timestamps use placeholder `0`** - Read the "Timestamp Strategy" section carefully. All `started_at_ms` fields should be set to `0` in the core crate.

2. **Charleston timer events need 7 locations** - Use grep to find all `CharlestonPhaseChanged` emissions and add `CharlestonTimerStarted` after each one.

3. **Breaking change** - `CharlestonState::new()` now requires a parameter. You must update 6 test calls and 1 production call (see step 0.6.10).

4. **Verify completion** - After implementation:
   - Run `cargo test --package mahjong_core` (must pass)
   - Run `grep -n "CharlestonTimerStarted" crates/mahjong_core/src/table/handlers/charleston.rs` (should show 7 emissions)

## Exit Criteria

- [ ] Code compiles without errors
- [ ] All `mahjong_core` tests pass
- [ ] Charleston timer events emitted at all 7 stage transitions (verified via grep)

## Working Style

- Follow the plan step-by-step (0.6.1 → 0.6.2 → 0.6.3 → etc.)
- Use the provided search patterns to locate code
- Check off items from the Session 1 checklist as you complete them
- Run tests frequently to catch issues early
- **Do NOT skip to Session 2 tasks** - focus only on Session 1

## When You're Done

Report:
1. Checklist completion status
2. Test results (`cargo test --package mahjong_core`)
3. Grep verification for Charleston timer events
4. Any issues or deviations from the plan

Ready? Start with step 0.6.1!
