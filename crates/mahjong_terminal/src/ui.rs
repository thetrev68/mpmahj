//! Terminal UI rendering and input handling using crossterm.
//!
//! The UI is intentionally simple and optimized for debugging game flow.
//! Rendering uses a fixed-width box layout updated on each tick.

use anyhow::Result;
use crossterm::{
    cursor,
    event::{self, Event, KeyCode, KeyEvent, KeyEventKind},
    execute,
    style::{Color, Print, ResetColor, SetForegroundColor},
    terminal::{self, ClearType},
};
use std::io::{stdout, Write};
use std::time::Duration;

use mahjong_ai::VisibleTiles;
use mahjong_core::flow::charleston::CharlestonStage;
use mahjong_core::flow::playing::TurnStage;
use mahjong_core::flow::GamePhase;
use mahjong_core::player::Seat;

use crate::client::GameState;

/// Terminal UI renderer using crossterm.
pub struct TerminalUI {
    /// Whether the terminal is currently in raw mode.
    in_raw_mode: bool,
    /// Current input line buffer.
    input_buffer: String,
    /// Recent event log entries for display.
    event_log: Vec<String>,
    /// Maximum number of events to keep in memory.
    max_events: usize,
}

impl TerminalUI {
    /// Create a new terminal UI.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// use mahjong_terminal::ui::TerminalUI;
    ///
    /// let ui = TerminalUI::new().unwrap();
    /// ```
    pub fn new() -> Result<Self> {
        Ok(Self {
            in_raw_mode: false,
            input_buffer: String::new(),
            event_log: Vec::new(),
            max_events: 10,
        })
    }

    /// Enter raw mode for interactive input.
    ///
    /// This is a no-op if raw mode is already enabled.
    pub fn enter_raw_mode(&mut self) -> Result<()> {
        if !self.in_raw_mode {
            terminal::enable_raw_mode()?;
            self.in_raw_mode = true;
        }
        Ok(())
    }

    /// Exit raw mode.
    ///
    /// This is a no-op if raw mode is already disabled.
    pub fn exit_raw_mode(&mut self) -> Result<()> {
        if self.in_raw_mode {
            terminal::disable_raw_mode()?;
            self.in_raw_mode = false;
        }
        Ok(())
    }

    /// Render the full terminal UI.
    ///
    /// This clears the screen and redraws all sections.
    ///
    /// # Examples
    ///
    /// ```ignore
    /// use mahjong_terminal::ui::TerminalUI;
    /// use mahjong_terminal::client::GameState;
    ///
    /// let mut ui = TerminalUI::new().unwrap();
    /// let state = GameState::default();
    /// ui.render(&state).unwrap();
    /// ```
    pub fn render(&mut self, state: &GameState) -> Result<()> {
        let mut stdout = stdout();

        // Clear screen
        execute!(
            stdout,
            terminal::Clear(ClearType::All),
            cursor::MoveTo(0, 0)
        )?;

        // Header
        self.render_header(&mut stdout, state)?;

        // Game state section
        self.render_game_state(&mut stdout, state)?;

        // TODO: Implement hand section rendering with actual tile display
        self.render_hand(&mut stdout)?;

        // Recent events
        self.render_events(&mut stdout)?;

        // Command prompt
        self.render_prompt(&mut stdout)?;

        stdout.flush()?;
        Ok(())
    }

    /// Render the header bar.
    fn render_header(&self, stdout: &mut impl Write, state: &GameState) -> Result<()> {
        execute!(
            stdout,
            SetForegroundColor(Color::Cyan),
            Print("┌─────────────────────────────────────────────────────────────┐\n"),
            Print("│ American Mahjong Terminal Client                           │\n"),
            ResetColor,
        )?;

        let connection_status = if state.connected {
            "Connected"
        } else {
            "Disconnected"
        };
        // Truncate player ID to first 8 chars for display
        let player_id = state
            .player_id
            .as_deref()
            .map(|id| if id.len() > 8 { &id[..8] } else { id })
            .unwrap_or("None");
        let room_id = state.game_id.as_deref().unwrap_or("None");
        let seat_str = state
            .seat
            .map(|s| format!("{:?}", s))
            .unwrap_or_else(|| "-".to_string());

        execute!(
            stdout,
            Print(format!(
                "│ Status: {:<11} | Player: {:<8} | Seat: {:<5}    │\n",
                connection_status, player_id, seat_str
            )),
            SetForegroundColor(Color::Green),
            Print(format!("│ Room: {:<54} │\n", room_id)),
            ResetColor,
            SetForegroundColor(Color::Cyan),
            Print("├─────────────────────────────────────────────────────────────┤\n"),
            ResetColor,
        )?;

        Ok(())
    }

    /// Render game state section.
    fn render_game_state(&self, stdout: &mut impl Write, state: &GameState) -> Result<()> {
        let phase_str = Self::format_phase(&state.phase);
        let turn_str = Self::format_turn(&state.phase, state.seat);
        let wall_str = Self::format_wall(&state.visible_tiles);

        execute!(
            stdout,
            SetForegroundColor(Color::Yellow),
            Print("│ GAME STATE:                                                 │\n"),
            ResetColor,
            Print(format!("│   Phase: {:<52}│\n", phase_str)),
            Print(format!("│   Turn: {:<53}│\n", turn_str)),
            Print(format!("│   Wall: {:<53}│\n", wall_str)),
            SetForegroundColor(Color::Cyan),
            Print("├─────────────────────────────────────────────────────────────┤\n"),
            ResetColor,
        )?;

        Ok(())
    }

    /// Format the game phase for display.
    fn format_phase(phase: &GamePhase) -> String {
        match phase {
            GamePhase::WaitingForPlayers => "Waiting for players".to_string(),
            GamePhase::Setup(stage) => format!("Setup: {:?}", stage),
            GamePhase::Charleston(stage) => Self::format_charleston_stage(*stage),
            GamePhase::Playing(stage) => Self::format_turn_stage(stage),
            GamePhase::Scoring(_) => "Scoring".to_string(),
            GamePhase::GameOver(_) => "Game Over".to_string(),
        }
    }

    /// Format Charleston stage for display.
    fn format_charleston_stage(stage: CharlestonStage) -> String {
        match stage {
            CharlestonStage::FirstRight => "Charleston: Pass Right (1st)".to_string(),
            CharlestonStage::FirstAcross => "Charleston: Pass Across (1st)".to_string(),
            CharlestonStage::FirstLeft => "Charleston: Pass Left (1st)".to_string(),
            CharlestonStage::VotingToContinue => "Charleston: Voting".to_string(),
            CharlestonStage::SecondLeft => "Charleston: Pass Left (2nd)".to_string(),
            CharlestonStage::SecondAcross => "Charleston: Pass Across (2nd)".to_string(),
            CharlestonStage::SecondRight => "Charleston: Pass Right (2nd)".to_string(),
            CharlestonStage::CourtesyAcross => "Charleston: Courtesy Pass".to_string(),
            CharlestonStage::Complete => "Charleston: Complete".to_string(),
        }
    }

    /// Format turn stage for display.
    fn format_turn_stage(stage: &TurnStage) -> String {
        match stage {
            TurnStage::Drawing { player } => format!("{:?} drawing", player),
            TurnStage::Discarding { player } => format!("{:?} discarding", player),
            TurnStage::CallWindow { discarded_by, .. } => {
                format!("Call window ({:?}'s discard)", discarded_by)
            }
            TurnStage::AwaitingMahjong { caller, .. } => format!("{:?} awaiting mahjong", caller),
        }
    }

    /// Format turn information showing whose turn and if it's the player's turn.
    fn format_turn(phase: &GamePhase, my_seat: Option<Seat>) -> String {
        match phase {
            GamePhase::Playing(stage) => {
                let active = stage.active_player();
                match (active, my_seat) {
                    (Some(player), Some(me)) if player == me => {
                        format!("{:?} (YOUR TURN)", player)
                    }
                    (Some(player), _) => format!("{:?}", player),
                    (None, Some(me)) => {
                        // Call window - check if we can act
                        if let TurnStage::CallWindow { can_act, .. } = stage {
                            if can_act.contains(&me) {
                                "Call window (YOU CAN ACT)".to_string()
                            } else {
                                "Call window (waiting)".to_string()
                            }
                        } else {
                            "-".to_string()
                        }
                    }
                    (None, None) => "Call window".to_string(),
                }
            }
            GamePhase::Charleston(_) => {
                if my_seat.is_some() {
                    "Select tiles to pass".to_string()
                } else {
                    "-".to_string()
                }
            }
            _ => "-".to_string(),
        }
    }

    /// Format wall remaining count.
    fn format_wall(visible: &VisibleTiles) -> String {
        const TOTAL_TILES: usize = 152;
        const DEAD_WALL: usize = 14;
        const DEALT_TILES: usize = 52;

        let drawable = TOTAL_TILES - DEAD_WALL - DEALT_TILES;
        let remaining = drawable.saturating_sub(visible.tiles_drawn);
        let percent = (visible.wall_depletion() * 100.0) as u8;

        format!("{} tiles remaining ({}% drawn)", remaining, percent)
    }

    /// Render the player's hand.
    fn render_hand(&self, stdout: &mut impl Write) -> Result<()> {
        // TODO: Render the actual hand contents once layout is finalized.
        execute!(
            stdout,
            SetForegroundColor(Color::Green),
            Print("│ YOUR HAND:                                                  │\n"),
            ResetColor,
            Print("│   (waiting for game to start...)                            │\n"),
            SetForegroundColor(Color::Cyan),
            Print("├─────────────────────────────────────────────────────────────┤\n"),
            ResetColor,
        )?;

        Ok(())
    }

    /// Render recent events.
    fn render_events(&self, stdout: &mut impl Write) -> Result<()> {
        execute!(
            stdout,
            SetForegroundColor(Color::Magenta),
            Print("│ RECENT EVENTS:                                              │\n"),
            ResetColor,
        )?;

        if self.event_log.is_empty() {
            execute!(
                stdout,
                Print("│   (no events yet)                                           │\n"),
            )?;
        } else {
            for event in self.event_log.iter().rev().take(5) {
                execute!(
                    stdout,
                    Print(format!("│   {}│\n", Self::pad_to_width(event, 59))),
                )?;
            }
        }

        execute!(
            stdout,
            SetForegroundColor(Color::Cyan),
            Print("├─────────────────────────────────────────────────────────────┤\n"),
            ResetColor,
        )?;

        Ok(())
    }

    /// Render command prompt.
    fn render_prompt(&self, stdout: &mut impl Write) -> Result<()> {
        execute!(
            stdout,
            SetForegroundColor(Color::White),
            Print(format!("│ > {:<58}│\n", self.input_buffer)),
            SetForegroundColor(Color::Cyan),
            Print("└─────────────────────────────────────────────────────────────┘\n"),
            ResetColor,
        )?;

        Ok(())
    }

    /// Read user input (non-blocking).
    ///
    /// Returns `(Option<String>, bool)` where:
    /// - `Option<String>` is `Some(input)` when Enter is pressed
    /// - `bool` is `true` if the input buffer changed (needs re-render)
    pub fn read_input(&mut self) -> (Option<String>, bool) {
        // Check if there's an event available (with short timeout)
        if let Ok(true) = event::poll(Duration::from_millis(10)) {
            if let Ok(Event::Key(KeyEvent { code, kind, .. })) = event::read() {
                // Only handle key press events, not release events
                if kind != KeyEventKind::Press {
                    return (None, false);
                }
                match code {
                    KeyCode::Enter => {
                        let input = self.input_buffer.clone();
                        self.input_buffer.clear();
                        return (Some(input), true);
                    }
                    KeyCode::Char(c) => {
                        self.input_buffer.push(c);
                        return (None, true);
                    }
                    KeyCode::Backspace => {
                        self.input_buffer.pop();
                        return (None, true);
                    }
                    KeyCode::Esc => {
                        // Clear input buffer on Escape
                        self.input_buffer.clear();
                        return (None, true);
                    }
                    _ => {}
                }
            }
        }

        (None, false)
    }

    /// Display an error message.
    pub fn display_error(&mut self, error: &str) -> Result<()> {
        self.add_event_with_color(error, Color::Red);
        Ok(())
    }

    /// Display a help message.
    pub fn display_help(&mut self) -> Result<()> {
        let help_text = r#"
Available Commands:
  discard <index>          - Discard tile at index
  call pung <i1> <i2>      - Call a discard for pung
  pass                     - Pass on a call window
  mahjong                  - Declare mahjong (winning hand)

  state                    - Show full game state
  help                     - Show this help message
  quit / exit              - Exit the client
"#;

        println!("{}", help_text);
        Ok(())
    }

    /// Display full game state.
    pub fn display_full_state(&mut self, state: &GameState) -> Result<()> {
        println!("\nFull Game State:");
        println!("  Connected: {}", state.connected);
        println!("  Authenticated: {}", state.authenticated);
        println!("  Player ID: {:?}", state.player_id);
        println!("  Game ID: {:?}", state.game_id);
        println!();
        Ok(())
    }

    /// Display a game event.
    pub fn display_event(&mut self, event: &serde_json::Value) -> Result<()> {
        let event_str = format!("{:?}", event);
        self.add_event(&event_str);
        Ok(())
    }

    /// Add an event to the log.
    fn add_event(&mut self, event: &str) {
        self.event_log.push(event.to_string());
        if self.event_log.len() > self.max_events {
            self.event_log.remove(0);
        }
    }

    /// Add an event with color.
    fn add_event_with_color(&mut self, event: &str, _color: Color) {
        // TODO: Store per-event color to render richer output.
        self.add_event(event);
    }

    /// Pad string to specified width.
    fn pad_to_width(s: &str, width: usize) -> String {
        if s.len() >= width {
            s[..width].to_string()
        } else {
            format!("{:<width$}", s, width = width)
        }
    }

    /// Cleanup terminal state.
    pub fn cleanup(&mut self) -> Result<()> {
        self.exit_raw_mode()?;
        Ok(())
    }
}

impl Drop for TerminalUI {
    fn drop(&mut self) {
        let _ = self.cleanup();
    }
}
