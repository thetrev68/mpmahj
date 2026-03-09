# Frontend User-Testing Backlog

Purpose: index and implementation status tracker for user-testing driven frontend stories.

Last Updated: 2026-03-08.

## Story Index

| Story                                                            | Title                                                             | Status      | Priority | Batch |
| ---------------------------------------------------------------- | ----------------------------------------------------------------- | ----------- | -------- | ----- |
| [US-033](./US-033-simplified-exit-controls.md)                   | Simplified Exit Controls (Leave Only)                             | Completed   | High     | A     |
| [US-034](./US-034-replace-compass-with-active-rack-indicator.md) | Replace Compass With Active Rack Indicator                        | Completed   | Medium   | B     |
| [US-035](./US-035-correct-side-rack-and-staging-geometry.md)     | Correct Side Rack + Side Staging Geometry                         | Completed   | High     | B     |
| [US-036](./US-036-square-board-layout-and-right-rail.md)         | Square Board Layout + Right Rail Reservation                      | Completed   | High     | B     |
| [US-037](./US-037-tile-asset-and-audio-feedback-polish.md)       | Tile Asset and Audio Feedback Polish                              | Not Started | Medium   | C     |
| [US-038](./US-038-staging-interaction-consistency.md)            | Staging Interaction Consistency (Hover, Ordering, No Glow)        | Complete    | High     | C     |
| [US-039](./US-039-action-panel-clarity.md)                       | Action Panel Clarity (Persistent Controls + Instructional Prompt) | Completed   | High     | A     |
| [US-040](./US-040-animation-policy-simplification.md)            | Animation Policy Simplification (Normal or Off)                   | Completed   | Medium   | C     |
| [US-041](./US-041-frontend-regression-recovery-program.md)       | Frontend Regression Recovery Program (Post-User-Testing)          | Not Started | Critical | D     |
| [US-042](./US-042-board-local-layout-anchoring.md)               | Board-Local Layout Anchoring and Collision Elimination            | Not Started | Critical | D     |
| [US-043](./US-043-charleston-tile-count-conservation.md)         | Charleston Tile-Count Conservation and Hand Integrity             | Not Started | Critical | D     |
| [US-044](./US-044-staging-slot-order-and-action-coherence.md)    | Staging Slot Order and Action Coherence                           | Not Started | High     | D     |
| [US-045](./US-045-frontend-regression-guardrails.md)             | Frontend Regression Guardrails (E2E + Visual Baselines)           | Not Started | High     | D     |

## Suggested Implementation Batches

1. Batch A (high UX impact): US-033 + US-039.
2. Batch B (board comprehension/layout): US-034 + US-035 + US-036.
3. Batch C (tile interaction polish): US-037 + US-038 + US-040.
4. Batch D (recovery): US-041 + US-042 + US-043 + US-044 + US-045.

## Deferred / Follow-up

- Define right-rail content spec (log/hints/help) after US-036 lands.
- Decide whether full backend forfeit command/event removal is included in US-033 or split into a backend-only cleanup story.
- Capture visual acceptance snapshots after US-035 and US-036 for regression guardrails.
- Immediate triage focus: Charleston pass integrity and board-local positioning regressions reported on March 9, 2026.
