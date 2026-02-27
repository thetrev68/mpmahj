//! Private or pair-scoped events visible to specific seats.
//!
//! These events are sent selectively, either to a single player or to a pair
//! during courtesy pass coordination.

use crate::{event::types::ReplacementReason, player::Seat, tile::Tile};
use serde::{Deserialize, Serialize};
use ts_rs::TS;

/// Context describing why tiles are arriving in a player's staging area.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum IncomingContext {
    /// Tiles arriving from a Charleston pass.
    Charleston,
    /// Tile drawn from the wall.
    Draw,
    /// Tile arriving as a result of a called discard.
    CalledTile,
    /// Tile arriving as a joker or blank exchange.
    Exchange,
}

/// Events routed to a single player or a courtesy pass pair.
#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export)]
#[ts(export_to = "../../../apps/client/src/types/bindings/generated/")]
pub enum PrivateEvent {
    /// Initial tiles dealt to a player (private).
    TilesDealt {
        /// Tiles dealt to the recipient.
        your_tiles: Vec<Tile>,
    },
    /// You passed tiles during Charleston or courtesy exchange.
    TilesPassed {
        /// Seat that passed tiles.
        player: Seat,
        /// Tiles that were passed.
        tiles: Vec<Tile>,
    },
    /// You received tiles from a pass.
    TilesReceived {
        /// Seat receiving tiles.
        player: Seat,
        /// Tiles received.
        tiles: Vec<Tile>,
        /// Optional seat tiles came from (hidden for blind passes).
        from: Option<Seat>,
    },
    /// Tile drawn with value visible only to the drawer.
    TileDrawnPrivate {
        /// Tile drawn from the wall.
        tile: Tile,
        /// Remaining tiles after the draw.
        remaining_tiles: usize,
    },
    /// Player drew a replacement tile (Kong, Quint, or blank exchange).
    ReplacementDrawn {
        /// Seat drawing the replacement.
        player: Seat,
        /// Replacement tile.
        tile: Tile,
        /// Reason for the replacement draw.
        reason: ReplacementReason,
    },
    /// Player proposed a courtesy pass tile count (pair-private).
    CourtesyPassProposed {
        /// Seat proposing the count.
        player: Seat,
        /// Proposed tile count.
        tile_count: u8,
    },
    /// Courtesy pass pair proposed different counts (pair-private).
    CourtesyPassMismatch {
        /// Courtesy pair seats.
        pair: (Seat, Seat),
        /// Proposed counts in order of the pair tuple.
        proposed: (u8, u8),
        /// Agreed count (smallest value wins).
        agreed_count: u8,
    },
    /// Courtesy pass pair agreed and is ready to exchange (pair-private).
    CourtesyPairReady {
        /// Courtesy pair seats.
        pair: (Seat, Seat),
        /// Tile count to exchange.
        tile_count: u8,
    },
    /// Tiles have arrived in a player's staging area and await a decision.
    ///
    /// The recipient should display these tiles in the staging UI before
    /// committing a pass, discard, or other action. Tiles must not be applied
    /// directly to the hand until the player acts.
    IncomingTilesStaged {
        /// Seat receiving the tiles.
        player: Seat,
        /// Tiles now in the staging area.
        tiles: Vec<Tile>,
        /// Seat the tiles came from, or `None` when the source is hidden
        /// (e.g., blind Charleston stages) or not applicable (Draw).
        from: Option<Seat>,
        /// Why these tiles are arriving.
        context: IncomingContext,
    },
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn export_bindings_private_event() {
        use ts_rs::TS;
        PrivateEvent::export().expect("Failed to export PrivateEvent");
    }
}
