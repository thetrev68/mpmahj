/**
 * Tests for PlayerRack Component
 *
 * User Stories: US-002 (Charleston), US-010 (Discarding)
 *
 * Coverage:
 * - P0: Renders tiles from hand
 * - P0: Tiles are clickable in charleston mode
 * - P0: Tiles are clickable in discard mode (single selection)
 * - P0: Selected tiles show raised/highlighted state
 * - P0: Jokers show disabled state in charleston mode (but enabled in discard mode)
 * - P0: Selection counter shows correct count
 * - P0: View-only mode prevents interaction
 */

import { describe, expect, test, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { PlayerRack } from './PlayerRack';
import { TILE_INDICES } from '@/lib/utils/tileUtils';
import type { Tile } from '@/types/bindings';
import type { TileInstance } from './types';

// Standard 13-tile Charleston hand (from fixture: charleston-standard-hand)
const charlestonHand: Tile[] = [0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 28, 31, TILE_INDICES.JOKER];
const charlestonHandInstances: TileInstance[] = charlestonHand.map((tile, index) => ({
  id: `t${tile}-${index}`,
  tile,
}));

describe('PlayerRack Component', () => {
  describe('Rendering - P0', () => {
    test('renders all tiles in the hand', () => {
      renderWithProviders(
        <PlayerRack tiles={charlestonHandInstances} mode="charleston" onTileSelect={vi.fn()} />
      );

      // Should render 13 tiles
      charlestonHandInstances.forEach((tile) => {
        expect(screen.getByTestId(`tile-${tile.tile}-${tile.id}`)).toBeInTheDocument();
      });
    });

    test('renders empty hand gracefully', () => {
      renderWithProviders(<PlayerRack tiles={[]} mode="charleston" onTileSelect={vi.fn()} />);

      expect(screen.getByTestId('concealed-hand')).toBeInTheDocument();
    });

    test('renders the meld row even when there are no exposed melds', () => {
      renderWithProviders(<PlayerRack tiles={[]} mode="charleston" onTileSelect={vi.fn()} />);

      const meldRow = screen.getByTestId('player-rack-meld-row');
      expect(meldRow).toBeInTheDocument();
      expect(meldRow.getAttribute('style')).toContain('min-height: 90px');
    });

    test('renders both rack rows alongside concealed tiles (meld content deferred to VR-009)', () => {
      renderWithProviders(
        <PlayerRack tiles={charlestonHandInstances} mode="charleston" onTileSelect={vi.fn()} />
      );

      expect(screen.getByTestId('player-rack-meld-row')).toBeInTheDocument();
      expect(screen.getByTestId('player-rack-concealed-row')).toBeInTheDocument();
    });

    test('uses the wooden enclosure styling on the rack shell', () => {
      renderWithProviders(
        <PlayerRack tiles={charlestonHandInstances} mode="charleston" onTileSelect={vi.fn()} />
      );

      const rackShellStyle = screen.getByTestId('player-rack-shell').getAttribute('style');
      expect(rackShellStyle).toContain('linear-gradient');
      expect(rackShellStyle).toContain('rgb(139, 94, 60)');
    });

    test('shows selection counter in charleston mode', () => {
      renderWithProviders(
        <PlayerRack tiles={charlestonHandInstances} mode="charleston" onTileSelect={vi.fn()} />
      );

      expect(screen.getByTestId('selection-counter')).toHaveTextContent('0/3');
    });

    test('shows correct counter when tiles are selected', () => {
      renderWithProviders(
        <PlayerRack
          tiles={charlestonHandInstances}
          mode="charleston"
          selectedTileIds={['t0-0', 't1-1']}
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
        <PlayerRack tiles={charlestonHandInstances} mode="charleston" onTileSelect={handleSelect} />
      );

      await user.click(screen.getByTestId('tile-0-t0-0'));
      expect(handleSelect).toHaveBeenCalledWith('t0-0');
    });

    test('selected tiles show selected state', () => {
      renderWithProviders(
        <PlayerRack
          tiles={charlestonHandInstances}
          mode="charleston"
          selectedTileIds={['t0-0', 't1-1', 't2-2']}
          onTileSelect={vi.fn()}
        />
      );

      // Selected tiles should have selected class
      expect(screen.getByTestId('tile-0-t0-0')).toHaveClass('tile-selected');
      expect(screen.getByTestId('tile-1-t1-1')).toHaveClass('tile-selected');
      expect(screen.getByTestId('tile-2-t2-2')).toHaveClass('tile-selected');

      // Non-selected tiles should not
      expect(screen.getByTestId('tile-9-t9-3')).not.toHaveClass('tile-selected');
    });

    test('Joker tiles show disabled state in charleston mode', () => {
      renderWithProviders(
        <PlayerRack tiles={charlestonHandInstances} mode="charleston" onTileSelect={vi.fn()} />
      );

      const jokerInstance = charlestonHandInstances.find(
        (instance) => instance.tile === TILE_INDICES.JOKER
      )!;
      const jokerTile = screen.getByTestId(`tile-${jokerInstance.tile}-${jokerInstance.id}`);
      expect(jokerTile).toHaveClass('tile-disabled');
    });

    test('Joker click triggers onTileSelect for tooltip handling', async () => {
      const handleSelect = vi.fn();
      const { user } = renderWithProviders(
        <PlayerRack tiles={charlestonHandInstances} mode="charleston" onTileSelect={handleSelect} />
      );

      const jokerInstance = charlestonHandInstances.find(
        (instance) => instance.tile === TILE_INDICES.JOKER
      )!;
      await user.click(screen.getByTestId(`tile-${jokerInstance.tile}-${jokerInstance.id}`));
      expect(handleSelect).toHaveBeenCalledWith(jokerInstance.id);
    });
  });

  describe('View-Only Mode - P0', () => {
    test('tiles are not clickable in view-only mode', async () => {
      const handleSelect = vi.fn();
      const { user } = renderWithProviders(
        <PlayerRack tiles={charlestonHandInstances} mode="view-only" onTileSelect={handleSelect} />
      );

      await user.click(screen.getByTestId('tile-0-t0-0'));
      expect(handleSelect).not.toHaveBeenCalled();
    });

    test('does not show selection counter in view-only mode', () => {
      renderWithProviders(
        <PlayerRack tiles={charlestonHandInstances} mode="view-only" onTileSelect={vi.fn()} />
      );

      expect(screen.queryByTestId('selection-counter')).not.toBeInTheDocument();
    });
  });

  describe('Disabled State - P0', () => {
    test('all tiles are non-interactive when disabled', async () => {
      const handleSelect = vi.fn();
      const { user } = renderWithProviders(
        <PlayerRack
          tiles={charlestonHandInstances}
          mode="charleston"
          disabled={true}
          onTileSelect={handleSelect}
        />
      );

      await user.click(screen.getByTestId('tile-0-t0-0'));
      expect(handleSelect).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility - P1', () => {
    test('has aria-label on the hand container', () => {
      renderWithProviders(
        <PlayerRack tiles={charlestonHandInstances} mode="charleston" onTileSelect={vi.fn()} />
      );

      expect(screen.getByTestId('concealed-hand')).toHaveAttribute('aria-label');
    });

    test('announces selection count via aria-live region', () => {
      renderWithProviders(
        <PlayerRack
          tiles={charlestonHandInstances}
          mode="charleston"
          selectedTileIds={['t0-0', 't1-1']}
          onTileSelect={vi.fn()}
        />
      );

      const counter = screen.getByTestId('selection-counter');
      expect(counter).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('Discard Mode - US-010 Phase 1A', () => {
    // 14-tile discarding hand (post-draw)
    const discardHand: Tile[] = [0, 1, 2, 9, 10, 11, 18, 19, 20, 27, 28, 31, 42, 5];
    const discardHandInstances: TileInstance[] = discardHand.map((tile, index) => ({
      id: `d${tile}-${index}`,
      tile,
    }));

    test('allows selecting a tile when in discard mode', async () => {
      const handleSelect = vi.fn();
      const { user } = renderWithProviders(
        <PlayerRack tiles={discardHandInstances} mode="discard" onTileSelect={handleSelect} />
      );

      await user.click(screen.getByTestId('tile-5-d5-13'));
      expect(handleSelect).toHaveBeenCalledWith('d5-13');
    });

    test('selected tile shows raised and highlighted state in discard mode', () => {
      renderWithProviders(
        <PlayerRack
          tiles={discardHandInstances}
          mode="discard"
          selectedTileIds={['d5-13']}
          onTileSelect={vi.fn()}
        />
      );

      const selectedTile = screen.getByTestId('tile-5-d5-13');
      expect(selectedTile).toHaveClass('tile-selected');
    });

    test('shows selection counter (1/1) in discard mode', () => {
      renderWithProviders(
        <PlayerRack tiles={discardHandInstances} mode="discard" onTileSelect={vi.fn()} />
      );

      expect(screen.getByTestId('selection-counter')).toHaveTextContent('0/1');
    });

    test('shows correct counter (1/1) when one tile selected', () => {
      renderWithProviders(
        <PlayerRack
          tiles={discardHandInstances}
          mode="discard"
          selectedTileIds={['d5-13']}
          onTileSelect={vi.fn()}
        />
      );

      expect(screen.getByTestId('selection-counter')).toHaveTextContent('1/1');
    });

    test('Jokers are enabled in discard mode (can be discarded)', () => {
      renderWithProviders(
        <PlayerRack tiles={discardHandInstances} mode="discard" onTileSelect={vi.fn()} />
      );

      const jokerInstance = discardHandInstances.find(
        (instance) => instance.tile === TILE_INDICES.JOKER
      )!;
      const jokerTile = screen.getByTestId(`tile-${jokerInstance.tile}-${jokerInstance.id}`);
      // Should NOT have disabled class in discard mode
      expect(jokerTile).not.toHaveClass('tile-disabled');
    });

    test('all 14 tiles are clickable in discard mode', async () => {
      const handleSelect = vi.fn();
      const { user } = renderWithProviders(
        <PlayerRack tiles={discardHandInstances} mode="discard" onTileSelect={handleSelect} />
      );

      // Click first tile
      await user.click(screen.getByTestId('tile-0-d0-0'));
      expect(handleSelect).toHaveBeenCalledWith('d0-0');

      // Click last tile (14th tile, index 13)
      await user.click(screen.getByTestId('tile-5-d5-13'));
      expect(handleSelect).toHaveBeenCalledWith('d5-13');
    });

    test('does not interact when disabled=true in discard mode', async () => {
      const handleSelect = vi.fn();
      const { user } = renderWithProviders(
        <PlayerRack
          tiles={discardHandInstances}
          mode="discard"
          disabled={true}
          onTileSelect={handleSelect}
        />
      );

      await user.click(screen.getByTestId('tile-5-d5-13'));
      expect(handleSelect).not.toHaveBeenCalled();
    });
  });
});
