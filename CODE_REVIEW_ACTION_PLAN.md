# Code Review Action Plan

**Created**: January 17, 2026
**Based On**: [CODE_REVIEW_REPORT.md](CODE_REVIEW_REPORT.md)
**Status**: Ready for Implementation

---

## Overview

This action plan addresses the findings from the comprehensive backend code review. Issues are prioritized by severity and organized into implementation phases.

**Total Issues**: 9 (1 Critical, 4 High Priority, 2 Medium Priority, 2 Low Priority)
**Estimated Total Effort**: 12-16 hours

---

## Phase 1: Critical Security Fixes (IMMEDIATE)

**Timeline**: Complete within 24 hours
**Estimated Effort**: 20 minutes total

### 1.1 Fix CORS Configuration 🔴 CRITICAL

**Issue**: CORS allows ANY origin, creating CSRF vulnerability
**Location**: [crates/mahjong_server/src/main.rs:144-147](crates/mahjong_server/src/main.rs#L144-L147)
**Impact**: Security vulnerability - CSRF attacks possible from any domain

**Implementation**:

```rust
// Before (INSECURE)
CorsLayer::new()
    .allow_origin(Any)
    .allow_methods(Any)
    .allow_headers(Any)

// After (SECURE)
use tower_http::cors::AllowOrigin;

let allowed_origins = std::env::var("ALLOWED_ORIGINS")
    .unwrap_or_else(|_| "http://localhost:5173,http://localhost:1420".to_string());

let origins: Vec<HeaderValue> = allowed_origins
    .split(',')
    .filter_map(|s| s.trim().parse().ok())
    .collect();

CorsLayer::new()
    .allow_origin(AllowOrigin::list(origins))
    .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
    .allow_headers([AUTHORIZATION, CONTENT_TYPE, ACCEPT])
    .allow_credentials(true)
    .max_age(Duration::from_secs(3600))
```

**Environment Variables**:

- Development: `ALLOWED_ORIGINS="http://localhost:5173,http://localhost:1420"`
- Production: `ALLOWED_ORIGINS="https://yourdomain.com,https://app.yourdomain.com"`

**Testing**:

- Verify frontend can connect from allowed origins
- Verify blocked from disallowed origins
- Test preflight OPTIONS requests

**Files to Modify**:

- [crates/mahjong_server/src/main.rs](crates/mahjong_server/src/main.rs)
- [README.md](README.md) - Add CORS configuration documentation

**Effort**: 15 minutes

---

### 1.2 Add RwLock Poisoning Protection 🟡 HIGH

**Issue**: RwLock unwrap() can cause cascading failures
**Location**: [crates/mahjong_server/src/auth.rs:70, 83](crates/mahjong_server/src/auth.rs#L70)
**Impact**: If panic occurs while lock held, all subsequent calls panic

**Implementation**:

```rust
// Before
let mut lock = self.decoding_key.write().unwrap();

// After
let mut lock = self.decoding_key
    .write()
    .expect("JWT decoding key lock poisoned - critical auth failure");

// Add monitoring hook (future enhancement)
if self.decoding_key.is_poisoned() {
    tracing::error!("JWT decoding key lock poisoned - restarting auth module");
    // Trigger alert/monitoring
}
```

**Files to Modify**:

- [crates/mahjong_server/src/auth.rs](crates/mahjong_server/src/auth.rs)

**Effort**: 5 minutes

---

## Phase 2: High Priority Stability Fixes

**Timeline**: Complete within 1 week
**Estimated Effort**: 3-5 hours total

### 2.1 Add Automatic Session Cleanup 🟡 HIGH

**Issue**: Session storage grows unbounded without cleanup
**Location**: [crates/mahjong_server/src/network/session.rs](crates/mahjong_server/src/network/session.rs)
**Impact**: Memory leak potential over time

**Implementation**:

```rust
// In main.rs, spawn background cleanup task
tokio::spawn({
    let session_store = Arc::clone(&session_store);
    async move {
        let mut interval = tokio::time::interval(Duration::from_secs(60));
        loop {
            interval.tick().await;
            let cleaned = session_store.cleanup_expired();
            if cleaned > 0 {
                tracing::debug!("Cleaned up {} expired sessions", cleaned);
            }
        }
    }
});
```

**Enhancements**:

- Make cleanup interval configurable via environment variable
- Add metrics/logging for monitoring
- Expose cleanup stats via admin endpoint

**Files to Modify**:

- [crates/mahjong_server/src/main.rs](crates/mahjong_server/src/main.rs)
- [crates/mahjong_server/src/network/session.rs](crates/mahjong_server/src/network/session.rs) - Update cleanup_expired() to return count

**Testing**:

- Integration test: Create sessions, wait for expiry, verify cleanup
- Load test: Verify memory stability over time

**Effort**: 30 minutes

---

### 2.2 Replace unwrap() with Proper Error Handling 🟡 HIGH

**Issue**: ~70 unwrap/expect calls can cause panics in production
**Locations**: Multiple files (see below)
**Impact**: Server crashes on unexpected input

**Strategy**: Systematic replacement in priority order

#### 2.2.1 Critical Path: Validation Module

**File**: [crates/mahjong_core/src/table/validation.rs](crates/mahjong_core/src/table/validation.rs)

**High-Risk Unwraps**:

```rust
// Line 103 - Player lookup
// Before
let player_obj = table.get_player(*player).unwrap();

// After
let player_obj = table.get_player(*player)
    .ok_or(ValidationError::PlayerNotFound(*player))?;
```

**Add Error Variant**:

```rust
// In command.rs or validation error module
#[derive(Debug, thiserror::Error)]
pub enum ValidationError {
    // ... existing variants
    #[error("Player {0:?} not found in table")]
    PlayerNotFound(PlayerId),
}
```

**Effort**: 1 hour

#### 2.2.2 Charleston Module

**File**: [crates/mahjong_core/src/table/charleston.rs](crates/mahjong_core/src/table/charleston.rs)

**High-Risk Unwraps**:

```rust
// Lines 49-52 - Charleston stage advancement
// Before
let next_stage = charleston.stage.next(None).unwrap();

// After
let next_stage = charleston.stage.next(None)
    .ok_or(CommandError::CharlestonInvalidStateTransition)?;
```

**Effort**: 45 minutes

#### 2.2.3 Call Resolution Module

**File**: [crates/mahjong_core/src/table/call_resolution.rs](crates/mahjong_core/src/table/call_resolution.rs)

**High-Risk Unwraps**:

```rust
// Line 85 - Intent priority resolution
// Before
let highest = intents.iter().map(|i| i.priority()).max().unwrap();

// After
let highest = intents.iter()
    .map(|i| i.priority())
    .max()
    .ok_or(CommandError::NoValidCallIntents)?;
```

**Effort**: 30 minutes

#### 2.2.4 AI Bot Module

**File**: [crates/mahjong_ai/src/bot/basic.rs](crates/mahjong_ai/src/bot/basic.rs)

**High-Risk Unwraps**:

```rust
// Line 62 - File I/O
// Before
let card_json = std::fs::read_to_string("data/cards/unified_card2025.json")
    .expect("Failed to load card JSON");

// After
let card_json = std::fs::read_to_string("data/cards/unified_card2025.json")
    .map_err(|e| BotError::CardLoadFailed(e.to_string()))?;
```

**Note**: Consider using `include_str!()` for embedded card data to eliminate runtime file I/O.

**Effort**: 30 minutes

#### 2.2.5 Remaining Unwraps (Lower Priority)

**Strategy**: Create tracking issue, replace incrementally

- Audit all remaining unwrap() calls: `rg "\.unwrap\(\)" --type rust`
- Categorize by risk (hot path vs cold path)
- Replace in batches during regular development

**Effort**: 1-2 hours spread over time

**Total Effort for 2.2**: 3-4 hours

---

## Phase 3: Medium Priority Technical Debt

**Timeline**: Complete within 1 month
**Estimated Effort**: 5-7 hours total

### 3.1 Replace Unsafe MCTS Pointers 🟡 MEDIUM

**Issue**: Raw pointer manipulation in MCTS engine
**Location**: [crates/mahjong_ai/src/mcts/engine.rs:166-197](crates/mahjong_ai/src/mcts/engine.rs#L166-L197)
**Impact**: Maintenance burden, potential unsoundness

**Current Code**:

```rust
unsafe {
    let child_ptr = &mut node.children[best_idx] as *mut MCTSNode;
    node = &mut *child_ptr;
}
```

**Proposed Solution**: Arena-based allocation

```rust
// Using typed-arena or bumpalo crate
use typed_arena::Arena;

pub struct MCTSEngine {
    arena: Arena<MCTSNode>,
    // ... existing fields
}

// Tree traversal becomes safe
let child_idx = node.children[best_idx];
node = &mut self.arena[child_idx];
```

**Alternative**: Use indices instead of pointers

```rust
struct MCTSNode {
    children: Vec<usize>,  // Indices into engine.nodes
    // ... other fields
}

struct MCTSEngine {
    nodes: Vec<MCTSNode>,
    root: usize,
}
```

**Testing**:

- Verify MCTS performance unchanged
- Run AI benchmark suite
- Check for memory leaks

**Dependencies**:

- Add `typed-arena = "2.0"` or `bumpalo = "3.14"` to Cargo.toml

**Files to Modify**:

- [crates/mahjong_ai/src/mcts/engine.rs](crates/mahjong_ai/src/mcts/engine.rs)
- [crates/mahjong_ai/Cargo.toml](crates/mahjong_ai/Cargo.toml)

**Effort**: 2-3 hours

---

### 3.2 Refactor Complex Functions 🟡 MEDIUM

**Issue**: Long functions reduce maintainability
**Impact**: Hard to test, hard to understand

#### 3.2.1 Charleston::pass_tiles()

**File**: [crates/mahjong_core/src/table/charleston.rs](crates/mahjong_core/src/table/charleston.rs)
**Current**: ~150 lines with nested if-lets

**Refactoring Plan**:

```rust
// Split into smaller functions
fn pass_tiles(&mut self, ...) -> Result<Vec<Event>, CommandError> {
    let removed = self.remove_tiles_from_players(selections)?;
    let exchanges = self.calculate_exchanges(removed, stage)?;
    let events = self.apply_exchanges(exchanges)?;
    let stage_events = self.advance_stage()?;
    Ok([events, stage_events].concat())
}

fn remove_tiles_from_players(...) -> Result<TileRemovals, CommandError> { ... }
fn calculate_exchanges(...) -> Vec<TileExchange> { ... }
fn apply_exchanges(...) -> Result<Vec<Event>, CommandError> { ... }
fn advance_stage(...) -> Result<Vec<Event>, CommandError> { ... }
```

**Effort**: 2 hours

#### 3.2.2 validation::validate_playing()

**File**: [crates/mahjong_core/src/table/validation.rs](crates/mahjong_core/src/table/validation.rs)
**Current**: ~80 lines with large match statement

**Refactoring Plan**:

```rust
// Extract per-command validators
fn validate_playing(...) -> Result<(), ValidationError> {
    match command {
        GameCommand::Discard { .. } => validate_discard(table, player, ...)?,
        GameCommand::DeclareMahjong { .. } => validate_mahjong(table, player, ...)?,
        GameCommand::DeclareCallIntent { .. } => validate_call_intent(table, player, ...)?,
        // ... etc
    }
    Ok(())
}

fn validate_discard(...) -> Result<(), ValidationError> { ... }
fn validate_mahjong(...) -> Result<(), ValidationError> { ... }
fn validate_call_intent(...) -> Result<(), ValidationError> { ... }
```

**Effort**: 1.5 hours

#### 3.2.3 hand::calculate_deficiency()

**File**: [crates/mahjong_core/src/hand.rs](crates/mahjong_core/src/hand.rs)
**Current**: ~50 lines with complex histogram logic

**Refactoring Plan**:

```rust
fn calculate_deficiency(...) -> HandAnalysis {
    let base_deficiency = compute_base_deficiency(hand, target);
    let joker_adjusted = apply_joker_adjustments(base_deficiency, joker_count, strict);
    HandAnalysis::new(joker_adjusted)
}

fn compute_base_deficiency(...) -> [u8; 42] { ... }
fn apply_joker_adjustments(...) -> [u8; 42] { ... }
```

**Effort**: 1 hour

**Total Effort for 3.2**: 4-5 hours

---

## Phase 4: Low Priority Improvements

**Timeline**: Complete within 3 months
**Estimated Effort**: 5-8 hours total

### 4.1 Improve Probability Model 🟢 LOW

**Issue**: Independence assumption causes ~5-15% error
**Location**: [crates/mahjong_ai/src/strategy/probability.rs:131-157](crates/mahjong_ai/src/strategy/probability.rs#L131-L157)
**Impact**: AI suboptimal but functional

**Current Model**: P(A and B) ≈ P(A) × P(B) (assumes independence)
**Correct Model**: Hypergeometric distribution

**Implementation**:

```rust
// Replace independence assumption with hypergeometric
fn probability_of_completing_pattern(...) -> f64 {
    let unseen_tiles = wall_size + opponent_tiles;
    let favorable_outcomes = count_favorable_tiles(pattern, hand);
    let draws_remaining = max_turns;

    hypergeometric_cdf(
        unseen_tiles,
        favorable_outcomes,
        draws_remaining
    )
}

fn hypergeometric_cdf(population: usize, successes: usize, draws: usize) -> f64 {
    // Use statrs crate or implement directly
    use statrs::distribution::{Hypergeometric, Discrete};
    let dist = Hypergeometric::new(population, successes, draws).unwrap();
    dist.cdf(1.0)
}
```

**Dependencies**:

- Add `statrs = "0.17"` to mahjong_ai/Cargo.toml

**Testing**:

- Compare old vs new model on test hands
- Run AI win rate benchmarks
- Verify performance acceptable

**Files to Modify**:

- [crates/mahjong_ai/src/strategy/probability.rs](crates/mahjong_ai/src/strategy/probability.rs)
- [crates/mahjong_ai/Cargo.toml](crates/mahjong_ai/Cargo.toml)

**Effort**: 4-6 hours

---

### 4.2 Update Dependencies 🟢 LOW

**Issue**: Dependencies 1-2 minor versions behind
**Impact**: Missing security patches and performance improvements

**Current Versions** (from report):

```toml
axum = "0.7.9"          # Latest: 0.8.8
tokio = "1.49.0"        # Latest: stable
serde = "1.0.228"       # Latest: stable
jsonwebtoken = "9.3.1"  # Latest: 10.2.0
reqwest = "0.11.27"     # Latest: 0.13.1
```

**Update Plan**:

1. **Update in separate PR** (don't bundle with other changes)
2. **Update one category at a time**:
   - Core async: tokio, futures
   - Serialization: serde, serde_json
   - Networking: axum, tower, hyper, reqwest
   - Auth: jsonwebtoken
3. **Test thoroughly** after each category

**Process**:

```bash
# Update Cargo.toml versions
cargo update
cargo test --workspace
cargo clippy --workspace -- -D warnings
cargo build --release

# Test server functionality
cd crates/mahjong_server
cargo run --release
# Manual WebSocket testing
```

**Breaking Changes to Watch**:

- `axum 0.7 → 0.8`: Check middleware API changes
- `jsonwebtoken 9 → 10`: Verify JWT validation unchanged
- `reqwest 0.11 → 0.13`: Check async API compatibility

**Files to Modify**:

- All `Cargo.toml` files in workspace

**Effort**: 1-2 hours + testing

---

## Implementation Schedule

### Week 1: Critical & High Priority

- [ ] Day 1: Phase 1 (Critical Security) - 20 minutes
- [ ] Day 2-3: Phase 2.1 (Session Cleanup) - 30 minutes
- [ ] Day 4-5: Phase 2.2.1-2.2.3 (Critical unwraps) - 2-3 hours
- [ ] Day 6-7: Phase 2.2.4 (AI unwraps) - 30 minutes

### Week 2-4: Medium Priority

- [ ] Week 2: Phase 3.1 (MCTS unsafe refactor) - 2-3 hours
- [ ] Week 3: Phase 3.2 (Function refactoring) - 4-5 hours
- [ ] Week 4: Testing and refinement

### Month 2-3: Low Priority

- [ ] Month 2: Phase 4.2 (Dependency updates) - 1-2 hours
- [ ] Month 3: Phase 4.1 (Probability model) - 4-6 hours

---

## Testing Strategy

### For Each Fix

1. **Unit Tests**: Add/update tests for modified functions
2. **Integration Tests**: Verify end-to-end flows still work
3. **Regression Tests**: Run full test suite (`cargo test --workspace`)
4. **Manual Testing**: Test in running server

### Validation Checklist

Before merging each phase:

- [ ] All tests pass: `cargo test --workspace`
- [ ] No clippy warnings: `cargo clippy --workspace -- -D warnings`
- [ ] No build warnings: `cargo build --release`
- [ ] Server starts successfully
- [ ] WebSocket connections work
- [ ] Game flows complete (Charleston → Playing → Win)
- [ ] Documentation updated

---

## Metrics & Monitoring

### Before/After Comparison

Track these metrics:

| Metric                 | Baseline | Target | Actual |
| ---------------------- | -------- | ------ | ------ |
| Unwrap count           | 70+      | <10    | TBD    |
| Unsafe blocks          | 3        | 0-1    | TBD    |
| Clippy warnings        | 0        | 0      | TBD    |
| Test pass rate         | 100%     | 100%   | TBD    |
| Memory leak (sessions) | Yes      | No     | TBD    |
| CORS security          | Insecure | Secure | TBD    |

### Success Criteria

- ✅ No CRITICAL issues remaining
- ✅ <10 HIGH issues remaining
- ✅ All tests passing
- ✅ Server stable under load
- ✅ Documentation updated

---

## Risk Assessment

### Low Risk Changes

- CORS configuration (isolated, easily tested)
- Session cleanup (background task, non-critical path)
- RwLock expect() (cosmetic change)

### Medium Risk Changes

- Unwrap replacement (could miss edge cases)
- Function refactoring (could introduce bugs)

### High Risk Changes

- MCTS unsafe removal (performance sensitive)
- Probability model (affects AI behavior)

**Mitigation**: Comprehensive testing, gradual rollout

---

## Documentation Updates

### Files to Update

1. [README.md](README.md)
   - Add CORS configuration section
   - Document environment variables

2. [docs/architecture/](docs/architecture/)
   - Update security architecture doc
   - Document session management

3. [CLAUDE.md](CLAUDE.md)
   - Update "Current Implementation Status"
   - Add new environment variables

4. Rustdoc Comments
   - Add error handling examples
   - Document unwrap-free patterns

---

## Tracking Progress

### GitHub Issues (Recommended)

Create issues for each phase:

- Issue #1: [CRITICAL] Fix CORS configuration
- Issue #2: [HIGH] Add session cleanup task
- Issue #3: [HIGH] Replace critical unwrap() calls
- Issue #4: [MEDIUM] Refactor MCTS unsafe code
- Issue #5: [MEDIUM] Refactor complex functions
- Issue #6: [LOW] Update dependencies
- Issue #7: [LOW] Improve probability model

### Pull Request Strategy

- **Separate PRs for each phase** (easier to review)
- **Link to tracking issue** in PR description
- **Include before/after metrics** in PR body
- **Require all tests passing** before merge

---

## Post-Implementation

### Follow-Up Actions

1. **Security Audit**: Re-run security scanner after Phase 1
2. **Performance Benchmark**: Verify MCTS performance unchanged
3. **Load Testing**: Test session cleanup under load
4. **Code Review**: Fresh eyes on refactored code
5. **Documentation Review**: Ensure all docs up-to-date

### Continuous Improvement

- **Monthly dependency updates**: `cargo update`
- **Quarterly security audits**: `cargo audit`
- **Annual architecture review**: Revisit design decisions

---

## Notes

- This plan is based on the January 17, 2026 code review
- Priorities may shift based on production needs
- Estimated times are for a single developer
- Testing time included in estimates
- All changes should be backward compatible

---

**Plan Status**: ✅ Ready for Implementation
**Next Step**: Create GitHub issues and begin Phase 1
**Owner**: TBD
**Last Updated**: January 17, 2026
