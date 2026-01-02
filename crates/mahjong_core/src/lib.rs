use serde::{Deserialize, Serialize};

/// Represents the broad category of a tile.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Suit {
    Dots,
    Bams,
    Cracks,
    Winds,
    Dragons,
    Flowers,
    Jokers,
}

/// Rank for suited tiles (1-9).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize, PartialOrd, Ord)]
pub enum Rank {
    One = 1,
    Two = 2,
    Three = 3,
    Four = 4,
    Five = 5,
    Six = 6,
    Seven = 7,
    Eight = 8,
    Nine = 9,
}

impl Rank {
    pub fn from_u8(n: u8) -> Option<Self> {
        match n {
            1 => Some(Rank::One),
            2 => Some(Rank::Two),
            3 => Some(Rank::Three),
            4 => Some(Rank::Four),
            5 => Some(Rank::Five),
            6 => Some(Rank::Six),
            7 => Some(Rank::Seven),
            8 => Some(Rank::Eight),
            9 => Some(Rank::Nine),
            _ => None,
        }
    }
}

/// The four winds.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Wind {
    East,
    South,
    West,
    North,
}

/// The three dragons.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum Dragon {
    White, // Soap
    Green,
    Red,
}

/// The internal data carrier for a Tile to ensure type safety.
/// (e.g., A 'Wind' tile cannot have a 'Rank').
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub enum TileKind {
    Suited(Suit, Rank), // Only Dots, Bams, Cracks allowed here
    HonorWind(Wind),
    HonorDragon(Dragon),
    Flower(u8),         // Index 0-7 (or 1-8) to distinguish specific flowers
    Joker,              // All 8 Jokers are usually identical in function
}

/// The main Tile structure.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct Tile {
    pub kind: TileKind,
}

impl Tile {
    /// Creates a new Suited tile (Dots, Bams, Cracks).
    /// Returns None if the suit is not a numbered suit.
    pub fn new_suited(suit: Suit, rank: Rank) -> Option<Self> {
        match suit {
            Suit::Dots | Suit::Bams | Suit::Cracks => Some(Self {
                kind: TileKind::Suited(suit, rank),
            }),
            _ => None,
        }
    }

    pub fn new_wind(wind: Wind) -> Self {
        Self { kind: TileKind::HonorWind(wind) }
    }

    pub fn new_dragon(dragon: Dragon) -> Self {
        Self { kind: TileKind::HonorDragon(dragon) }
    }

    pub fn new_flower(index: u8) -> Self {
        Self { kind: TileKind::Flower(index) }
    }

    pub fn new_joker() -> Self {
        Self { kind: TileKind::Joker }
    }

    /// Returns the broad Category (Suit) of the tile.
    pub fn suit(&self) -> Suit {
        match self.kind {
            TileKind::Suited(s, _) => s,
            TileKind::HonorWind(_) => Suit::Winds,
            TileKind::HonorDragon(_) => Suit::Dragons,
            TileKind::Flower(_) => Suit::Flowers,
            TileKind::Joker => Suit::Jokers,
        }
    }
}
