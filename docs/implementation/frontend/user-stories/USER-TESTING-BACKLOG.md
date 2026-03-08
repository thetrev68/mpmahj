# Frontend User-Testing Backlog

Purpose: index and implementation status tracker for user-testing driven frontend stories.

Last Updated: 2026-03-08.

## Story Index

| Story                                                            | Title                                                             | Status      | Priority | Batch |
| ---------------------------------------------------------------- | ----------------------------------------------------------------- | ----------- | -------- | ----- |
| [US-033](./US-033-simplified-exit-controls.md)                   | Simplified Exit Controls (Leave Only)                             | Complete    | High     | A     |
| [US-034](./US-034-replace-compass-with-active-rack-indicator.md) | Replace Compass With Active Rack Indicator                        | Not Started | Medium   | B     |
| [US-035](./US-035-correct-side-rack-and-staging-geometry.md)     | Correct Side Rack + Side Staging Geometry                         | Not Started | High     | B     |
| [US-036](./US-036-square-board-layout-and-right-rail.md)         | Square Board Layout + Right Rail Reservation                      | Not Started | High     | B     |
| [US-037](./US-037-tile-asset-and-audio-feedback-polish.md)       | Tile Asset and Audio Feedback Polish                              | Not Started | Medium   | C     |
| [US-038](./US-038-staging-interaction-consistency.md)            | Staging Interaction Consistency (Hover, Ordering, No Glow)        | Not Started | High     | C     |
| [US-039](./US-039-action-panel-clarity.md)                       | Action Panel Clarity (Persistent Controls + Instructional Prompt) | Not Started | High     | A     |
| [US-040](./US-040-animation-policy-simplification.md)            | Animation Policy Simplification (Normal or Off)                   | Not Started | Medium   | C     |

## Suggested Implementation Batches

1. Batch A (high UX impact): US-033 + US-039.
2. Batch B (board comprehension/layout): US-034 + US-035 + US-036.
3. Batch C (tile interaction polish): US-037 + US-038 + US-040.

## Deferred / Follow-up

- Define right-rail content spec (log/hints/help) after US-036 lands.
- Decide whether full backend forfeit command/event removal is included in US-033 or split into a backend-only cleanup story.
- Capture visual acceptance snapshots after US-035 and US-036 for regression guardrails.
