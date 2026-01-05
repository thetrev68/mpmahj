/**
 * Command Validation and Dispatch Utilities
 *
 * Provides type-safe command creation with client-side validation.
 * RULES:
 * - Only send commands from user intent (no automated commands)
 * - Validate phase/turn before sending
 * - Validate tile exists in local hand
 * - No optimistic updates (server is authoritative)
 */

import type { GameCommand } from '@/types/bindings/generated/GameCommand';
import type { CharlestonStage } from '@/types/bindings/generated/CharlestonStage';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { Hand } from '@/types/bindings/generated/Hand';
import type { Meld } from '@/types/bindings/generated/Meld';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';
import { useGameStore } from '@/store/gameStore';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const getPlayingStage = (phase: GamePhase): TurnStage | null => {
  if (typeof phase === 'object' && phase !== null && 'Playing' in phase) {
    return phase.Playing;
  }
  return null;
};

const getCharlestonStage = (phase: GamePhase): CharlestonStage | null => {
  if (typeof phase === 'object' && phase !== null && 'Charleston' in phase) {
    return phase.Charleston;
  }
  return null;
};

/**
 * Validate that we can discard a tile
 */
export function validateDiscard(
  tile: Tile,
  hand: Tile[],
  phase: GamePhase,
  isMyTurn: boolean
): ValidationResult {
  if (!isMyTurn) {
    return { valid: false, error: 'Not your turn' };
  }

  const stage = getPlayingStage(phase);
  if (!stage || !('Discarding' in stage)) {
    return { valid: false, error: 'Cannot discard during this phase' };
  }

  if (!hand.includes(tile)) {
    return { valid: false, error: 'Tile not in your hand' };
  }

  return { valid: true };
}

/**
 * Validate that we can call a discard
 */
export function validateCall(phase: GamePhase): ValidationResult {
  const stage = getPlayingStage(phase);
  if (!stage || !('CallWindow' in stage)) {
    return { valid: false, error: 'Cannot call during this phase' };
  }

  // Additional validation would check if CallWindow is open
  // This is simplified - in production you'd check the TurnStage

  return { valid: true };
}

/**
 * Validate Charleston tile selection
 */
export function validateCharlestonPass(
  tiles: Tile[],
  hand: Tile[],
  charlestonStage: CharlestonStage | ''
): ValidationResult {
  // Check tile count (normally 3, can be 0-3 for courtesy pass)
  const isCourtesyPass = charlestonStage === 'CourtesyAcross';

  if (!isCourtesyPass && tiles.length !== 3) {
    return { valid: false, error: 'Must select exactly 3 tiles' };
  }

  if (isCourtesyPass && tiles.length > 3) {
    return { valid: false, error: 'Cannot pass more than 3 tiles' };
  }

  // Check all tiles exist in hand
  const handCopy = [...hand];
  for (const tile of tiles) {
    const index = handCopy.indexOf(tile);
    if (index === -1) {
      return { valid: false, error: 'Selected tile not in hand' };
    }
    handCopy.splice(index, 1); // Remove to handle duplicates
  }

  // Check no Jokers (Joker index is 35)
  if (tiles.some((t) => t === 35)) {
    return { valid: false, error: 'Cannot pass Jokers in Charleston' };
  }

  return { valid: true };
}

/**
 * Validate joker exchange
 */
export function validateJokerExchange(replacement: Tile, hand: Tile[]): ValidationResult {
  if (!hand.includes(replacement)) {
    return { valid: false, error: 'Replacement tile not in hand' };
  }

  if (replacement === 35) {
    return { valid: false, error: 'Cannot use a Joker as replacement' };
  }

  return { valid: true };
}

/**
 * Command builder helpers
 */
export const Commands = {
  /**
   * Create a discard command
   */
  discard(player: Seat, tile: Tile): GameCommand {
    return { DiscardTile: { player, tile } };
  },

  /**
   * Create a call command
   */
  call(player: Seat, meld: Meld): GameCommand {
    return { CallTile: { player, meld } };
  },

  /**
   * Create a pass command (decline to call)
   */
  pass(player: Seat): GameCommand {
    return { Pass: { player } };
  },

  /**
   * Create a Charleston tile selection command
   */
  passCharlestonTiles(
    player: Seat,
    tiles: Tile[],
    blindPassCount: number | null = null
  ): GameCommand {
    return { PassTiles: { player, tiles, blind_pass_count: blindPassCount } };
  },

  /**
   * Create a Charleston vote command
   */
  voteCharleston(player: Seat, vote: CharlestonVote): GameCommand {
    return { VoteCharleston: { player, vote } };
  },

  /**
   * Create a joker exchange command
   */
  exchangeJoker(player: Seat, targetSeat: Seat, meldIndex: number, replacement: Tile): GameCommand {
    return {
      ExchangeJoker: { player, target_seat: targetSeat, meld_index: meldIndex, replacement },
    };
  },

  /**
   * Create a Mahjong declaration command
   */
  declareMahjong(player: Seat, hand: Hand, winningTile: Tile | null): GameCommand {
    return { DeclareMahjong: { player, hand, winning_tile: winningTile } };
  },

  /**
   * Create a draw tile command
   */
  drawTile(player: Seat): GameCommand {
    return { DrawTile: { player } };
  },

  /**
   * Create a ready command
   */
  readyToStart(player: Seat): GameCommand {
    return { ReadyToStart: { player } };
  },
};

/**
 * Hook to get validated command sender
 */
export function useCommandSender() {
  const gameState = useGameStore();

  return {
    /**
     * Validate and create a discard command
     */
    discard(tile: Tile): { command: GameCommand | null; error?: string } {
      if (!gameState.yourSeat) {
        return { command: null, error: 'Seat not assigned yet' };
      }
      const validation = validateDiscard(
        tile,
        gameState.yourHand,
        gameState.phase,
        gameState.isMyTurn()
      );

      if (!validation.valid) {
        return { command: null, error: validation.error };
      }

      return { command: Commands.discard(gameState.yourSeat, tile) };
    },

    /**
     * Validate and create a call command
     */
    call(meld: Meld): { command: GameCommand | null; error?: string } {
      if (!gameState.yourSeat) {
        return { command: null, error: 'Seat not assigned yet' };
      }
      const validation = validateCall(gameState.phase);

      if (!validation.valid) {
        return { command: null, error: validation.error };
      }

      return { command: Commands.call(gameState.yourSeat, meld) };
    },

    /**
     * Create a pass command
     */
    pass(): { command: GameCommand | null; error?: string } {
      if (!gameState.yourSeat) {
        return { command: null, error: 'Seat not assigned yet' };
      }
      return { command: Commands.pass(gameState.yourSeat) };
    },

    /**
     * Validate and create Charleston pass command
     */
    charlestonPass(
      tiles: Tile[],
      blindPassCount: number | null = null
    ): { command: GameCommand | null; error?: string } {
      if (!gameState.yourSeat) {
        return { command: null, error: 'Seat not assigned yet' };
      }
      const charlestonStage = getCharlestonStage(gameState.phase) ?? '';

      const validation = validateCharlestonPass(tiles, gameState.yourHand, charlestonStage);

      if (!validation.valid) {
        return { command: null, error: validation.error };
      }

      return {
        command: Commands.passCharlestonTiles(gameState.yourSeat, tiles, blindPassCount),
      };
    },

    /**
     * Create Charleston vote command
     */
    charlestonVote(vote: CharlestonVote): { command: GameCommand | null; error?: string } {
      if (!gameState.yourSeat) {
        return { command: null, error: 'Seat not assigned yet' };
      }
      return { command: Commands.voteCharleston(gameState.yourSeat, vote) };
    },

    /**
     * Validate and create joker exchange command
     */
    exchangeJoker(
      targetSeat: Seat,
      meldIndex: number,
      replacement: Tile
    ): { command: GameCommand | null; error?: string } {
      if (!gameState.yourSeat) {
        return { command: null, error: 'Seat not assigned yet' };
      }
      const validation = validateJokerExchange(replacement, gameState.yourHand);

      if (!validation.valid) {
        return { command: null, error: validation.error };
      }

      return {
        command: Commands.exchangeJoker(gameState.yourSeat, targetSeat, meldIndex, replacement),
      };
    },

    /**
     * Create Mahjong declaration command
     */
    declareMahjong(
      hand: Hand,
      winningTile: Tile | null
    ): { command: GameCommand | null; error?: string } {
      if (!gameState.yourSeat) {
        return { command: null, error: 'Seat not assigned yet' };
      }
      return { command: Commands.declareMahjong(gameState.yourSeat, hand, winningTile) };
    },
  };
}
