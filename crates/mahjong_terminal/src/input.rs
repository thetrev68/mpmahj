use anyhow::{anyhow, Result};
use serde_json::{json, Value};

/// Command parser for converting user input into Command JSON
pub struct CommandParser;

impl CommandParser {
    pub fn new() -> Self {
        Self
    }

    /// Parse a command string into a JSON command payload
    pub fn parse(&self, input: &str) -> Result<Value> {
        let parts: Vec<&str> = input.split_whitespace().collect();

        if parts.is_empty() {
            return Err(anyhow!("Empty command"));
        }

        let command = parts[0].to_lowercase();

        match command.as_str() {
            "discard" => self.parse_discard(&parts),
            "call" => self.parse_call(&parts),
            "pass" => self.parse_pass(),
            "mahjong" => self.parse_mahjong(),
            "pass-tiles" => self.parse_pass_tiles(&parts),
            "vote" => self.parse_vote(&parts),
            "courtesy-pass" => self.parse_courtesy_pass(&parts),
            "courtesy-accept" => self.parse_courtesy_accept(&parts),
            "exchange-joker" => self.parse_exchange_joker(&parts),
            _ => Err(anyhow!("Unknown command: {}", command)),
        }
    }

    /// Parse "discard <index>" command
    fn parse_discard(&self, parts: &[&str]) -> Result<Value> {
        if parts.len() < 2 {
            return Err(anyhow!("Usage: discard <tile-index>"));
        }

        let tile_index: usize = parts[1]
            .parse()
            .map_err(|_| anyhow!("Invalid tile index: {}", parts[1]))?;

        // For now, return a simplified command structure
        // In a real implementation, we'd need to know the player's seat and actual tile
        Ok(json!({
            "type": "DiscardTile",
            "tile_index": tile_index,
        }))
    }

    /// Parse "call pung <i1> <i2>" or "call kong <i1> <i2> <i3>" command
    fn parse_call(&self, parts: &[&str]) -> Result<Value> {
        if parts.len() < 2 {
            return Err(anyhow!("Usage: call <pung|kong|quint> <tile-indices...>"));
        }

        let meld_type = parts[1].to_lowercase();
        let tile_indices: Result<Vec<usize>> = parts[2..]
            .iter()
            .map(|s| {
                s.parse::<usize>()
                    .map_err(|_| anyhow!("Invalid tile index: {}", s))
            })
            .collect();

        let indices = tile_indices?;

        // Validate meld type and tile count
        match meld_type.as_str() {
            "pung" => {
                if indices.len() != 2 {
                    return Err(anyhow!("Pung requires 2 tiles from hand"));
                }
            }
            "kong" => {
                if indices.len() != 3 {
                    return Err(anyhow!("Kong requires 3 tiles from hand"));
                }
            }
            "quint" => {
                if indices.len() != 4 {
                    return Err(anyhow!("Quint requires 4 tiles from hand"));
                }
            }
            _ => {
                return Err(anyhow!("Invalid meld type: {}", meld_type));
            }
        }

        Ok(json!({
            "type": "CallTile",
            "meld_type": meld_type,
            "tile_indices": indices,
        }))
    }

    /// Parse "pass" command
    fn parse_pass(&self) -> Result<Value> {
        Ok(json!({
            "type": "Pass",
        }))
    }

    /// Parse "mahjong" command
    fn parse_mahjong(&self) -> Result<Value> {
        Ok(json!({
            "type": "DeclareMahjong",
        }))
    }

    /// Parse "pass-tiles <i1> <i2> <i3>" command for Charleston
    fn parse_pass_tiles(&self, parts: &[&str]) -> Result<Value> {
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

        // Check for blind pass flag
        let blind_count = if parts.len() > 5 && parts[4] == "--blind" {
            parts[5]
                .parse::<u8>()
                .map_err(|_| anyhow!("Invalid blind count: {}", parts[5]))?
        } else {
            0
        };

        Ok(json!({
            "type": "PassTiles",
            "tile_indices": indices,
            "blind_count": blind_count,
        }))
    }

    /// Parse "vote continue|stop" command
    fn parse_vote(&self, parts: &[&str]) -> Result<Value> {
        if parts.len() < 2 {
            return Err(anyhow!("Usage: vote <continue|stop>"));
        }

        let vote = match parts[1].to_lowercase().as_str() {
            "continue" => "Continue",
            "stop" => "Stop",
            _ => return Err(anyhow!("Vote must be 'continue' or 'stop'")),
        };

        Ok(json!({
            "type": "VoteCharleston",
            "vote": vote,
        }))
    }

    /// Parse "courtesy-pass <count>" command
    fn parse_courtesy_pass(&self, parts: &[&str]) -> Result<Value> {
        if parts.len() < 2 {
            return Err(anyhow!("Usage: courtesy-pass <tile-count>"));
        }

        let tile_count: u8 = parts[1]
            .parse()
            .map_err(|_| anyhow!("Invalid tile count: {}", parts[1]))?;

        if tile_count > 3 {
            return Err(anyhow!("Courtesy pass can only be 0-3 tiles"));
        }

        Ok(json!({
            "type": "ProposeCourtesyPass",
            "tile_count": tile_count,
        }))
    }

    /// Parse "courtesy-accept <i1> <i2> <i3>" command
    fn parse_courtesy_accept(&self, parts: &[&str]) -> Result<Value> {
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

        Ok(json!({
            "type": "CourtesyAccept",
            "tile_indices": indices,
        }))
    }

    /// Parse "exchange-joker <player> <meld-index> <tile-index>" command
    fn parse_exchange_joker(&self, parts: &[&str]) -> Result<Value> {
        if parts.len() < 4 {
            return Err(anyhow!(
                "Usage: exchange-joker <player> <meld-index> <tile-index>"
            ));
        }

        let player = parts[1];
        let meld_index: usize = parts[2]
            .parse()
            .map_err(|_| anyhow!("Invalid meld index: {}", parts[2]))?;
        let tile_index: usize = parts[3]
            .parse()
            .map_err(|_| anyhow!("Invalid tile index: {}", parts[3]))?;

        Ok(json!({
            "type": "ExchangeJoker",
            "target_player": player,
            "meld_index": meld_index,
            "replacement_tile_index": tile_index,
        }))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_discard() {
        let parser = CommandParser::new();
        let result = parser.parse("discard 5");
        assert!(result.is_ok());
        let cmd = result.unwrap();
        assert_eq!(cmd["type"], "DiscardTile");
        assert_eq!(cmd["tile_index"], 5);
    }

    #[test]
    fn test_parse_call_pung() {
        let parser = CommandParser::new();
        let result = parser.parse("call pung 1 2");
        assert!(result.is_ok());
        let cmd = result.unwrap();
        assert_eq!(cmd["type"], "CallTile");
        assert_eq!(cmd["meld_type"], "pung");
    }

    #[test]
    fn test_parse_pass() {
        let parser = CommandParser::new();
        let result = parser.parse("pass");
        assert!(result.is_ok());
        assert_eq!(result.unwrap()["type"], "Pass");
    }

    #[test]
    fn test_parse_mahjong() {
        let parser = CommandParser::new();
        let result = parser.parse("mahjong");
        assert!(result.is_ok());
        assert_eq!(result.unwrap()["type"], "DeclareMahjong");
    }

    #[test]
    fn test_parse_vote() {
        let parser = CommandParser::new();
        let result = parser.parse("vote continue");
        assert!(result.is_ok());
        assert_eq!(result.unwrap()["vote"], "Continue");
    }

    #[test]
    fn test_invalid_command() {
        let parser = CommandParser::new();
        let result = parser.parse("invalid");
        assert!(result.is_err());
    }
}
