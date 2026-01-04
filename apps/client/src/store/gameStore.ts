/**
 * Authoritative Game State Store
 *
 * This store mirrors the server's game state and is the SINGLE SOURCE OF TRUTH
 * on the client. It is updated ONLY via game events from the server.
 *
 * RULES:
 * - Never mutate this store directly from UI actions
 * - All mutations happen through applyEvent()
 * - No optimistic updates (server is authoritative)
 * - On reconnect, replace entire state with snapshot
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type {
  GameEvent,
  GamePhase,
  Seat,
  Tile,
  PlayerPublic,
  Hand,
  Meld,
  GameStateSnapshot,
} from '@/types/bindings';

// ===== STATE INTERFACE =====

interface GameState {
  // Core game state
  phase: GamePhase;
  players: Record<string, PlayerPublic>; // Seat -> PlayerPublic
  mySeat: Seat | null;
  turn: Seat | null;
  wallRemaining: number;
  discardPile: Tile[];

  // Local player's hand (private info)
  hand: Hand;

  // Actions
  applyEvent: (event: GameEvent) => void;
  replaceFromSnapshot: (snapshot: GameStateSnapshot) => void;
  reset: () => void;

  // Derived selectors
  isMyTurn: () => boolean;
  canDiscard: () => boolean;
  canCall: () => boolean;
  getCurrentPlayer: () => Seat | null;
}

// ===== INITIAL STATE =====

const initialState = {
  phase: { type: 'WaitingForPlayers' } as GamePhase,
  players: {} as Record<string, PlayerPublic>,
  mySeat: null as Seat | null,
  turn: null as Seat | null,
  wallRemaining: 0,
  discardPile: [] as Tile[],
  hand: {
    concealed: [] as Tile[],
    exposed: [] as Meld[],
  },
};

// ===== STORE =====

export const useGameStore = create<GameState>()(
  immer((set, get) => ({
    ...initialState,

    // ===== EVENT APPLICATION =====

    applyEvent: (event: GameEvent) => {
      const state = get();

      set((draft) => {
        switch (event.type) {
        // ===== GAME LIFECYCLE =====

        case 'GameCreated':
          // Reset to initial state
          Object.assign(draft, initialState);
          break;

        case 'PlayerJoined': {
          draft.players[event.player] = {
            seat: event.player,
            player_id: event.player_id,
            is_bot: event.is_bot,
            status: 'Waiting' as const,
            tile_count: 0,
            exposed_melds: [],
          };
          break;
        }

        case 'GameStarting':
          draft.phase = { type: 'Setup', stage: 'RollingDice' as const };
          break;

        // ===== SETUP PHASE =====

        case 'DiceRolled':
          // Phase transition handled by PhaseChanged event
          break;

        case 'WallBroken':
          // Phase transition handled by PhaseChanged event
          break;

        case 'TilesDealt':
          draft.hand.concealed = event.your_tiles;
          // Update all players' tile counts
          Object.values(draft.players).forEach((player) => {
            player.tile_count = player.seat === state.mySeat ? event.your_tiles.length : 13;
          });
          break;

        // ===== CHARLESTON PHASE =====

        case 'CharlestonPhaseChanged':
          draft.phase = { type: 'Charleston', stage: event.stage };
          break;

        case 'PlayerReadyForPass':
          // Visual feedback can be handled by UI store
          break;

        case 'TilesPassing':
          // Tiles are in transit
          break;

        case 'TilesReceived': {
          // Remove the tiles we passed and add the received tiles
          // Note: Server should ensure hand count is correct
          draft.hand.concealed.push(...event.tiles);
          break;
        }

        case 'PlayerVoted':
          // Vote tracking can be in UI store
          break;

        case 'VoteResult':
          // Result is reflected in next CharlestonPhaseChanged event
          break;

        case 'CharlestonComplete':
          // Next event should be PhaseChanged to Playing
          break;

        // ===== MAIN GAME PHASE =====

        case 'PhaseChanged':
          draft.phase = event.phase;
          break;

        case 'TurnChanged':
          draft.turn = event.player;
          break;

        case 'TileDrawn': {
          draft.wallRemaining = event.remaining_tiles;
          if (event.tile !== null && state.mySeat) {
            // Private event - we drew this tile
            draft.hand.concealed.push(event.tile);
            const player = draft.players[state.mySeat];
            if (player) player.tile_count = draft.hand.concealed.length;
          }
          break;
        }

        case 'TileDiscarded': {
          draft.discardPile.push(event.tile);

          // If we discarded, remove from our hand
          if (event.player === state.mySeat) {
            const index = draft.hand.concealed.indexOf(event.tile);
            if (index !== -1) {
              draft.hand.concealed.splice(index, 1);
            }
          }

          // Update player tile count
          const player = draft.players[event.player];
          if (player) {
            player.tile_count -= 1;
          }
          break;
        }

        case 'CallWindowOpened':
          // UI can show call/pass buttons for eligible players
          break;

        case 'CallWindowClosed':
          // Close call window UI
          break;

        case 'TileCalled': {
          const player = draft.players[event.player];
          if (player) {
            player.exposed_melds.push(event.meld);
            player.tile_count = player.tile_count - event.meld.tiles.length + 1; // -tiles +called
          }

          // If we called, update our hand
          if (event.player === state.mySeat) {
            // Remove tiles from hand (excluding the called tile which came from discard)
            const tilesToRemove = event.meld.tiles.filter((t) => t !== event.called_tile);
            tilesToRemove.forEach((tile) => {
              const index = draft.hand.concealed.indexOf(tile);
              if (index !== -1) {
                draft.hand.concealed.splice(index, 1);
              }
            });
            draft.hand.exposed.push(event.meld);
          }

          // Remove called tile from discard pile
          const discardIndex = draft.discardPile.lastIndexOf(event.called_tile);
          if (discardIndex !== -1) {
            draft.discardPile.splice(discardIndex, 1);
          }
          break;
        }

        // ===== SPECIAL ACTIONS =====

        case 'JokerExchanged': {
          // Update the meld in the target player's exposed melds
          const targetPlayer = draft.players[event.target_seat];
          if (targetPlayer) {
            // Find and update the meld (server should specify which meld)
            // For now, find the first meld with a joker that matches
            for (const meld of targetPlayer.exposed_melds) {
              const jokerIndex = meld.tiles.findIndex((t) => t === event.joker);
              if (jokerIndex !== -1) {
                meld.tiles[jokerIndex] = event.replacement;
                delete meld.joker_assignments[jokerIndex];
                break;
              }
            }
          }

          // If we performed the exchange, update our hand
          if (event.player === state.mySeat) {
            // Remove replacement tile, add joker
            const index = draft.hand.concealed.indexOf(event.replacement);
            if (index !== -1) {
              draft.hand.concealed.splice(index, 1);
            }
            draft.hand.concealed.push(event.joker);
          }

          // Update target player's hand if it's us
          if (event.target_seat === state.mySeat) {
            // Update our exposed melds
            for (const meld of draft.hand.exposed) {
              const jokerIndex = meld.tiles.findIndex((t) => t === event.joker);
              if (jokerIndex !== -1) {
                meld.tiles[jokerIndex] = event.replacement;
                delete meld.joker_assignments[jokerIndex];
                break;
              }
            }
          }
          break;
        }

        case 'BlankExchanged':
          // Blank exchange is secret, no tile revealed
          break;

        // ===== WIN/SCORING =====

        case 'MahjongDeclared':
          // Transition to Scoring phase via PhaseChanged event
          break;

        case 'HandValidated':
          // Validation result displayed by UI
          break;

        case 'GameOver':
          draft.phase = { type: 'GameOver', result: event.result };
          break;

        // ===== ERRORS =====

        case 'CommandRejected':
          // Error handling in UI (toast notification)
          console.error(`Command rejected for ${event.player}: ${event.reason}`);
          break;

        // ===== CONNECTION =====

        case 'PlayerDisconnected': {
          const player = draft.players[event.player];
          if (player) {
            player.status = 'Disconnected';
          }
          break;
        }

        case 'PlayerReconnected': {
          const player = draft.players[event.player];
          if (player) {
            player.status = 'Active';
          }
          break;
        }

        default:
          console.warn('Unhandled event type:', (event as GameEvent).type);
      }
      });
    },

  // ===== SNAPSHOT REPLACEMENT =====

  replaceFromSnapshot: (snapshot: GameStateSnapshot) => {
    set({
      phase: snapshot.phase,
      players: snapshot.players,
      mySeat: snapshot.my_seat,
      turn: snapshot.turn,
      wallRemaining: snapshot.wall_remaining,
      discardPile: snapshot.discard_pile,
      hand: snapshot.hand,
    });
  },

  // ===== RESET =====

  reset: () => {
    set(initialState);
  },

  // ===== DERIVED SELECTORS =====

  isMyTurn: () => {
    const state = get();
    return state.turn === state.mySeat;
  },

  canDiscard: () => {
    const state = get();
    if (!state.isMyTurn()) return false;
    if (state.phase.type !== 'Playing') return false;

    // Extract the stage from the Playing phase
    const stage = state.phase.stage;
    return typeof stage === 'object' && 'Discarding' in stage;
  },

  canCall: () => {
    const state = get();
    if (state.phase.type !== 'Playing') return false;

    // Extract the stage from the Playing phase
    const stage = state.phase.stage;
    return typeof stage === 'object' && 'CallWindow' in stage;
  },

  getCurrentPlayer: () => {
    return get().turn;
  },
})));
