# Backend Backlog (3-Minute Pass)

Focused on backend gaps with evidence-based uncertainty. Archive claims are not treated as done.

## Decisions

- Feature: AI comparison log access policy
  - Why it matters: Determines who can see debug-level AI recommendations and in what environments.
  - Small next step: Decide admin-only vs. dev-only vs. player-facing, and document it.
- Feature: AI comparison log retention
  - Why it matters: Debug logs can be large; storage and privacy impact need clear limits.
  - Small next step: Pick retention window and whether logs persist for all games or only tagged ones.

## Work Items

- Feature: AI comparison log retrieval API
  - Why it matters: Logs are only exposed via admin replay; no dedicated endpoint or streaming.
  - Small next step: Add an admin-only endpoint or websocket channel for live comparison log access.
- Feature: AI comparison log persistence for active games
  - Why it matters: In-memory logs are lost if the server restarts mid-game.
  - Small next step: Persist logs periodically or on room teardown, not just at GameOver.
- Feature: Recommendation details in comparison log
  - Why it matters: Current entries use placeholder expected value and skip call opportunities.
  - Small next step: Populate expected value from analysis and add basic call-opportunity logging.
- Feature: Debug mode consistency
  - Why it matters: Room debug mode is set at creation, worker checks env per run; mismatch risk.
  - Small next step: Read debug flag once and pass it through room/worker state consistently.
- Feature: End-to-end test coverage for AI comparison logging
  - Why it matters: Current tests cover structures, not worker-to-room logging under debug.
  - Small next step: Add a test that enables DEBUG_AI_COMPARISON and asserts log growth after analysis.
