# Implementation Plan: Bot Integration & Script Playback

This document outlines the plan to resolve the TODOs in `mahjong_terminal` related to bot integration and script playback.

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
