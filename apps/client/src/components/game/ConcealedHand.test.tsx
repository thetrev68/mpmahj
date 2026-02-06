/**
 * Tests for ConcealedHand Component
 *
 * User Story: US-002 - Charleston First Right
 * Spec: docs/implementation/frontend/component-specs/game/ConcealedHand.md
 *
 * Coverage:
 * - P0: Renders tiles from hand
 * - P0: Tiles are clickable in charleston mode
 * - P0: Selected tiles show raised/highlighted state
 * - P0: Jokers show disabled state in charleston mode
 * - P0: Selection counter shows correct count
 * - P0: View-only mode prevents interaction
 */

import { describe, expect, test, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { ConcealedHand } from './ConcealedHand';
import { TILE_INDICES } from '@/lib/utils/tileUtils';
import type { Tile } from '@/types/bindings';

// Standard 13-tile Charleston hand (from fixture: charleston-standard-hand)
const charlestonHand: Tile[] = [0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 28, 31, TILE_INDICES.JOKER];

describe('ConcealedHand Component', () => {
  describe('Rendering - P0', () => {
    test('renders all tiles in the hand', () => {
      renderWithProviders(
        <ConcealedHand tiles={charlestonHand} mode="charleston" onTileSelect={vi.fn()} />
      );

      // Should render 13 tiles
      charlestonHand.forEach((tile) => {
        expect(screen.getByTestId(`tile-${tile}`)).toBeInTheDocument();
      });
    });

    test('renders empty hand gracefully', () => {
      renderWithProviders(
        <ConcealedHand tiles={[]} mode="charleston" onTileSelect={vi.fn()} />
      );

      expect(screen.getByTestId('concealed-hand')).toBeInTheDocument();
    });

    test('shows selection counter in charleston mode', () => {
      renderWithProviders(
        <ConcealedHand tiles={charlestonHand} mode="charleston" onTileSelect={vi.fn()} />
      );

      expect(screen.getByTestId('selection-counter')).toHaveTextContent('0/3');
    });

    test('shows correct counter when tiles are selected', () => {
      renderWithProviders(
        <ConcealedHand
          tiles={charlestonHand}
          mode="charleston"
          selectedTiles={[0, 1]}
          onTileSelect={vi.fn()}
        />
      );

      expect(screen.getByTestId('selection-counter')).toHaveTextContent('2/3');
    });
  });

  describe('Charleston Selection - P0', () => {
    test('calls onTileSelect when a tile is clicked', async () => {
      const handleSelect = vi.fn();
      const { user } = renderWithProviders(
        <ConcealedHand tiles={charlestonHand} mode="charleston" onTileSelect={handleSelect} />
      );

      await user.click(screen.getByTestId('tile-0'));
      expect(handleSelect).toHaveBeenCalledWith(0);
    });

    test('selected tiles show selected state', () => {
      renderWithProviders(
        <ConcealedHand
          tiles={charlestonHand}
          mode="charleston"
          selectedTiles={[0, 1, 2]}
          onTileSelect={vi.fn()}
        />
      );

      // Selected tiles should have selected class
      expect(screen.getByTestId('tile-0')).toHaveClass('tile-selected');
      expect(screen.getByTestId('tile-1')).toHaveClass('tile-selected');
      expect(screen.getByTestId('tile-2')).toHaveClass('tile-selected');

      // Non-selected tiles should not
      expect(screen.getByTestId('tile-9')).not.toHaveClass('tile-selected');
    });

    test('Joker tiles show disabled state in charleston mode', () => {
      renderWithProviders(
        <ConcealedHand tiles={charlestonHand} mode="charleston" onTileSelect={vi.fn()} />
      );

      const jokerTile = screen.getByTestId(`tile-${TILE_INDICES.JOKER}`);
      expect(jokerTile).toHaveClass('tile-disabled');
    });

    test('Joker click does not trigger onTileSelect in charleston mode', async () => {
      const handleSelect = vi.fn();
      const { user } = renderWithProviders(
        <ConcealedHand tiles={charlestonHand} mode="charleston" onTileSelect={handleSelect} />
      );

      await user.click(screen.getByTestId(`tile-${TILE_INDICES.JOKER}`));
      expect(handleSelect).not.toHaveBeenCalled();
    });
  });

  describe('View-Only Mode - P0', () => {
    test('tiles are not clickable in view-only mode', async () => {
      const handleSelect = vi.fn();
      const { user } = renderWithProviders(
        <ConcealedHand tiles={charlestonHand} mode="view-only" onTileSelect={handleSelect} />
      );

      await user.click(screen.getByTestId('tile-0'));
      expect(handleSelect).not.toHaveBeenCalled();
    });

    test('does not show selection counter in view-only mode', () => {
      renderWithProviders(
        <ConcealedHand tiles={charlestonHand} mode="view-only" onTileSelect={vi.fn()} />
      );

      expect(screen.queryByTestId('selection-counter')).not.toBeInTheDocument();
    });
  });

  describe('Disabled State - P0', () => {
    test('all tiles are non-interactive when disabled', async () => {
      const handleSelect = vi.fn();
      const { user } = renderWithProviders(
        <ConcealedHand
          tiles={charlestonHand}
          mode="charleston"
          disabled={true}
          onTileSelect={handleSelect}
        />
      );

      await user.click(screen.getByTestId('tile-0'));
      expect(handleSelect).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility - P1', () => {
    test('has aria-label on the hand container', () => {
      renderWithProviders(
        <ConcealedHand tiles={charlestonHand} mode="charleston" onTileSelect={vi.fn()} />
      );

      expect(screen.getByTestId('concealed-hand')).toHaveAttribute('aria-label');
    });

    test('announces selection count via aria-live region', () => {
      renderWithProviders(
        <ConcealedHand
          tiles={charlestonHand}
          mode="charleston"
          selectedTiles={[0, 1]}
          onTileSelect={vi.fn()}
        />
      );

      const counter = screen.getByTestId('selection-counter');
      expect(counter).toHaveAttribute('aria-live', 'polite');
    });
  });
});
