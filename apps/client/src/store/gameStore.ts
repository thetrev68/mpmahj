/**
 * Authoritative Game State Store
 *
 * Mirrors server state. No optimistic updates.
 * All mutations occur via applyEvent() or applySnapshot().
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import type { DiscardInfo } from '@/types/bindings/generated/DiscardInfo';
import type { Event } from '@/types/bindings/generated/Event';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { GameResult } from '@/types/bindings/generated/GameResult';
import type { GameStateSnapshot } from '@/types/bindings/generated/GameStateSnapshot';
import type { HouseRules } from '@/types/bindings/generated/HouseRules';
import type { Meld } from '@/types/bindings/generated/Meld';
import type { PublicPlayerInfo } from '@/types/bindings/generated/PublicPlayerInfo';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import { normalizeEvent } from '@/utils/events';

interface GameState {
  phase: GamePhase;
  currentTurn: Seat | null;
  dealer: Seat | null;
  roundNumber: number;
  remainingTiles: number;
  discardPile: DiscardInfo[];
  players: Record<Seat, PublicPlayerInfo>;
  houseRules: HouseRules | null;
  yourSeat: Seat | null;
  yourHand: Tile[];

  applyEvent: (event: Event) => void;
  applySnapshot: (snapshot: GameStateSnapshot) => void;
  replaceFromSnapshot: (snapshot: GameStateSnapshot) => void;
  setYourSeat: (seat: Seat | null) => void;
  reset: () => void;

  isMyTurn: () => boolean;
  canDiscard: () => boolean;
  canCall: () => boolean;
  getCurrentPlayer: () => Seat | null;
}

const createInitialState = (): Omit<
  GameState,
  | 'applyEvent'
  | 'applySnapshot'
  | 'replaceFromSnapshot'
  | 'setYourSeat'
  | 'reset'
  | 'isMyTurn'
  | 'canDiscard'
  | 'canCall'
  | 'getCurrentPlayer'
> => ({
  phase: 'WaitingForPlayers',
  currentTurn: null,
  dealer: null,
  roundNumber: 0,
  remainingTiles: 0,
  discardPile: [],
  players: {} as Record<Seat, PublicPlayerInfo>,
  houseRules: null,
  yourSeat: null,
  yourHand: [],
});

const normalizePlayers = (players: PublicPlayerInfo[]): Record<Seat, PublicPlayerInfo> => {
  const record = {} as Record<Seat, PublicPlayerInfo>;
  players.forEach((player) => {
    record[player.seat] = player;
  });
  return record;
};

const removeFirstTile = (hand: Tile[], tile: Tile) => {
  const index = hand.indexOf(tile);
  if (index !== -1) {
    hand.splice(index, 1);
  }
};

const removeTiles = (hand: Tile[], tiles: Tile[]) => {
  const remaining = [...hand];
  tiles.forEach((tile) => {
    const index = remaining.indexOf(tile);
    if (index !== -1) {
      remaining.splice(index, 1);
    }
  });
  hand.splice(0, hand.length, ...remaining);
};

const removeLastDiscard = (discardPile: DiscardInfo[], tile: Tile) => {
  for (let i = discardPile.length - 1; i >= 0; i -= 1) {
    if (discardPile[i].tile === tile) {
      discardPile.splice(i, 1);
      break;
    }
  }
};

const getPlayingStage = (phase: GamePhase): TurnStage | null => {
  if (typeof phase === 'object' && phase !== null && 'Playing' in phase) {
    return phase.Playing;
  }
  return null;
};

export const useGameStore = create<GameState>()(
  immer((set, get) => ({
    ...createInitialState(),

    applyEvent: (event: Event) => {
      set((draft) => {
        const normalized = normalizeEvent(event);
        const innerEvent = normalized.event as Record<string, unknown> | string;

        // Handle string literal events first
        if (typeof innerEvent === 'string') {
          return;
        }

        // TODO: Handle history viewer events (HistoryList, StateRestored, HistoryTruncated, HistoryError).

        if (normalized.kind === 'Private') {
          if ('TilesDealt' in innerEvent) {
            const { your_tiles } = innerEvent.TilesDealt as { your_tiles: Tile[] };
            draft.yourHand = [...your_tiles];
            Object.values(draft.players).forEach((player) => {
              player.tile_count = player.seat === draft.yourSeat ? your_tiles.length : 13;
            });
            return;
          }

          if ('TilesReceived' in innerEvent) {
            const { player, tiles } = innerEvent.TilesReceived as {
              player: Seat;
              tiles: Tile[];
            };
            if (player === draft.yourSeat) {
              draft.yourHand.push(...tiles);
              const entry = draft.players[player];
              if (entry) {
                entry.tile_count = draft.yourHand.length;
              }
            }
            return;
          }

          if ('TilesPassed' in innerEvent) {
            const { player, tiles } = innerEvent.TilesPassed as { player: Seat; tiles: Tile[] };
            if (player === draft.yourSeat) {
              removeTiles(draft.yourHand, tiles);
            }
            return;
          }

          if ('TileDrawnPrivate' in innerEvent) {
            const { tile, remaining_tiles } = innerEvent.TileDrawnPrivate as {
              tile: Tile;
              remaining_tiles: number;
            };
            draft.remainingTiles = remaining_tiles;
            if (draft.currentTurn) {
              const player = draft.players[draft.currentTurn];
              if (player) {
                player.tile_count += 1;
              }
            }
            draft.yourHand.push(tile);
            const player = draft.yourSeat ? draft.players[draft.yourSeat] : undefined;
            if (player) {
              player.tile_count = draft.yourHand.length;
            }
            return;
          }

          if ('ReplacementDrawn' in innerEvent) {
            const { player, tile } = innerEvent.ReplacementDrawn as {
              player: Seat;
              tile: Tile;
            };
            if (player === draft.yourSeat) {
              draft.yourHand.push(tile);
              const entry = draft.players[player];
              if (entry) {
                entry.tile_count = draft.yourHand.length;
              }
            } else {
              const entry = draft.players[player];
              if (entry) {
                entry.tile_count += 1;
              }
            }
            return;
          }
        }

        if (normalized.kind === 'Public') {
          if ('GameCreated' in innerEvent) {
            Object.assign(draft, createInitialState());
            return;
          }

          if ('PlayerJoined' in innerEvent) {
            const { player, player_id, is_bot } = innerEvent.PlayerJoined as {
              player: Seat;
              player_id: string;
              is_bot: boolean;
            };
            draft.players[player] = {
              seat: player,
              player_id,
              is_bot,
              status: 'Waiting',
              tile_count: 0,
              exposed_melds: [],
            };
            return;
          }

          if ('DiceRolled' in innerEvent || 'WallBroken' in innerEvent) {
            return;
          }

          if ('CharlestonPhaseChanged' in innerEvent) {
            draft.phase = { Charleston: (innerEvent.CharlestonPhaseChanged as { stage: CharlestonStage }).stage };
            return;
          }

          if ('PhaseChanged' in innerEvent) {
            draft.phase = (innerEvent.PhaseChanged as { phase: GamePhase }).phase;
            return;
          }

          if ('TurnChanged' in innerEvent) {
            const { player, stage } = innerEvent.TurnChanged as { player: Seat; stage: TurnStage };
            draft.currentTurn = player;
            draft.phase = { Playing: stage };
            return;
          }

          if ('TileDrawnPublic' in innerEvent) {
            const { remaining_tiles } = innerEvent.TileDrawnPublic as { remaining_tiles: number };
            draft.remainingTiles = remaining_tiles;
            if (draft.currentTurn) {
              const player = draft.players[draft.currentTurn];
              if (player) {
                player.tile_count += 1;
              }
            }
            return;
          }

          if ('TileDiscarded' in innerEvent) {
            const { player, tile } = innerEvent.TileDiscarded as { player: Seat; tile: Tile };
            draft.discardPile.push({ tile, discarded_by: player });
            const entry = draft.players[player];
            if (entry) {
              entry.tile_count = Math.max(0, entry.tile_count - 1);
            }
            if (player === draft.yourSeat) {
              removeFirstTile(draft.yourHand, tile);
            }
            return;
          }

          if ('TileCalled' in innerEvent) {
            const { player, meld, called_tile } = innerEvent.TileCalled as {
              player: Seat;
              meld: Meld;
              called_tile: Tile;
            };
            const entry = draft.players[player];
            if (entry) {
              entry.exposed_melds.push(meld);
              entry.tile_count = Math.max(0, entry.tile_count - meld.tiles.length + 1);
            }
            removeLastDiscard(draft.discardPile, called_tile);
            if (player === draft.yourSeat) {
              const tilesToRemove = meld.tiles.filter((tile) => tile !== called_tile);
              removeTiles(draft.yourHand, tilesToRemove);
            }
            return;
          }

          if ('JokerExchanged' in innerEvent) {
            const { player, target_seat, joker, replacement } = innerEvent.JokerExchanged as {
              player: Seat;
              target_seat: Seat;
              joker: Tile;
              replacement: Tile;
            };
            const target = draft.players[target_seat];
            if (target) {
              for (const meld of target.exposed_melds) {
                const index = meld.tiles.findIndex((tile) => tile === joker);
                if (index !== -1) {
                  meld.tiles[index] = replacement;
                  if (meld.joker_assignments[index] !== undefined) {
                    delete meld.joker_assignments[index];
                  }
                  break;
                }
              }
            }

            if (player === draft.yourSeat) {
              removeFirstTile(draft.yourHand, replacement);
              draft.yourHand.push(joker);
            }
            return;
          }

          if ('MahjongDeclared' in innerEvent || 'HandValidated' in innerEvent) {
            return;
          }

          if ('GameOver' in innerEvent) {
            draft.phase = { GameOver: (innerEvent.GameOver as { result: GameResult }).result };
            return;
          }

          if ('CommandRejected' in innerEvent) {
            const { player, reason } = innerEvent.CommandRejected as { player: Seat; reason: string };
            console.error(`Command rejected for ${player}: ${reason}`);
          }
        }
      });
    },

    applySnapshot: (snapshot: GameStateSnapshot) => {
      set({
        phase: snapshot.phase,
        currentTurn: snapshot.current_turn,
        dealer: snapshot.dealer,
        roundNumber: snapshot.round_number,
        remainingTiles: snapshot.remaining_tiles,
        discardPile: snapshot.discard_pile,
        players: normalizePlayers(snapshot.players),
        houseRules: snapshot.house_rules,
        yourSeat: snapshot.your_seat,
        yourHand: snapshot.your_hand,
      });
    },

    replaceFromSnapshot: (snapshot: GameStateSnapshot) => {
      get().applySnapshot(snapshot);
    },

    setYourSeat: (seat: Seat | null) => {
      set((draft) => {
        draft.yourSeat = seat;
      });
    },

    reset: () => {
      set(createInitialState());
    },

    isMyTurn: () => {
      const state = get();
      return state.currentTurn !== null && state.currentTurn === state.yourSeat;
    },

    canDiscard: () => {
      const state = get();
      const stage = getPlayingStage(state.phase);
      if (!stage || !state.yourSeat) return false;
      if ('Discarding' in stage) {
        return stage.Discarding.player === state.yourSeat;
      }
      return false;
    },

    canCall: () => {
      const state = get();
      const stage = getPlayingStage(state.phase);
      if (!stage || !state.yourSeat) return false;
      if ('CallWindow' in stage) {
        return stage.CallWindow.can_act.includes(state.yourSeat);
      }
      return false;
    },

    getCurrentPlayer: () => {
      return get().currentTurn;
    },
  }))
);
