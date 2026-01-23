# Implementation Plan: Bot Integration & Script Playback

This document outlines the plan to resolve the TODOs in `mahjong_terminal` related to bot integration and script playback.

---

## 📋 IMPLEMENTATION STATUS (Updated: 2026-01-23)

### ✅ ALL PLANNED WORK COMPLETE (100%)

All tasks from sections 1 and 2 have been fully implemented:

#### Section 1: Bot Integration - COMPLETE

- ✅ Dependencies added (`mahjong_ai`, `mahjong_core`) in `Cargo.toml:24-25`
- ✅ `GameState` updated with `Hand`, `GamePhase`, and `VisibleTiles` tracking (`client.rs:32-50`)
- ✅ `update_state_from_event()` implemented in `client.rs:627-690`
- ✅ `run_bot()` implemented in `bot.rs:395-445` with configurable difficulty
- ✅ Full `Bot` struct with AI integration (`bot.rs:27-372`)

#### Section 2: Script Playback - COMPLETE

- ✅ `run_script()` implemented in `client.rs:711-754`
- ✅ Comment support (lines starting with `#`)
- ✅ Delay support (`DELAY_MS <milliseconds>` meta-command)
- ✅ Integration with existing `CommandParser`

#### Out of Scope (Not in Original Plan)

The following UI polish TODOs exist but were not part of this plan:

- `ui.rs:108` - Hand section rendering with actual tile display
- `ui.rs:277` - Render actual hand contents
- `ui.rs:431` - Store per-event color for richer output

These are cosmetic improvements and do not affect functionality.

---

## 1. Bot Integration (`src/bot.rs`)

**Goal:** Enable `mahjong_terminal` to play autonomously by integrating the existing `mahjong_ai` crate, rather than re-implementing logic.

### Strategy

1. **Dependency:** Add `mahjong_ai` and `mahjong_core` as dependencies to `mahjong_terminal`'s `Cargo.toml`.
2. **State Tracking:** The bot needs a complete view of the game state. We need to expand `GameState` in `src/client.rs` to track:
   - The player's hand (tiles).
   - Visible tiles (discards, exposures).
   - Current game phase (Setup, Charleston, Playing).
   - Current turn information.
3. **Bot Logic (`src/bot.rs`):**
   - Replace the placeholder `Bot` struct.
   - **Configurable Difficulty:** Allow the user to specify the bot difficulty (Easy, Medium, Hard, Expert).
   - Instantiate `mahjong_ai::create_ai(difficulty, seed)`.
   - Implement `run_bot` loop:
     - Wait for `Event`s from the server.
     - Update the local `GameState` and the AI's internal context.
     - When it's the bot's turn (or an action is required like Charleston), query the AI for a decision.
     - Convert the AI's decision into a `GameCommand` and send it via the `Client`.

### Tasks

- [ ] Add dependencies to `Cargo.toml`.

- [ ] Update `GameState` struct to include `mahjong_core::hand::Hand`, `table::Table` (or a view of it), and `mahjong_core::flow::GamePhase`.
- [ ] Implement `update_state(event: &Event)` in `Client` (resolves `client.rs` TODO: L255).
- [ ] Implement `run_bot` in `bot.rs` to:
  - Accept a `Difficulty` parameter.
  - Poll for state changes.
  - Check `can_player_act`.
  - Invoke AI strategy.
  - Send result.

## 2. Script Playback (`src/client.rs`)

**Goal:** Allow the terminal client to execute a sequence of pre-defined commands from a file, useful for regression testing and reproducing scenarios.

### Script Strategy

1. **Script Format:** Use a line-based text format or JSON array. Line-based is easier to write manually.
   - Format: `COMMAND_JSON_PAYLOAD` or simply `COMMAND_NAME [ARGS]` if the parser supports it.
   - Support a `DELAY_MS <milliseconds>` meta-command to control pacing.
2. **Implementation:**
   - In `run_script`, read the file line by line.
   - Parse each line using the existing `CommandParser`.
   - Send the command.
   - Wait for the specified delay (or a default delay) between commands.

### Script Tasks

- [ ] Implement `run_script` in `src/client.rs` (resolves `client.rs` TODO: L271).

- [ ] Add support for comments (lines starting with `#`) and delays in the script parser.

## 3. Execution Order

1. **Script Playback:** Implementation is self-contained and easier.
2. **State Tracking:** Prerequisite for the bot.
3. **Bot Integration:** Connects the pieces.
