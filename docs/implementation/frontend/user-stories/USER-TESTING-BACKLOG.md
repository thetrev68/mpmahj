# Frontend User-Testing Backlog

Purpose: index and implementation status tracker for user-testing driven frontend stories.

Last Updated: 2026-03-16. US-059, US-062, US-063, US-067 rewritten; US-066/US-068 merged.

## Story Index

| Story                                                                                  | Title                                                                    | Status    | Priority | Batch |
| -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------- | -------- | ----- |
| [US-033](./US-033-simplified-exit-controls.md)                                         | Simplified Exit Controls (Leave Only)                                    | Completed | High     | A     |
| [US-034](./US-034-replace-compass-with-active-rack-indicator.md)                       | Replace Compass With Active Rack Indicator                               | Completed | Medium   | B     |
| [US-035](./US-035-correct-side-rack-and-staging-geometry.md)                           | Correct Side Rack + Side Staging Geometry                                | Completed | High     | B     |
| [US-036](./US-036-square-board-layout-and-right-rail.md)                               | Square Board Layout + Right Rail Reservation                             | Completed | High     | B     |
| [US-037](./US-037-tile-asset-and-audio-feedback-polish.md)                             | Tile Asset and Audio Feedback Polish                                     | Completed | Medium   | C     |
| [US-038](./US-038-staging-interaction-consistency.md)                                  | Staging Interaction Consistency (Hover, Ordering, No Glow)               | Complete  | High     | C     |
| [US-039](./US-039-action-panel-clarity.md)                                             | Action Panel Clarity (Persistent Controls + Instructional Prompt)        | Completed | High     | A     |
| [US-040](./US-040-animation-policy-simplification.md)                                  | Animation Policy Simplification (Normal or Off)                          | Completed | Medium   | C     |
| [US-041](./US-041-frontend-regression-recovery-program.md)                             | Frontend Regression Recovery Program (Post-User-Testing)                 | Completed | Critical | D     |
| [US-042](./US-042-board-local-layout-anchoring.md)                                     | Board-Local Layout Anchoring and Collision Elimination                   | Completed | Critical | D     |
| [US-043](./US-043-charleston-tile-count-conservation.md)                               | Charleston Tile-Count Conservation and Hand Integrity                    | Completed | Critical | D     |
| [US-044](./US-044-staging-slot-order-and-action-coherence.md)                          | Staging Slot Order and Action Coherence                                  | Completed | High     | D     |
| [US-045](./US-045-frontend-regression-guardrails.md)                                   | Frontend Regression Guardrails (E2E + Visual Baselines)                  | Completed | High     | D     |
| [US-049](./US-049-charleston-blind-pass-face-down-and-receive-first-flow.md)           | Charleston Blind Pass Face-Down Rendering and Receive-First Flow         | Completed | Critical | E     |
| [US-050](./US-050-staging-strip-uniform-6-slot-width.md)                               | Staging Strip — Uniform 6-Slot Width Across Both Phases                  | Completed | High     | E     |
| [US-051](./US-051-charleston-action-pane-courtesy-pass-and-two-button-model.md)        | Charleston Action Pane: Courtesy Pass Text + Persistent Two-Button Model | Completed | High     | E     |
| [US-052](./US-052-gameplay-action-pane-and-controls-cleanup.md)                        | Gameplay Action Pane + Controls Cleanup                                  | Completed | High     | E     |
| [US-053](./US-053-exchange-joker-click-to-exchange-flow.md)                            | Exchange Joker: Click-to-Exchange Flow                                   | Completed | High     | E     |
| [US-054](./US-054-discard-pile-repositioning-and-full-hand-display.md)                 | Discard Pile — Repositioning and Full-Hand Display                       | Completed | High     | E     |
| [US-055](./US-055-right-rail-get-hint-relocation-and-ai-hint-panel.md)                 | Right Rail — Get Hint Relocation + AI Hint Panel                         | Completed | Medium   | E     |
| [US-056](./US-056-light-dark-theme-compliance-history-panel-settings-modal.md)         | Light/Dark Theme Compliance — History Panel + Settings Modal             | Completed | High     | E     |
| [US-057](./US-057-settings-simplified-hints-switch-and-audio-controls.md)              | Settings — Simplified Hints Switch + Audio Controls                      | Completed | Medium   | E     |
| [US-058](./US-058-charleston-blind-pass-contract-realignment.md)                       | Charleston Blind Pass Contract Realignment                               | Completed | Critical | F     |
| [US-059](./US-059-right-rail-non-playing-phase-guidance-and-occupancy.md)              | Right Rail Charleston Hint Availability (Frontend Phase Gating)          | Completed | High     | F     |
| [US-060](./US-060-runtime-noise-persistence-failures-and-debug-hygiene.md)             | Runtime Noise, Persistence Failures, and Debug Hygiene                   | Completed | Critical | F     |
| [US-061](./US-061-action-bar-message-hierarchy-and-deduplication.md)                   | Action Bar Message Hierarchy and Deduplication                           | Proposed  | High     | G     |
| [US-062](./US-062-board-edge-alignment-rail-geometry-and-staging-boundary-recovery.md) | Board Layout System, Rail Geometry, and Staging Boundary Recovery        | Proposed  | Critical | G     |
| [US-063](./US-063-board-chrome-theme-compliance-history-settings-and-rail-controls.md) | Play Surface Theme Ownership and Board Chrome Compliance                 | Proposed  | Critical | G     |
| [US-064](./US-064-ai-hint-pattern-guidance-and-panel-content-completeness.md)          | AI Hint Pattern Guidance and Panel Content Completeness                  | Proposed  | High     | G     |
| [US-065](./US-065-duplicate-safe-newly-received-tile-highlighting.md)                  | Duplicate-Safe Newly Received Tile Highlighting                          | Proposed  | High     | G     |
| [US-067](./US-067-ai-hint-capability-contract-reconciliation.md)                       | Hint System Simplification -- Single Toggle, Full Payload                | Proposed  | Critical | H     |
| [US-069](./US-069-audio-settings-state-integrity-and-audiocontext-consolidation.md)    | Audio Settings State Integrity and AudioContext Consolidation            | Proposed  | Critical | F     |
| [US-070](./US-070-css-animation-reduced-motion-compliance.md)                          | CSS Animation Reduced-Motion Compliance                                  | Proposed  | High     | H     |
| [US-071](./US-071-game-board-error-boundaries.md)                                      | Game Board Error Boundaries                                              | Proposed  | High     | H     |
| [US-072](./US-072-tile-selection-keyboard-accessibility.md)                            | Tile Selection Keyboard Accessibility                                    | Proposed  | High     | H     |
| [US-073](./US-073-background-music-controls-ux-honesty.md)                             | Background Music Controls UX Honesty                                     | Proposed  | Medium   | I     |

## Suggested Implementation Batches

1. Batch A (high UX impact): US-033 + US-039. \*Done
2. Batch B (board comprehension/layout): US-034 + US-035 + US-036. \*Doine
3. Batch C (tile interaction polish): US-037 + US-038 + US-040. \*Done
4. Batch D (recovery): US-041 + US-042 + US-043 + US-044 + US-045. \*Done
5. Batch F (stability recovery): US-058 + US-059 + US-060 + US-069.
6. Batch G (frontend polish recovery): US-061 + US-062 + US-063 + US-064 + US-065.
7. Batch H (proactive audit recovery): US-067 + US-070 + US-071 + US-072.
8. Batch I (deferred UX polish): US-073.

## Deferred / Follow-up

- **US-055 EC-2 minor**: `cancelHintRequest` does not clear `currentHint`. If the player cancels a second in-flight hint request, the previous hint re-surfaces instead of returning to idle. The spinner is gone (primary requirement met), but the state is not strictly "idle". Fix: call `setCurrentHint(null)` inside `cancelHintRequest` in `useHintSystem.ts`.
- Define right-rail content spec (log/hints/help) after US-036 lands.
- Decide whether full backend forfeit command/event removal is included in US-033 or split into a backend-only cleanup story.
- Capture visual acceptance snapshots after US-035 and US-036 for regression guardrails.
- Immediate triage focus: Charleston pass integrity and board-local positioning regressions reported on March 9, 2026.
- Blind pass stories should use the receive-first model captured in `docs/planning/ut-session-2-issues.md`, not a "rack first drops to 11" model.
- Recovery note: `US-049`, `US-055`, and related tests should not be treated as trustworthy implementation proof until the Batch F recovery stories land.
- Recovery note: `US-056` addressed modal/sheet internals, but board-level theme compliance for visible controls and rail chrome remains open until `US-063` lands.
- Recovery note: AI hint behavior should not be treated as complete until `US-064` restores pattern guidance alongside discard advice.
- Recovery note: the proactive audit found root-cause gaps beyond the original user-reported bugs. US-066 (forced-dark root) merged into US-063 (Batch G). US-068 (magic-offset alignment) merged into US-062 (Batch G). US-067 (hint capability mismatch) simplified to single-toggle full-payload model (Batch H). US-059 rewritten as frontend-only after confirming server already supports Charleston hints.
- Hostile regression audit (2026-03-15): US-069 through US-073 added. US-069 is Critical (data-loss bug in audio settings stale closure + browser resource leak from multiple AudioContexts) and belongs in Batch F alongside the other stability work. US-070–US-072 are proactive quality gaps (CSS reduced-motion, error boundaries, keyboard accessibility) for Batch H. US-073 is low-urgency UX honesty for the non-functional music controls.
