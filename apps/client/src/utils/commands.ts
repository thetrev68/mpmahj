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

import type { Command, Tile, Seat, MeldType, CharlestonVote, GamePhase } from '@/types/bindings';
import { useGameStore } from '@/store/gameStore';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validate that we can discard a tile
 */
export function validateDiscard(tile: Tile, hand: Tile[], phase: GamePhase, isMyTurn: boolean): ValidationResult {
  if (!isMyTurn) {
    return { valid: false, error: 'Not your turn' };
  }

  if (phase.type !== 'Playing') {
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
  if (phase.type !== 'Playing') {
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
  charlestonStage: string,
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
export function validateJokerExchange(
  replacement: Tile,
  hand: Tile[],
): ValidationResult {
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
  discard(tile: Tile): Command {
    return { type: 'Discard', tile };
  },

  /**
   * Create a call command
   */
  call(meldType: MeldType): Command {
    return { type: 'Call', meld_type: meldType };
  },

  /**
   * Create a pass command (decline to call)
   */
  pass(): Command {
    return { type: 'Pass' };
  },

  /**
   * Create a Charleston tile selection command
   */
  selectCharlestonTiles(tiles: Tile[]): Command {
    return { type: 'SelectCharlestonTiles', tiles };
  },

  /**
   * Create a Charleston vote command
   */
  voteCharleston(vote: CharlestonVote): Command {
    return { type: 'VoteCharleston', vote };
  },

  /**
   * Create a joker exchange command
   */
  exchangeJoker(targetSeat: Seat, meldIndex: number, replacement: Tile): Command {
    return { type: 'ExchangeJoker', target_seat: targetSeat, meld_index: meldIndex, replacement };
  },

  /**
   * Create a Mahjong declaration command
   */
  declareMahjong(): Command {
    return { type: 'DeclareMahjong' };
  },

  /**
   * Create a ready command
   */
  ready(): Command {
    return { type: 'Ready' };
  },

  /**
   * Create a join game command
   */
  joinGame(playerId: string): Command {
    return { type: 'JoinGame', player_id: playerId };
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
    discard(tile: Tile): { command: Command | null; error?: string } {
      const validation = validateDiscard(
        tile,
        gameState.hand.concealed,
        gameState.phase,
        gameState.isMyTurn(),
      );

      if (!validation.valid) {
        return { command: null, error: validation.error };
      }

      return { command: Commands.discard(tile) };
    },

    /**
     * Validate and create a call command
     */
    call(meldType: MeldType): { command: Command | null; error?: string } {
      const validation = validateCall(gameState.phase);

      if (!validation.valid) {
        return { command: null, error: validation.error };
      }

      return { command: Commands.call(meldType) };
    },

    /**
     * Create a pass command
     */
    pass(): { command: Command } {
      return { command: Commands.pass() };
    },

    /**
     * Validate and create Charleston pass command
     */
    charlestonPass(tiles: Tile[]): { command: Command | null; error?: string } {
      const charlestonStage = gameState.phase.type === 'Charleston' ? gameState.phase.stage : '';

      const validation = validateCharlestonPass(
        tiles,
        gameState.hand.concealed,
        charlestonStage,
      );

      if (!validation.valid) {
        return { command: null, error: validation.error };
      }

      return { command: Commands.selectCharlestonTiles(tiles) };
    },

    /**
     * Create Charleston vote command
     */
    charlestonVote(vote: CharlestonVote): { command: Command } {
      return { command: Commands.voteCharleston(vote) };
    },

    /**
     * Validate and create joker exchange command
     */
    exchangeJoker(
      targetSeat: Seat,
      meldIndex: number,
      replacement: Tile,
    ): { command: Command | null; error?: string } {
      const validation = validateJokerExchange(replacement, gameState.hand.concealed);

      if (!validation.valid) {
        return { command: null, error: validation.error };
      }

      return { command: Commands.exchangeJoker(targetSeat, meldIndex, replacement) };
    },

    /**
     * Create Mahjong declaration command
     */
    declareMahjong(): { command: Command } {
      return { command: Commands.declareMahjong() };
    },
  };
}
