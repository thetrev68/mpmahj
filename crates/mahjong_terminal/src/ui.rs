//! Terminal UI rendering and input handling using crossterm.
//!
//! The UI is intentionally simple and optimized for debugging game flow.
//! Rendering uses a fixed-width box layout updated on each tick.

use anyhow::Result;
use crossterm::{
    cursor,
    event::{self, Event, KeyCode, KeyEvent},
    execute,
    style::{Color, Print, ResetColor, SetForegroundColor},
    terminal::{self, ClearType},
};
use std::io::{stdout, Write};
use std::time::Duration;

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
    #[allow(dead_code)]
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

        // Hand section (placeholder)
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
        let player_id = state.player_id.as_deref().unwrap_or("None");

        execute!(
            stdout,
            Print(format!(
                "│ Status: {} | Player: {:<20} │\n",
                connection_status, player_id
            )),
            SetForegroundColor(Color::Cyan),
            Print("├─────────────────────────────────────────────────────────────┤\n"),
            ResetColor,
        )?;

        Ok(())
    }

    /// Render game state section.
    fn render_game_state(&self, stdout: &mut impl Write, _state: &GameState) -> Result<()> {
        // TODO: Render the live phase, turn, and wall counts from GameState.
        execute!(
            stdout,
            SetForegroundColor(Color::Yellow),
            Print("│ GAME STATE:                                                 │\n"),
            ResetColor,
            Print("│   Phase: Waiting                                            │\n"),
            Print("│   Turn: -                                                   │\n"),
            Print("│   Wall: -                                                   │\n"),
            SetForegroundColor(Color::Cyan),
            Print("├─────────────────────────────────────────────────────────────┤\n"),
            ResetColor,
        )?;

        Ok(())
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
    /// Returns `Some(String)` when the user presses Enter.
    pub fn read_input(&mut self) -> Option<String> {
        // Check if there's an event available (with short timeout)
        if event::poll(Duration::from_millis(100)).ok()? {
            if let Ok(Event::Key(KeyEvent { code, .. })) = event::read() {
                match code {
                    KeyCode::Enter => {
                        let input = self.input_buffer.clone();
                        self.input_buffer.clear();
                        return Some(input);
                    }
                    KeyCode::Char(c) => {
                        self.input_buffer.push(c);
                    }
                    KeyCode::Backspace => {
                        self.input_buffer.pop();
                    }
                    KeyCode::Esc => {
                        // Clear input buffer on Escape
                        self.input_buffer.clear();
                    }
                    _ => {}
                }
            }
        }

        None
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
