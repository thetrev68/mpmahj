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
import type { HistoryMode } from '@/types/bindings/generated/HistoryMode';
import type { MoveHistorySummary } from '@/types/bindings/generated/MoveHistorySummary';
import { normalizeEvent } from '@/utils/events';
import { formatEvent } from '@/utils/eventFormatter';
import { tileToString } from '@/utils/tileFormatter';
import { useUIStore } from './uiStore';
import { analysisStore, type HintSource } from './analysisStore';
import type { AnalysisEvent } from '@/types/bindings/generated/AnalysisEvent';

interface UndoState {
  canUndo: boolean;
  lastAction?: string;
  lastActionSeat?: Seat;
  pendingRequest?: {
    requestedBy: Seat;
    action: string;
    votes: Record<Seat, boolean | null>;
  };
  isExecuting: boolean;
}

interface HistoryState {
  moves: MoveHistorySummary[];
  currentMove: number;
  isViewingHistory: boolean;
  viewingMove?: number;
}

interface GameState {
  phase: GamePhase;
  currentTurn: Seat | null;
  dealer: Seat | null;
  roundNumber: number;
  remainingTiles: number;
  discardPile: DiscardInfo[];
  players: Record<Seat, PublicPlayerInfo>;
  meldSources: Record<Seat, Array<Seat | null>>;
  houseRules: HouseRules | null;
  yourSeat: Seat | null;
  yourHand: Tile[];
  isPaused: boolean;
  pausedBy: Seat | null;
  hostSeat: Seat | null;
  undoState: UndoState;
  history: HistoryState;
  lastSnapshotAt: number | null;

  applyEvent: (event: Event) => void;
  applySnapshot: (snapshot: GameStateSnapshot) => void;
  replaceFromSnapshot: (snapshot: GameStateSnapshot) => void;
  setYourSeat: (seat: Seat | null) => void;
  setHostSeat: (seat: Seat | null) => void;
  reset: () => void;
  setUndoExecuting: (isExecuting: boolean) => void;

  isMyTurn: () => boolean;
  canDiscard: () => boolean;
  canCall: () => boolean;
  getCurrentPlayer: () => Seat | null;
  isHost: () => boolean;
}

const createInitialState = (): Omit<
  GameState,
  | 'applyEvent'
  | 'applySnapshot'
  | 'replaceFromSnapshot'
  | 'setYourSeat'
  | 'setHostSeat'
  | 'reset'
  | 'setUndoExecuting'
  | 'isMyTurn'
  | 'canDiscard'
  | 'canCall'
  | 'getCurrentPlayer'
  | 'isHost'
> => ({
  phase: 'WaitingForPlayers',
  currentTurn: null,
  dealer: null,
  roundNumber: 0,
  remainingTiles: 0,
  discardPile: [],
  players: {} as Record<Seat, PublicPlayerInfo>,
  meldSources: {} as Record<Seat, Array<Seat | null>>,
  houseRules: null,
  yourSeat: null,
  yourHand: [],
  isPaused: false,
  pausedBy: null,
  hostSeat: null,
  undoState: {
    canUndo: false,
    lastAction: undefined,
    lastActionSeat: undefined,
    pendingRequest: undefined,
    isExecuting: false,
  },
  history: {
    moves: [],
    currentMove: 0,
    isViewingHistory: false,
    viewingMove: undefined,
  },
  lastSnapshotAt: null,
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

const removeLastDiscard = (discardPile: DiscardInfo[], tile: Tile): DiscardInfo | null => {
  for (let i = discardPile.length - 1; i >= 0; i -= 1) {
    if (discardPile[i].tile === tile) {
      const [removed] = discardPile.splice(i, 1);
      return removed;
    }
  }
  return null;
};

const getPlayingStage = (phase: GamePhase): TurnStage | null => {
  if (typeof phase === 'object' && phase !== null && 'Playing' in phase) {
    return phase.Playing;
  }
  return null;
};

const orderedSeats: Seat[] = ['East', 'South', 'West', 'North'];

export const useGameStore = create<GameState>()(
  immer((set, get) => ({
    ...createInitialState(),

    applyEvent: (event: Event) => {
      // Format and log the event
      const { message, category } = formatEvent(event);
      useUIStore.getState().addEvent(message, category);

      set((draft) => {
        const normalized = normalizeEvent(event);
        const innerEvent = normalized.event as Record<string, unknown> | string;

        console.log('=== APPLY EVENT ===', normalized.kind, Object.keys(innerEvent));

        // Handle string literal events first
        if (typeof innerEvent === 'string') {
          if (innerEvent === 'CourtesyPassComplete') {
            useUIStore.getState().resetCourtesyPassState();
          }
          return;
        }

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
            draft.undoState.lastAction = `pass ${tiles.length} tile${tiles.length === 1 ? '' : 's'}`;
            draft.undoState.lastActionSeat = player;
            if (player === draft.yourSeat) {
              removeTiles(draft.yourHand, tiles);
              draft.undoState.canUndo = true;
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

          if ('CourtesyPassProposed' in innerEvent) {
            const { tile_count } = innerEvent.CourtesyPassProposed as {
              player: Seat;
              tile_count: number;
            };
            useUIStore.getState().setPartnerCourtesyProposal(tile_count);
            return;
          }

          if ('CourtesyPassMismatch' in innerEvent) {
            const { agreed_count } = innerEvent.CourtesyPassMismatch as {
              pair: [Seat, Seat];
              proposed: [number, number];
              agreed_count: number;
            };
            useUIStore.getState().setCourtesyPassAgreedCount(agreed_count);
            return;
          }

          if ('CourtesyPairReady' in innerEvent) {
            const { tile_count } = innerEvent.CourtesyPairReady as {
              pair: [Seat, Seat];
              tile_count: number;
            };
            useUIStore.getState().setCourtesyPassAgreedCount(tile_count);
            return;
          }
        }

        if (normalized.kind === 'Public') {
          if ('HistoryList' in innerEvent) {
            const { entries } = innerEvent.HistoryList as { entries: MoveHistorySummary[] };
            const lastMove = entries.length > 0 ? entries[entries.length - 1].move_number : 0;
            draft.history.moves = entries;
            draft.history.currentMove = lastMove;
            return;
          }

          if ('StateRestored' in innerEvent) {
            const { move_number, mode } = innerEvent.StateRestored as {
              move_number: number;
              description: string;
              mode: HistoryMode;
            };
            const isViewing = mode !== 'None';
            draft.history.isViewingHistory = isViewing;
            draft.history.viewingMove = isViewing ? move_number : undefined;
            draft.history.currentMove = move_number;
            draft.undoState.isExecuting = false;
            draft.undoState.canUndo = false;
            draft.undoState.lastAction = undefined;
            draft.undoState.lastActionSeat = undefined;
            return;
          }

          if ('HistoryTruncated' in innerEvent) {
            const { from_move } = innerEvent.HistoryTruncated as { from_move: number };
            draft.history.moves = draft.history.moves.filter(
              (entry) => entry.move_number < from_move
            );
            if (draft.history.currentMove >= from_move) {
              draft.history.currentMove = Math.max(0, from_move - 1);
            }
            if (draft.history.viewingMove !== undefined && draft.history.viewingMove >= from_move) {
              draft.history.viewingMove = Math.max(0, from_move - 1);
            }
            draft.undoState.isExecuting = false;
            draft.undoState.canUndo = false;
            draft.undoState.lastAction = undefined;
            draft.undoState.lastActionSeat = undefined;
            return;
          }

          if ('HistoryError' in innerEvent) {
            const { message } = innerEvent.HistoryError as { message: string };
            useUIStore.getState().addError(message);
            return;
          }

          if ('GameCreated' in innerEvent) {
            // Reset game state but preserve our seat (we're the creator/host)
            const preservedSeat = draft.yourSeat;
            Object.assign(draft, createInitialState());
            draft.yourSeat = preservedSeat;
            draft.hostSeat = preservedSeat;
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
            draft.meldSources[player] = [];
            return;
          }

          if ('DiceRolled' in innerEvent || 'WallBroken' in innerEvent) {
            return;
          }

          if ('CharlestonPhaseChanged' in innerEvent) {
            draft.phase = {
              Charleston: (innerEvent.CharlestonPhaseChanged as { stage: CharlestonStage }).stage,
            };
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
            draft.undoState.lastAction = `discard ${tileToString(tile)}`;
            draft.undoState.lastActionSeat = player;
            if (player === draft.yourSeat) {
              removeFirstTile(draft.yourHand, tile);
              draft.undoState.canUndo = true;
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
            const removedDiscard = removeLastDiscard(draft.discardPile, called_tile);
            const calledFrom = removedDiscard?.discarded_by ?? null;
            if (!draft.meldSources[player]) {
              draft.meldSources[player] = [];
            }
            draft.meldSources[player].push(calledFrom);
            draft.undoState.lastAction = `call ${meld.meld_type} on ${tileToString(called_tile)}`;
            draft.undoState.lastActionSeat = player;
            if (player === draft.yourSeat) {
              const tilesToRemove = meld.tiles.filter((tile) => tile !== called_tile);
              removeTiles(draft.yourHand, tilesToRemove);
              draft.undoState.canUndo = true;
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
              draft.undoState.canUndo = true;
            }
            draft.undoState.lastAction = `exchange joker for ${tileToString(replacement)}`;
            draft.undoState.lastActionSeat = player;
            return;
          }

          if ('BlankExchanged' in innerEvent) {
            // Blank exchange is secret - we don't know which tile was taken
            // Backend will send us the tile via private event if it was us
            const { player } = innerEvent.BlankExchanged as { player: Seat };
            draft.undoState.lastAction = 'exchange blank';
            draft.undoState.lastActionSeat = player;
            if (player === draft.yourSeat) {
              draft.undoState.canUndo = true;
            }
            return;
          }

          if ('MeldUpgraded' in innerEvent) {
            const { player, meld_index, new_meld_type } = innerEvent.MeldUpgraded as {
              player: Seat;
              meld_index: number;
              new_meld_type: 'Pung' | 'Kong' | 'Quint' | 'Sextet';
            };
            const playerInfo = draft.players[player];
            if (playerInfo && playerInfo.exposed_melds[meld_index]) {
              playerInfo.exposed_melds[meld_index].meld_type = new_meld_type;
              // Note: The meld.tiles array should already be updated by the server
              // Tile removal from hand is handled by the command optimistically
            }
            draft.undoState.lastAction = `upgrade meld to ${new_meld_type}`;
            draft.undoState.lastActionSeat = player;
            if (player === draft.yourSeat) {
              draft.undoState.canUndo = true;
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

          if ('GamePaused' in innerEvent) {
            const { by } = innerEvent.GamePaused as { by: Seat; reason: string | null };
            draft.isPaused = true;
            draft.pausedBy = by;
            return;
          }

          if ('GameResumed' in innerEvent) {
            draft.isPaused = false;
            draft.pausedBy = null;
            return;
          }

          if ('CommandRejected' in innerEvent) {
            const { player, reason } = innerEvent.CommandRejected as {
              player: Seat;
              reason: string;
            };
            console.error(`Command rejected for ${player}: ${reason}`);
          }

          if ('UndoRequested' in innerEvent) {
            const { requester, target_move } = innerEvent.UndoRequested as {
              requester: Seat;
              target_move: number;
            };
            const voteSeats = Object.keys(draft.players) as Seat[];
            const seats = voteSeats.length > 0 ? voteSeats : orderedSeats;
            const votes = {} as Record<Seat, boolean | null>;
            seats.forEach((seat) => {
              votes[seat] = seat === requester ? true : null;
            });
            const hasMatchingAction =
              draft.undoState.lastAction && draft.undoState.lastActionSeat === requester;
            draft.undoState.pendingRequest = {
              requestedBy: requester,
              action: hasMatchingAction ? draft.undoState.lastAction! : `move ${target_move}`,
              votes,
            };
            draft.undoState.isExecuting = false;
            return;
          }

          if ('UndoVoteRegistered' in innerEvent) {
            const { voter, approved } = innerEvent.UndoVoteRegistered as {
              voter: Seat;
              approved: boolean;
            };
            if (!draft.undoState.pendingRequest) {
              draft.undoState.pendingRequest = {
                requestedBy: voter,
                action: draft.undoState.lastAction ?? 'undo request',
                votes: { [voter]: approved } as Record<Seat, boolean | null>,
              };
            } else {
              draft.undoState.pendingRequest.votes[voter] = approved;
            }
            return;
          }

          if ('UndoRequestResolved' in innerEvent) {
            const { approved } = innerEvent.UndoRequestResolved as { approved: boolean };
            draft.undoState.pendingRequest = undefined;
            draft.undoState.canUndo = approved ? false : draft.undoState.canUndo;
            draft.undoState.isExecuting = approved;
            return;
          }
        }

        if (normalized.kind === 'Analysis') {
          // Handle Analysis events by routing to analysisStore
          const analysisEvent = innerEvent as AnalysisEvent;

          if ('HintUpdate' in analysisEvent) {
            const { hint } = analysisEvent.HintUpdate;
            const store = analysisStore.getState();

            // Check if this hint is a response to a pending request for multi-source testing
            const pendingVerbosity = store.dequeuePendingRequest();
            if (pendingVerbosity && pendingVerbosity !== 'Disabled') {
              // Map verbosity to source (safe cast after checking !== 'Disabled')
              const source = pendingVerbosity as HintSource;
              store.setHintForSource(source, hint);
            } else {
              // Default single-hint path
              store.setHint(hint);
            }
          }

          if ('AnalysisUpdate' in analysisEvent) {
            const { patterns } = analysisEvent.AnalysisUpdate;
            analysisStore.getState().setPatterns(patterns);
          }

          if ('HandAnalysisUpdated' in analysisEvent) {
            const { distance_to_win, viable_count, impossible_count } =
              analysisEvent.HandAnalysisUpdated;
            analysisStore.getState().setHandStats({
              distance_to_win,
              viable_count,
              impossible_count,
            });
          }

          // Analysis events don't modify game state, only analysisStore
          return;
        }
      });
    },

    applySnapshot: (snapshot: GameStateSnapshot) => {
      console.log('=== APPLY SNAPSHOT CALLED ===');
      console.log(
        'applySnapshot - snapshot.your_seat:',
        snapshot.your_seat,
        'current yourSeat:',
        get().yourSeat
      );
      const normalizedPlayers = normalizePlayers(snapshot.players);
      const meldSources: Record<Seat, Array<Seat | null>> = {} as Record<Seat, Array<Seat | null>>;
      Object.values(normalizedPlayers).forEach((player) => {
        meldSources[player.seat] = player.exposed_melds.map(() => null);
      });
      set((draft) => {
        draft.lastSnapshotAt = Date.now();
        draft.phase = snapshot.phase;
        draft.currentTurn = snapshot.current_turn;
        draft.dealer = snapshot.dealer;
        draft.roundNumber = snapshot.round_number;
        draft.remainingTiles = snapshot.remaining_tiles;
        draft.discardPile = snapshot.discard_pile;
        draft.players = normalizedPlayers;
        draft.meldSources = meldSources;
        draft.houseRules = snapshot.house_rules;
        draft.undoState = {
          canUndo: false,
          lastAction: undefined,
          lastActionSeat: undefined,
          pendingRequest: undefined,
          isExecuting: false,
        };
        // Preserve ourSeat - snapshot may be stale and not include our seat
        // Only update if snapshot has a valid seat or if we don't have one yet
        if (snapshot.your_seat || !draft.yourSeat) {
          console.log('Updating yourSeat to:', snapshot.your_seat);
          draft.yourSeat = snapshot.your_seat;
        } else {
          console.log('Preserving yourSeat:', draft.yourSeat);
        }
        // Preserve our hand unless snapshot has newer data
        if (snapshot.your_hand && snapshot.your_hand.length > 0) {
          draft.yourHand = snapshot.your_hand;
        }
      });
    },

    replaceFromSnapshot: (snapshot: GameStateSnapshot) => {
      get().applySnapshot(snapshot);
    },

    setYourSeat: (seat: Seat | null) => {
      console.log('=== SET YOUR SEAT ===', seat);
      console.trace('setYourSeat called from:');
      set((draft) => {
        draft.yourSeat = seat;
      });
    },

    setHostSeat: (seat: Seat | null) => {
      set((draft) => {
        draft.hostSeat = seat;
      });
    },

    setUndoExecuting: (isExecuting: boolean) => {
      set((draft) => {
        draft.undoState.isExecuting = isExecuting;
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

    isHost: () => {
      const state = get();
      return state.hostSeat !== null && state.hostSeat === state.yourSeat;
    },
  }))
);
