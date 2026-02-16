/**
 * Tests for OpponentRack Component
 *
 * Coverage:
 * - P0: Renders seat name and tile count badge
 * - P0: Renders correct number of face-down tiles for concealed hand
 * - P0: Deducts exposed meld tiles from tile_count
 * - P0: Shows "(Bot)" indicator for bot players
 * - P0: getOpponentPosition returns correct relative position
 */

import { describe, expect, test } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { OpponentRack } from './OpponentRack';
import { getOpponentPosition } from './opponentRackUtils';
import type { PublicPlayerInfo } from '@/types/bindings/generated/PublicPlayerInfo';
import type { Seat } from '@/types/bindings/generated/Seat';

function makePlayer(overrides: Partial<PublicPlayerInfo> = {}): PublicPlayerInfo {
  return {
    seat: 'West',
    player_id: 'player-west',
    is_bot: false,
    status: 'Active',
    tile_count: 13,
    exposed_melds: [],
    ...overrides,
  };
}

describe('OpponentRack', () => {
  describe('Rendering', () => {
    test('renders seat name', () => {
      renderWithProviders(<OpponentRack player={makePlayer({ seat: 'West' })} yourSeat="South" />);
      expect(screen.getByTestId('opponent-seat-west')).toHaveTextContent('West');
    });

    test('shows tile count badge', () => {
      renderWithProviders(
        <OpponentRack player={makePlayer({ seat: 'West', tile_count: 13 })} yourSeat="South" />
      );
      expect(screen.getByTestId('opponent-tile-count-west')).toHaveTextContent('13');
    });

    test('renders face-down tiles equal to concealed count', () => {
      renderWithProviders(
        <OpponentRack player={makePlayer({ seat: 'East', tile_count: 13 })} yourSeat="South" />
      );
      const rack = screen.getByTestId('opponent-rack-east');
      // tile-face-down class applied by Tile when faceUp=false
      const faceDownTiles = rack.querySelectorAll('.tile-face-down');
      expect(faceDownTiles).toHaveLength(13);
    });

    test('deducts exposed meld tiles from concealed count', () => {
      const player = makePlayer({
        seat: 'North',
        tile_count: 13,
        exposed_melds: [
          {
            meld_type: 'Pung',
            tiles: [1, 1, 1],
            called_tile: 1,
            joker_assignments: {},
          },
        ],
      });
      renderWithProviders(<OpponentRack player={player} yourSeat="South" />);
      expect(screen.getByTestId('opponent-tile-count-north')).toHaveTextContent('10');
      const rack = screen.getByTestId('opponent-rack-north');
      const faceDownTiles = rack.querySelectorAll('.tile-face-down');
      expect(faceDownTiles).toHaveLength(10);
    });

    test('shows (Bot) for bot players', () => {
      renderWithProviders(
        <OpponentRack player={makePlayer({ seat: 'West', is_bot: true })} yourSeat="South" />
      );
      expect(screen.getByTestId('opponent-seat-west')).toHaveTextContent('West (Bot)');
    });

    test('has accessible aria-label', () => {
      renderWithProviders(<OpponentRack player={makePlayer({ seat: 'West' })} yourSeat="South" />);
      const rack = screen.getByTestId('opponent-rack-west');
      expect(rack).toHaveAttribute('aria-label', "West's hand: 13 concealed tiles");
    });
  });

  describe('getOpponentPosition', () => {
    const cases: [Seat, Seat, string][] = [
      ['South', 'West', 'right'],
      ['South', 'North', 'top'],
      ['South', 'East', 'left'],
      ['East', 'South', 'right'],
      ['East', 'West', 'top'],
      ['East', 'North', 'left'],
      ['West', 'North', 'right'],
      ['West', 'East', 'top'],
      ['West', 'South', 'left'],
      ['North', 'East', 'right'],
      ['North', 'South', 'top'],
      ['North', 'West', 'left'],
    ];

    test.each(cases)('yourSeat=%s opponent=%s → %s', (yourSeat, opponent, expected) => {
      expect(getOpponentPosition(yourSeat, opponent)).toBe(expected);
    });
  });
});
