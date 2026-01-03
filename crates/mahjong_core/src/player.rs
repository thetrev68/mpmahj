//! Player entity and state for American Mahjong.

use crate::hand::Hand;
use serde::{Deserialize, Serialize};

/// A player at the mahjong table.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Player {
    pub id: PlayerId,
    pub seat: Seat,
    pub hand: Hand,
    pub is_bot: bool,
    pub status: PlayerStatus,
}

/// Unique identifier for a player (could be UUID, username, etc.)
pub type PlayerId = String;

/// The four seats at the mahjong table.
/// In American Mahjong, East is always the dealer for the first round.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Seat {
    East,
    South,
    West,
    North,
}

impl Seat {
    /// Get the player to the right (turn order: East → South → West → North → East).
    pub fn right(&self) -> Seat {
        match self {
            Seat::East => Seat::South,
            Seat::South => Seat::West,
            Seat::West => Seat::North,
            Seat::North => Seat::East,
        }
    }

    /// Get the player across the table.
    pub fn across(&self) -> Seat {
        match self {
            Seat::East => Seat::West,
            Seat::West => Seat::East,
            Seat::South => Seat::North,
            Seat::North => Seat::South,
        }
    }

    /// Get the player to the left.
    pub fn left(&self) -> Seat {
        match self {
            Seat::East => Seat::North,
            Seat::North => Seat::West,
            Seat::West => Seat::South,
            Seat::South => Seat::East,
        }
    }

    /// Get all seats in turn order starting from East.
    pub fn all() -> [Seat; 4] {
        [Seat::East, Seat::South, Seat::West, Seat::North]
    }

    /// Get the index of this seat (0-3).
    pub fn index(&self) -> usize {
        match self {
            Seat::East => 0,
            Seat::South => 1,
            Seat::West => 2,
            Seat::North => 3,
        }
    }

    /// Get a seat from an index (0-3).
    pub fn from_index(index: usize) -> Option<Seat> {
        match index {
            0 => Some(Seat::East),
            1 => Some(Seat::South),
            2 => Some(Seat::West),
            3 => Some(Seat::North),
            _ => None,
        }
    }
}

/// Player status during the game.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum PlayerStatus {
    /// Player is actively playing
    Active,

    /// Player has an invalid hand (wrong tile count, etc.)
    /// In American Mahjong, this can happen if a player miscounts during Charleston
    Dead,

    /// Player is waiting (e.g., for game to start)
    Waiting,

    /// Player has disconnected
    Disconnected,
}

impl Player {
    /// Create a new player.
    pub fn new(id: PlayerId, seat: Seat, is_bot: bool) -> Self {
        Player {
            id,
            seat,
            hand: Hand::empty(),
            is_bot,
            status: PlayerStatus::Waiting,
        }
    }

    /// Check if the player is actively playing.
    pub fn is_active(&self) -> bool {
        matches!(self.status, PlayerStatus::Active)
    }

    /// Check if the player can take actions.
    pub fn can_act(&self) -> bool {
        matches!(self.status, PlayerStatus::Active | PlayerStatus::Waiting)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_seat_navigation() {
        assert_eq!(Seat::East.right(), Seat::South);
        assert_eq!(Seat::South.right(), Seat::West);
        assert_eq!(Seat::West.right(), Seat::North);
        assert_eq!(Seat::North.right(), Seat::East);

        assert_eq!(Seat::East.left(), Seat::North);
        assert_eq!(Seat::North.left(), Seat::West);
        assert_eq!(Seat::West.left(), Seat::South);
        assert_eq!(Seat::South.left(), Seat::East);

        assert_eq!(Seat::East.across(), Seat::West);
        assert_eq!(Seat::West.across(), Seat::East);
        assert_eq!(Seat::South.across(), Seat::North);
        assert_eq!(Seat::North.across(), Seat::South);
    }

    #[test]
    fn test_seat_index() {
        assert_eq!(Seat::East.index(), 0);
        assert_eq!(Seat::South.index(), 1);
        assert_eq!(Seat::West.index(), 2);
        assert_eq!(Seat::North.index(), 3);

        assert_eq!(Seat::from_index(0), Some(Seat::East));
        assert_eq!(Seat::from_index(1), Some(Seat::South));
        assert_eq!(Seat::from_index(2), Some(Seat::West));
        assert_eq!(Seat::from_index(3), Some(Seat::North));
        assert_eq!(Seat::from_index(4), None);
    }

    #[test]
    fn test_player_creation() {
        let player = Player::new("player1".to_string(), Seat::East, false);
        assert_eq!(player.id, "player1");
        assert_eq!(player.seat, Seat::East);
        assert!(!player.is_bot);
        assert_eq!(player.status, PlayerStatus::Waiting);
        assert_eq!(player.hand.total_tiles(), 0);
    }

    #[test]
    fn test_player_status() {
        let mut player = Player::new("player1".to_string(), Seat::East, false);

        assert!(!player.is_active());
        assert!(player.can_act());

        player.status = PlayerStatus::Active;
        assert!(player.is_active());
        assert!(player.can_act());

        player.status = PlayerStatus::Dead;
        assert!(!player.is_active());
        assert!(!player.can_act());
    }

    #[test]
    fn test_all_seats() {
        let seats = Seat::all();
        assert_eq!(seats.len(), 4);
        assert_eq!(seats[0], Seat::East);
        assert_eq!(seats[1], Seat::South);
        assert_eq!(seats[2], Seat::West);
        assert_eq!(seats[3], Seat::North);
    }
}
