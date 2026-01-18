# Incomplete Work Audit Report

**Generated**: 2026-01-17
**Purpose**: Identify all incomplete work, placeholders, and future enhancements that need TODO markers

## Summary

This audit found **incomplete work patterns** across the codebase that were either missing TODO markers or using vague terminology like "currently unused", "future use", "placeholder", "for now", "MVP", etc.

## Policy

**All incomplete work MUST use one of these markers:**

- `TODO:` - Work that needs to be done (standard marker)
- `FIXME:` - Known bugs or broken functionality that needs fixing
- `HACK:` - Temporary workaround that should be replaced
- `XXX:` - Warning about problematic code

**NEVER use vague terms without a TODO marker:**

- ❌ "currently unused"
- ❌ "future use"
- ❌ "for now"
- ❌ "placeholder"
- ❌ "not yet implemented"
- ❌ "MVP"

## Files Fixed

### ✅ Fixed in This Session

1. **[apps/client/src/utils/cardLoader.ts](apps/client/src/utils/cardLoader.ts)**
   - Line 34: Changed "future use" → "TODO: Map of tile positions..."
   - Line 205-207: Changed "Future enhancement" → "TODO: Implement histogram-based..."
   - Line 249: Changed "Future enhancement" → "TODO: Query server capabilities..."

## Files Already Compliant

### ✅ Already Have TODO Markers

1. **[crates/mahjong_server/src/stats.rs:100](crates/mahjong_server/src/stats.rs#L100)**
   - ✓ Has proper `// TODO: Complete PlayerStats tracking for dashboard support`

2. **[apps/client/src/components/ui/CardViewer.tsx:161](apps/client/src/components/ui/CardViewer.tsx#L161)**
   - ✓ Has proper `// TODO: Implement pattern matching logic to highlight possible patterns`

3. **[apps/client/src/store/uiStore.ts:127](apps/client/src/store/uiStore.ts#L127)**
   - ✓ Has proper `// TODO: Wire timer events...`

4. **[apps/client/src/store/gameStore.ts:122](apps/client/src/store/gameStore.ts#L122)**
   - ✓ Has proper `// TODO: Handle history viewer events...`

5. **[crates/mahjong_terminal/src/ui.rs:274](crates/mahjong_terminal/src/ui.rs#L274)**
   - ✓ Has proper `// TODO: Render the actual hand contents once layout is finalized.`

6. **[crates/mahjong_terminal/src/ui.rs:428](crates/mahjong_terminal/src/ui.rs#L428)**
   - ✓ Has proper `// TODO: Store per-event color to render richer output.`

7. **[crates/mahjong_server/src/resources.rs:73](crates/mahjong_server/src/resources.rs#L73)**
   - ✓ Has proper `// TODO: Add unified or per-year card data for 2021-2024.`

8. **[.github/workflows/ci.yml:37](../../.github/workflows/ci.yml#L37)**
   - ✓ Has proper `# TODO: Add cargo bench once benchmarks are stable in CI.`

9. **[.github/workflows/ci.yml:69](../../.github/workflows/ci.yml#L69)**
   - ✓ Has proper `# TODO: Add deploy workflow for Vercel/Render when MVP hosting is finalized.`

## Files Needing Review

### ⚠️ Requires Manual Review - Potential Incomplete Work

These files contain patterns suggesting incomplete work but need manual review to determine if they're truly incomplete or just documentation of design decisions:

#### TypeScript/Frontend

1. **[apps/client/src/App.tsx:35-36](apps/client/src/App.tsx#L35-L36)**

   ```typescript
   // We use a dummy URL for now if not in env
   const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';
   ```

   - **Context**: Using fallback URL
   - **Action Needed**: Determine if this needs production URL handling

2. **[apps/client/src/App.tsx:64-70](apps/client/src/App.tsx#L64-L70)**

   ```typescript
   // Just a dummy check
   if (wsUrl === 'test') {
     console.log('Using test URL');
   }
   // Dummy usage of skipAnimation
   skipAnimation(Promise.resolve());
   ```

   - **Context**: Dummy/test code
   - **Action Needed**: Remove or mark with TODO if temporary

#### Rust Backend - Core

1. **[crates/mahjong_core/src/event.rs:172](crates/mahjong_core/src/event.rs#L172)**

   ```rust
   started_at_ms: u64, // Use 0 as placeholder in core crate
   ```

   - **Context**: Documented design pattern (server enriches timestamps)
   - **Action Needed**: ✓ This is OK - documented architectural decision per ADR-0019

2. **[crates/mahjong_terminal/src/input.rs:103-110](crates/mahjong_terminal/src/input.rs#L103-L110)**

   ```rust
   // Create a placeholder meld - server will reconstruct properly from context
   // We use Tile(0) as a dummy since the server knows which tile was discarded
   let dummy_tile = Tile::new(0);
   let tiles = vec![dummy_tile; meld_type.tile_count()];
   let meld = Meld::new(meld_type, tiles, Some(dummy_tile))
   ```

   - **Context**: Client sends intent, server reconstructs actual meld
   - **Action Needed**: ✓ This is OK - documented design pattern per server-authoritative architecture

3. **[crates/mahjong_terminal/src/ui.rs:106](crates/mahjong_terminal/src/ui.rs#L106)**

   ```rust
   // Hand section (placeholder)
   ```

   - **Context**: Terminal UI not fully implemented
   - **Recommendation**: Change to `// TODO: Implement hand section rendering`

#### Rust Backend - Server

1. **[crates/mahjong_server/tests/history_stress_tests.rs:425-461](crates/mahjong_server/tests/history_stress_tests.rs#L425-L461)**

   ```rust
   /// # TODO(delayed): Implement history cap enforcement
   /// ⚠️ **NOT IMPLEMENTED** - History cap not yet enforced (see remaining-work.md Section 2.3)
   ```

   - **Context**: Test marked `#[ignore]` with clear TODO
   - **Action Needed**: ✓ This is OK - properly tracked with TODO and #[ignore]

2. **[crates/mahjong_server/src/analysis/comparison.rs:42](crates/mahjong_server/src/analysis/comparison.rs#L42)**

   ```rust
   /// Call opportunities the AI evaluated (empty in MVP)
   pub call_opportunities: Vec<CallOpportunity>,
   ```

   - **Context**: Feature not yet implemented
   - **Recommendation**: Add `// TODO: Implement call opportunity tracking`

3. **[crates/mahjong_server/src/analysis/comparison.rs:107](crates/mahjong_server/src/analysis/comparison.rs#L107)**

   ```rust
   // Use placeholder values for turn context since this is analysis
   ```

   - **Context**: Using default/zero values for analysis context
   - **Action Needed**: Determine if this is permanent design or temporary

4. **[crates/mahjong_server/migrations/20260104000002_enable_rls_and_auth.sql:38](crates/mahjong_server/migrations/20260104000002_enable_rls_and_auth.sql#L38)**

   ```sql
   -- For now, we allow authenticated users to view all games (lobby style).
   ```

   - **Context**: Permissive auth policy
   - **Recommendation**: Add `-- TODO: Implement per-game access control` if this should be restricted

5. **[crates/mahjong_server/src/main.rs:168,178](crates/mahjong_server/src/main.rs#L168)**

   ```rust
   println!("Game state will not be persisted, and auth will use mock tokens.");
   ```

   - **Context**: Warning message for development mode
   - **Action Needed**: ✓ This is OK - informational message, not incomplete work

#### Rust Backend - Tests

1. **[crates/mahjong_server/tests/\*.rs](crates/mahjong_server/tests/) (multiple files)**
   - Multiple uses of "mock", "dummy", "placeholder" in test helper functions
   - **Action Needed**: ✓ These are OK - standard testing terminology

2. **[crates/mahjong_core/tests/turn_flow.rs:205](crates/mahjong_core/tests/turn_flow.rs#L205)**

   ```rust
   // (Command processing just accepts DeclareMahjong and emits GameOver for now)
   ```

   - **Context**: Simplified test behavior
   - **Recommendation**: Change to `// TODO: Add validation for DeclareMahjong command`

#### Documentation

1. **[docs/archive/frontend-design-reference/](docs/archive/frontend-design-reference/)** (multiple files)
   - Contains many "MVP", "placeholder", "for now" references
   - **Action Needed**: ✓ These are OK - archived documentation explaining design evolution

2. **[docs/archive/deleteme/](docs/archive/deleteme/)** (multiple files)
   - Contains planning documents with "MVP", "TODO", "not yet implemented"
   - **Action Needed**: ✓ These are OK - archived planning documents

## Recommendations

### Immediate Actions Required

1. **Add TODO markers to these locations:**

   ```typescript
   // apps/client/src/App.tsx:35
   - const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';
   + // TODO: Configure production WebSocket URL via environment variable
   + const wsUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:3000/ws';
   ```

   ```typescript
   // apps/client/src/App.tsx:64-70
   - // Just a dummy check
   - if (wsUrl === 'test') {
   -   console.log('Using test URL');
   - }
   - // Dummy usage of skipAnimation
   - skipAnimation(Promise.resolve());
   + // TODO: Remove this test code before production
   + if (wsUrl === 'test') {
   +   console.log('Using test URL');
   + }
   + // TODO: Remove this dummy skipAnimation call
   + skipAnimation(Promise.resolve());
   ```

   ```rust
   // crates/mahjong_terminal/src/ui.rs:106
   - // Hand section (placeholder)
   + // TODO: Implement hand section rendering with actual tile display
   ```

   ```rust
   // crates/mahjong_server/src/analysis/comparison.rs:42
   - /// Call opportunities the AI evaluated (empty in MVP)
   + /// Call opportunities the AI evaluated
   + /// TODO: Implement call opportunity tracking for AI comparison logs
   ```

   ```rust
   // crates/mahjong_core/tests/turn_flow.rs:205
   - // (Command processing just accepts DeclareMahjong and emits GameOver for now)
   + // TODO: Add validation for DeclareMahjong command (currently auto-accepts)
   ```

   ```sql
   -- crates/mahjong_server/migrations/20260104000002_enable_rls_and_auth.sql:38
   - -- For now, we allow authenticated users to view all games (lobby style).
   + -- TODO: Implement per-game access control (currently allows all authenticated users)
   ```

### Long-term Process Improvements

1. **Add Pre-commit Hook**
   - Reject commits containing patterns: `(currently unused|future use|for now|placeholder)` without a TODO marker nearby
   - See example hook in Appendix A below

2. **Add CI Linting Rule**
   - Add to `.github/workflows/ci.yml` to fail on vague incomplete work markers

3. **Update CONTRIBUTING.md** (if it exists)
   - Document the TODO marker policy
   - Provide examples of good vs bad incomplete work comments

4. **Periodic Audits**
   - Run quarterly: `rg "TODO|FIXME|HACK|XXX" --stats` to track technical debt
   - Review and prioritize TODO items during sprint planning

## Search Commands for Future Audits

To find potential incomplete work:

```bash
# Find vague markers without TODO
rg "(currently unused|future use|for now|placeholder|not yet implemented|stub)" \
   --iglob '!INCOMPLETE_WORK_AUDIT.md' \
   --iglob '!docs/archive/**' \
   --iglob '!*.md'

# Find all TODO markers
rg "TODO|FIXME|HACK|XXX" --stats

# Find comment-only MVP references (may indicate incomplete work)
rg "//.*MVP|/\*.*MVP" --iglob '*.rs' --iglob '*.ts' --iglob '*.tsx'
```

## Appendix A: Pre-commit Hook Example

Create `.git/hooks/pre-commit`:

```bash
#!/bin/bash

# Check for vague incomplete work markers
if git diff --cached --diff-filter=d | \
   grep -E "\+(.*)(currently unused|future use|for now|not yet implemented)(?!.*TODO)" | \
   grep -v "INCOMPLETE_WORK_AUDIT.md"; then
    echo "ERROR: Found vague incomplete work marker without TODO"
    echo "Please use TODO: prefix for all incomplete work"
    echo ""
    echo "Bad:  // currently unused"
    echo "Good: // TODO: Implement feature X (currently unused)"
    exit 1
fi
```

Make it executable: `chmod +x .git/hooks/pre-commit`

---

**Last Updated**: 2026-01-17
**Next Audit**: 2026-04-17 (quarterly)
