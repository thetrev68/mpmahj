//! Command-line input parsing for the terminal client.
//!
//! This module converts text commands into GameCommand enum values.
//! It intentionally keeps parsing lightweight and defers validation
//! to server-side logic where possible.

use anyhow::{anyhow, Result};
use mahjong_core::command::GameCommand;
use mahjong_core::flow::CharlestonVote;
use mahjong_core::hand::Hand;
use mahjong_core::meld::{Meld, MeldType};
use mahjong_core::player::Seat;
use mahjong_core::tile::Tile;

/// Command parser for converting user input into GameCommand values.
pub struct CommandParser;

impl CommandParser {
    /// Create a new command parser.
    ///
    /// # Examples
    ///
    /// ```
    /// use mahjong_terminal::input::CommandParser;
    ///
    /// let parser = CommandParser::new();
    /// ```
    pub fn new() -> Self {
        Self
    }

    /// Parse a command string into a GameCommand.
    ///
    /// # Arguments
    ///
    /// * `input` - The command string from the user
    /// * `seat` - The seat of the player issuing the command (required for most commands)
    /// * `hand` - The player's current hand (required for tile index lookups)
    ///
    /// # Errors
    ///
    /// Returns an error for unknown commands or invalid arguments.
    pub fn parse(&self, input: &str, seat: Seat, hand: &Hand) -> Result<GameCommand> {
        let parts: Vec<&str> = input.split_whitespace().collect();

        if parts.is_empty() {
            return Err(anyhow!("Empty command"));
        }

        let command = parts[0].to_lowercase();

        match command.as_str() {
            "discard" => self.parse_discard(&parts, seat, hand),
            "call" => self.parse_call(&parts, seat),
            "pass" => self.parse_pass(seat),
            "mahjong" => self.parse_mahjong(seat, hand),
            "pass-tiles" => self.parse_pass_tiles(&parts, seat, hand),
            "vote" => self.parse_vote(&parts, seat),
            "courtesy-pass" => self.parse_courtesy_pass(&parts, seat),
            "courtesy-accept" => self.parse_courtesy_accept(&parts, seat, hand),
            "exchange-joker" => self.parse_exchange_joker(&parts, seat, hand),
            _ => Err(anyhow!("Unknown command: {}", command)),
        }
    }

    /// Parse `discard <index>` command.
    fn parse_discard(&self, parts: &[&str], player: Seat, hand: &Hand) -> Result<GameCommand> {
        if parts.len() < 2 {
            return Err(anyhow!("Usage: discard <tile-index>"));
        }

        let tile_index: usize = parts[1]
            .parse()
            .map_err(|_| anyhow!("Invalid tile index: {}", parts[1]))?;

        // Map tile index to actual tile in hand
        let tile = *hand
            .concealed
            .get(tile_index)
            .ok_or_else(|| anyhow!("Tile index {} out of range", tile_index))?;

        Ok(GameCommand::DiscardTile { player, tile })
    }

    /// Parse `call pung <i1> <i2>` or `call kong <i1> <i2> <i3>` command.
    fn parse_call(&self, parts: &[&str], player: Seat) -> Result<GameCommand> {
        if parts.len() < 2 {
            return Err(anyhow!("Usage: call <pung|kong|quint> <tile-indices...>"));
        }

        let meld_type_str = parts[1].to_lowercase();
        let tile_indices: Result<Vec<usize>> = parts[2..]
            .iter()
            .map(|s| {
                s.parse::<usize>()
                    .map_err(|_| anyhow!("Invalid tile index: {}", s))
            })
            .collect();

        let _indices = tile_indices?;

        // Validate meld type
        let meld_type = match meld_type_str.as_str() {
            "pung" => MeldType::Pung,
            "kong" => MeldType::Kong,
            "quint" => MeldType::Quint,
            _ => return Err(anyhow!("Invalid meld type: {}", meld_type_str)),
        };

        // Create a placeholder meld - server will reconstruct properly from context
        // We use Tile(0) as a dummy since the server knows which tile was discarded
        let dummy_tile = Tile::new(0);
        let tiles = vec![dummy_tile; meld_type.tile_count()];
        let meld = Meld::new(meld_type, tiles, Some(dummy_tile))
            .map_err(|e| anyhow!("Failed to create meld: {:?}", e))?;

        Ok(GameCommand::CallTile { player, meld })
    }

    /// Parse "pass" command.
    fn parse_pass(&self, player: Seat) -> Result<GameCommand> {
        Ok(GameCommand::Pass { player })
    }

    /// Parse "mahjong" command.
    fn parse_mahjong(&self, player: Seat, hand: &Hand) -> Result<GameCommand> {
        Ok(GameCommand::DeclareMahjong {
            player,
            hand: hand.clone(),
            winning_tile: None, // Server determines from context
        })
    }

    /// Parse `pass-tiles <i1> <i2> <i3>` command for Charleston.
    fn parse_pass_tiles(&self, parts: &[&str], player: Seat, hand: &Hand) -> Result<GameCommand> {
        if parts.len() < 4 {
            return Err(anyhow!("Usage: pass-tiles <tile1> <tile2> <tile3>"));
        }

        let tile_indices: Result<Vec<usize>> = parts[1..4]
            .iter()
            .map(|s| {
                s.parse::<usize>()
                    .map_err(|_| anyhow!("Invalid tile index: {}", s))
            })
            .collect();

        let indices = tile_indices?;

        // Map indices to actual tiles
        let tiles: Result<Vec<Tile>> = indices
            .iter()
            .map(|&idx| {
                hand.concealed
                    .get(idx)
                    .copied()
                    .ok_or_else(|| anyhow!("Tile index {} out of range", idx))
            })
            .collect();

        let tiles = tiles?;

        // Check for blind pass flag.
        let blind_count = if parts.len() > 5 && parts[4] == "--blind" {
            Some(
                parts[5]
                    .parse::<u8>()
                    .map_err(|_| anyhow!("Invalid blind count: {}", parts[5]))?,
            )
        } else {
            None
        };

        Ok(GameCommand::PassTiles {
            player,
            tiles,
            blind_pass_count: blind_count,
        })
    }

    /// Parse "vote continue|stop" command.
    fn parse_vote(&self, parts: &[&str], player: Seat) -> Result<GameCommand> {
        if parts.len() < 2 {
            return Err(anyhow!("Usage: vote <continue|stop>"));
        }

        let vote = match parts[1].to_lowercase().as_str() {
            "continue" => CharlestonVote::Continue,
            "stop" => CharlestonVote::Stop,
            _ => return Err(anyhow!("Vote must be 'continue' or 'stop'")),
        };

        Ok(GameCommand::VoteCharleston { player, vote })
    }

    /// Parse `courtesy-pass <count>` command.
    fn parse_courtesy_pass(&self, parts: &[&str], player: Seat) -> Result<GameCommand> {
        if parts.len() < 2 {
            return Err(anyhow!("Usage: courtesy-pass <tile-count>"));
        }

        let tile_count: u8 = parts[1]
            .parse()
            .map_err(|_| anyhow!("Invalid tile count: {}", parts[1]))?;

        if tile_count > 3 {
            return Err(anyhow!("Courtesy pass can only be 0-3 tiles"));
        }

        Ok(GameCommand::ProposeCourtesyPass {
            player,
            tile_count,
        })
    }

    /// Parse `courtesy-accept <i1> <i2> <i3>` command.
    fn parse_courtesy_accept(
        &self,
        parts: &[&str],
        player: Seat,
        hand: &Hand,
    ) -> Result<GameCommand> {
        if parts.len() < 2 {
            return Err(anyhow!("Usage: courtesy-accept <tile-indices...>"));
        }

        let tile_indices: Result<Vec<usize>> = parts[1..]
            .iter()
            .map(|s| {
                s.parse::<usize>()
                    .map_err(|_| anyhow!("Invalid tile index: {}", s))
            })
            .collect();

        let indices = tile_indices?;

        if indices.len() > 3 {
            return Err(anyhow!("Can't accept more than 3 tiles"));
        }

        // Map indices to actual tiles
        let tiles: Result<Vec<Tile>> = indices
            .iter()
            .map(|&idx| {
                hand.concealed
                    .get(idx)
                    .copied()
                    .ok_or_else(|| anyhow!("Tile index {} out of range", idx))
            })
            .collect();

        Ok(GameCommand::AcceptCourtesyPass {
            player,
            tiles: tiles?,
        })
    }

    /// Parse `exchange-joker <player> <meld-index> <tile-index>` command.
    fn parse_exchange_joker(
        &self,
        parts: &[&str],
        player: Seat,
        hand: &Hand,
    ) -> Result<GameCommand> {
        if parts.len() < 4 {
            return Err(anyhow!(
                "Usage: exchange-joker <player> <meld-index> <tile-index>"
            ));
        }

        let target_seat = self.parse_seat(parts[1])?;
        let meld_index: usize = parts[2]
            .parse()
            .map_err(|_| anyhow!("Invalid meld index: {}", parts[2]))?;
        let tile_index: usize = parts[3]
            .parse()
            .map_err(|_| anyhow!("Invalid tile index: {}", parts[3]))?;

        let replacement = *hand
            .concealed
            .get(tile_index)
            .ok_or_else(|| anyhow!("Tile index {} out of range", tile_index))?;

        Ok(GameCommand::ExchangeJoker {
            player,
            target_seat,
            meld_index,
            replacement,
        })
    }

    /// Helper to parse seat names (east/south/west/north).
    fn parse_seat(&self, s: &str) -> Result<Seat> {
        match s.to_lowercase().as_str() {
            "east" | "e" => Ok(Seat::East),
            "south" | "s" => Ok(Seat::South),
            "west" | "w" => Ok(Seat::West),
            "north" | "n" => Ok(Seat::North),
            _ => Err(anyhow!("Invalid seat: {}", s)),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use mahjong_core::tile::tiles::*;

    #[test]
    /// Ensures discard parsing returns the expected GameCommand.
    fn test_parse_discard() {
        let parser = CommandParser::new();
        let mut hand = Hand::empty();
        hand.concealed = vec![DOT_1, DOT_2, DOT_3, DOT_4, DOT_5];

        let result = parser.parse("discard 2", Seat::East, &hand);
        assert!(result.is_ok());
        let cmd = result.unwrap();
        assert!(matches!(cmd, GameCommand::DiscardTile { player: Seat::East, tile } if tile == DOT_3));
    }

    #[test]
    /// Ensures pung calls are parsed with the correct meld type.
    fn test_parse_call_pung() {
        let parser = CommandParser::new();
        let hand = Hand::empty();
        let result = parser.parse("call pung 1 2", Seat::East, &hand);
        assert!(result.is_ok());
        let cmd = result.unwrap();
        assert!(matches!(cmd, GameCommand::CallTile { player: Seat::East, .. }));
    }

    #[test]
    /// Ensures pass commands parse successfully.
    fn test_parse_pass() {
        let parser = CommandParser::new();
        let hand = Hand::empty();
        let result = parser.parse("pass", Seat::East, &hand);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), GameCommand::Pass { player: Seat::East }));
    }

    #[test]
    /// Ensures mahjong commands parse successfully.
    fn test_parse_mahjong() {
        let parser = CommandParser::new();
        let hand = Hand::empty();
        let result = parser.parse("mahjong", Seat::East, &hand);
        assert!(result.is_ok());
        assert!(matches!(result.unwrap(), GameCommand::DeclareMahjong { .. }));
    }

    #[test]
    /// Ensures vote parsing captures the chosen option.
    fn test_parse_vote() {
        let parser = CommandParser::new();
        let hand = Hand::empty();
        let result = parser.parse("vote continue", Seat::East, &hand);
        assert!(result.is_ok());
        assert!(matches!(
            result.unwrap(),
            GameCommand::VoteCharleston {
                vote: CharlestonVote::Continue,
                ..
            }
        ));
    }

    #[test]
    /// Ensures unknown commands return an error.
    fn test_invalid_command() {
        let parser = CommandParser::new();
        let hand = Hand::empty();
        let result = parser.parse("invalid", Seat::East, &hand);
        assert!(result.is_err());
    }
}

