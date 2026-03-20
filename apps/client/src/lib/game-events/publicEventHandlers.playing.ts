import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { CallIntentSummary } from '@/types/bindings/generated/CallIntentSummary';
import type { EventHandlerResult, UIStateAction } from './types';
import { addAndSortHand, sortHand } from '@/lib/utils/tileUtils';

/**
 * Handle turn change event (Playing phase).
 * Updates current player and turn stage in game state and UI.
 * @param event - TurnChanged event
 * @returns State updates and UI actions
 */
export function handleTurnChanged(
  event: Extract<PublicEvent, { TurnChanged: unknown }>
): EventHandlerResult {
  return {
    stateUpdates: [
      (prev) =>
        prev
          ? {
              ...prev,
              current_turn: event.TurnChanged.player,
              phase: { Playing: event.TurnChanged.stage },
            }
          : null,
    ],
    uiActions: [
      { type: 'SET_CURRENT_TURN', seat: event.TurnChanged.player },
      { type: 'SET_TURN_STAGE', stage: event.TurnChanged.stage },
    ],
    sideEffects: [],
  };
}

/**
 * Handle public tile drawn event.
 * Updates player tile counts and wall remaining tile count.
 * @param event - TileDrawnPublic event
 * @returns State updates and UI actions
 */
export function handleTileDrawnPublic(
  event: Extract<PublicEvent, { TileDrawnPublic: unknown }>
): EventHandlerResult {
  const { player, remaining_tiles } = event.TileDrawnPublic;

  return {
    stateUpdates: [
      (prev) => {
        if (!prev) return null;

        const newPlayers = prev.players.map((p) =>
          p.seat === player ? { ...p, tile_count: p.tile_count + 1 } : p
        );

        return {
          ...prev,
          wall_tiles_remaining: remaining_tiles,
          players: newPlayers,
        };
      },
    ],
    uiActions: [],
    sideEffects: [],
  };
}

/**
 * Handle tile discarded event.
 * Removes tile from current player's hand, adds to discard pile, clears selection/processing.
 * @param event - TileDiscarded event
 * @returns State updates and UI actions
 */
export function handleTileDiscarded(
  event: Extract<PublicEvent, { TileDiscarded: unknown }>
): EventHandlerResult {
  const { player, tile } = event.TileDiscarded;

  return {
    stateUpdates: [
      (prev) => {
        if (!prev) return null;

        const discardIndex = player === prev.your_seat ? prev.your_hand.indexOf(tile) : -1;
        const newHand =
          player === prev.your_seat
            ? prev.your_hand.filter((_t, index) => index !== discardIndex)
            : prev.your_hand;

        const newDiscards = [
          ...(prev.discard_pile || []),
          {
            tile,
            discarded_by: player,
          },
        ];

        const newPlayers = prev.players.map((p) =>
          p.seat === player ? { ...p, tile_count: p.tile_count - 1 } : p
        );

        return {
          ...prev,
          your_hand: newHand,
          discard_pile: newDiscards,
          players: newPlayers,
        };
      },
    ],
    uiActions: [
      { type: 'SET_DISCARD_ANIMATION_TILE', tile },
      { type: 'SET_MOST_RECENT_DISCARD', tile },
      { type: 'SET_IS_PROCESSING', value: false },
      { type: 'CLEAR_SELECTION' },
    ],
    sideEffects: [
      { type: 'PLAY_SOUND', sound: 'tile-discard' },
      { type: 'TIMEOUT', id: 'clear-recent-discard', ms: 2000 },
    ],
  };
}

/**
 * Handle call window opened event.
 * Shows call window UI only if current player is eligible to call.
 * @param event - CallWindowOpened event
 * @param context - Current player seat information
 * @returns State updates and UI actions
 */
export function handleCallWindowOpened(
  event: Extract<PublicEvent, { CallWindowOpened: unknown }>,
  context: { yourSeat: Seat }
): EventHandlerResult {
  const { tile, discarded_by, can_call, timer, started_at_ms } = event.CallWindowOpened;
  const isEligible = can_call.includes(context.yourSeat);

  if (isEligible) {
    return {
      stateUpdates: [],
      uiActions: [
        {
          type: 'OPEN_CALL_WINDOW',
          params: {
            tile,
            discardedBy: discarded_by,
            canCall: can_call,
            timerDuration: timer,
            timerStart: Number(started_at_ms),
          },
        },
      ],
      sideEffects: [],
    };
  }

  return {
    stateUpdates: [],
    uiActions: [],
    sideEffects: [],
  };
}

/**
 * Handle call window progress update event.
 * Updates which players can still act and current call intents.
 * @param event - CallWindowProgress event
 * @returns State updates and UI actions
 */
export function handleCallWindowProgress(
  event: Extract<PublicEvent, { CallWindowProgress: unknown }>
): EventHandlerResult {
  const { can_act, intents } = event.CallWindowProgress;

  return {
    stateUpdates: [],
    uiActions: [{ type: 'UPDATE_CALL_WINDOW_PROGRESS', canAct: can_act, intents }],
    sideEffects: [],
  };
}

/**
 * Handle call resolution event.
 * Closes call window and shows resolution overlay or result message.
 * @param event - CallResolved event
 * @param context - Current call intents and discarded-by player
 * @returns State updates and UI actions
 */
export function handleCallResolved(
  event: Extract<PublicEvent, { CallResolved: unknown }>,
  context: { callIntents: CallIntentSummary[]; discardedBy: Seat }
): EventHandlerResult {
  const { resolution, tie_break } = event.CallResolved;
  const allCallers = context.callIntents;
  const discardedBy = context.discardedBy;

  const uiActions: UIStateAction[] = [{ type: 'CLOSE_CALL_WINDOW' }];
  const sideEffects: EventHandlerResult['sideEffects'] = [];

  if (resolution !== 'NoCall' && allCallers.length > 0) {
    uiActions.push({
      type: 'SHOW_RESOLUTION_OVERLAY',
      data: {
        resolution,
        tieBreak: tie_break,
        allCallers,
        discardedBy,
      },
    });
  } else {
    let message = '';
    const tieNote = tie_break ? ' (closer to discarder)' : '';

    if (resolution === 'NoCall') {
      message = 'No one called the tile';
    } else if (typeof resolution === 'object' && resolution && 'Mahjong' in resolution) {
      message = `${resolution.Mahjong} wins call for Mahjong${tieNote}`;
    } else if (typeof resolution === 'object' && resolution && 'Meld' in resolution) {
      message = `${resolution.Meld.seat} wins call for ${resolution.Meld.meld.meld_type}${tieNote}`;
    }

    if (message) {
      uiActions.push({ type: 'SET_ERROR_MESSAGE', message });
      sideEffects.push({ type: 'TIMEOUT', id: 'call-resolution-message', ms: 3000 });
    }
  }

  return {
    stateUpdates: [],
    uiActions,
    sideEffects,
  };
}

/**
 * Handle call window closed event.
 * Closes call window UI and clears related timers.
 * @returns State updates and UI actions
 */
export function handleCallWindowClosed(): EventHandlerResult {
  return {
    stateUpdates: [],
    uiActions: [{ type: 'CLOSE_CALL_WINDOW' }],
    sideEffects: [{ type: 'CLEAR_TIMEOUT', id: 'call-window' }],
  };
}

/**
 * Handle tile called event.
 * Adds meld to player's exposed melds and removes meld tiles from their hand.
 * @param event - TileCalled event
 * @param context - Current player seat information
 * @returns State updates and UI actions
 */
export function handleTileCalled(
  event: Extract<PublicEvent, { TileCalled: unknown }>,
  context: { yourSeat: Seat }
): EventHandlerResult {
  const { player, meld, called_tile, called_from } = event.TileCalled;

  const uiActions: UIStateAction[] = [];
  if (player === context.yourSeat) {
    uiActions.push({
      type: 'SET_STAGED_INCOMING_DRAW_TILE',
      tileId: `called-${called_tile}`,
      tile: called_tile,
    });
  }

  return {
    stateUpdates: [
      (prev) => {
        if (!prev) return null;

        const newPlayers = prev.players.map((p) => {
          if (p.seat === player) {
            return {
              ...p,
              tile_count: p.tile_count + 1,
              // Include called_from in the client-side meld record so rendering
              // components can orient the meld toward the discarder.
              exposed_melds: [...p.exposed_melds, { ...meld, called_from }],
            };
          }
          return p;
        });

        let newHand = prev.your_hand;
        if (player === context.yourSeat) {
          const tilesToRemove = [...meld.tiles];
          const calledIndex = tilesToRemove.indexOf(called_tile);
          if (calledIndex !== -1) {
            tilesToRemove.splice(calledIndex, 1);
          }

          newHand = [...prev.your_hand];
          for (const tile of tilesToRemove) {
            const idx = newHand.indexOf(tile);
            if (idx !== -1) {
              newHand.splice(idx, 1);
            }
          }
          newHand = sortHand(newHand);
        }

        const discardPile = prev.discard_pile || [];
        let calledTileIndex = -1;
        for (let i = discardPile.length - 1; i >= 0; i -= 1) {
          if (discardPile[i].tile === called_tile) {
            calledTileIndex = i;
            break;
          }
        }
        const newDiscardPile =
          calledTileIndex !== -1
            ? [...discardPile.slice(0, calledTileIndex), ...discardPile.slice(calledTileIndex + 1)]
            : discardPile;

        return {
          ...prev,
          your_hand: newHand,
          players: newPlayers,
          discard_pile: newDiscardPile,
        };
      },
    ],
    uiActions,
    sideEffects: [],
  };
}

/**
 * Handle joker exchange event (US-014/015).
 * Replaces joker in target player's meld with replacement tile, adds joker to exchanger's hand.
 * @param event - JokerExchanged event
 * @param context - Current player seat information
 * @returns State updates and UI actions
 */
export function handleJokerExchanged(
  event: Extract<PublicEvent, { JokerExchanged: unknown }>,
  context: { yourSeat: Seat }
): EventHandlerResult {
  const { player, target_seat, joker, replacement } = event.JokerExchanged;

  return {
    stateUpdates: [
      (prev) => {
        if (!prev) return null;

        const newPlayers = prev.players.map((p) => {
          if (p.seat !== target_seat) return p;

          let replaced = false;
          const newMelds = p.exposed_melds.map((meld) => {
            if (replaced) return meld;

            const entry = Object.entries(meld.joker_assignments).find(
              ([, represented]) => represented === replacement
            );
            if (!entry) return meld;

            replaced = true;
            const pos = parseInt(entry[0], 10);
            const newTiles = [...meld.tiles];
            newTiles[pos] = replacement;

            const newJokerAssignments = { ...meld.joker_assignments };
            delete newJokerAssignments[pos];

            return { ...meld, tiles: newTiles, joker_assignments: newJokerAssignments };
          });

          return { ...p, exposed_melds: newMelds };
        });

        let newHand = prev.your_hand;
        if (player === context.yourSeat) {
          const idx = newHand.indexOf(replacement);
          if (idx !== -1) {
            newHand = [...newHand];
            newHand.splice(idx, 1);
          }
          newHand = addAndSortHand(newHand, [joker]);
        }

        return {
          ...prev,
          your_hand: newHand,
          players: newPlayers,
        };
      },
    ],
    uiActions: [
      {
        type: 'SET_JOKER_EXCHANGED',
        player,
        target_seat,
        joker,
        replacement,
      },
      ...(player === context.yourSeat
        ? [
            {
              type: 'SET_STAGED_INCOMING_DRAW_TILE' as const,
              tileId: `exchange-${joker}`,
              tile: joker,
            },
          ]
        : []),
    ],
    sideEffects: [{ type: 'PLAY_SOUND', sound: 'tile-place' }],
  };
}

/**
 * Handle meld upgraded event (US-016).
 * Upgrades meld type (e.g. Pung → Kong) and removes one tile from upgrader's hand.
 * @param event - MeldUpgraded event
 * @param context - Current player seat information
 * @returns State updates and UI actions
 */
export function handleMeldUpgraded(
  event: Extract<PublicEvent, { MeldUpgraded: unknown }>,
  context: { yourSeat: Seat } = { yourSeat: 'East' }
): EventHandlerResult {
  const { player, meld_index, new_meld_type } = event.MeldUpgraded;

  return {
    stateUpdates: [
      (prev) => {
        if (!prev) return null;

        const newPlayers = prev.players.map((p) => {
          if (p.seat !== player) return p;

          const newMelds = p.exposed_melds.map((meld, idx) =>
            idx === meld_index ? { ...meld, meld_type: new_meld_type } : meld
          );

          return { ...p, exposed_melds: newMelds };
        });

        let newHand = prev.your_hand;
        if (player === context.yourSeat && newHand.length > 0) {
          const upgradedMeld = prev.players.find((p) => p.seat === player)?.exposed_melds[
            meld_index
          ];
          const baseTile = upgradedMeld?.called_tile ?? null;
          const jokerTile = 42;

          const idxBase = baseTile !== null ? newHand.indexOf(baseTile) : -1;
          const idxJoker = newHand.indexOf(jokerTile);
          const removeAt = idxBase !== -1 ? idxBase : idxJoker;

          if (removeAt !== -1) {
            newHand = [...newHand];
            newHand.splice(removeAt, 1);
          }
        }

        return { ...prev, your_hand: newHand, players: newPlayers };
      },
    ],
    uiActions: [{ type: 'SET_MELD_UPGRADED', player, meld_index, new_meld_type }],
    sideEffects: [{ type: 'PLAY_SOUND', sound: 'tile-place' }],
  };
}
