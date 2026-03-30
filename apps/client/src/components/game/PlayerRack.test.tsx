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
import { act } from '@testing-library/react';
import { renderWithProviders, screen, within } from '@/test/test-utils';
import { PlayerRack } from './PlayerRack';
import { TILE_INDICES } from '@/lib/utils/tileUtils';
import type { Tile } from '@/types/bindings';
import type { TileInstance } from './types';

const mockMeld = {
  meld_type: 'Pung' as const,
  tiles: [1, 1, 1],
  called_tile: 1,
  joker_assignments: {},
};

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

      expect(screen.getByTestId('player-rack')).toBeInTheDocument();
      expect(screen.getByTestId('player-rack')).not.toHaveClass('fixed');
    });

    test('applies active ring classes when isActive=true', () => {
      renderWithProviders(
        <PlayerRack
          tiles={charlestonHandInstances}
          mode="charleston"
          onTileSelect={vi.fn()}
          isActive={true}
        />
      );

      expect(screen.getByTestId('player-rack')).toHaveClass('ring-2', 'ring-green-400');
    });

    test('does not apply active ring classes when isActive=false', () => {
      renderWithProviders(
        <PlayerRack
          tiles={charlestonHandInstances}
          mode="charleston"
          onTileSelect={vi.fn()}
          isActive={false}
        />
      );

      expect(screen.getByTestId('player-rack')).not.toHaveClass('ring-2');
      expect(screen.getByTestId('player-rack')).not.toHaveClass('ring-green-400');
    });

    test('renders the meld row even when there are no exposed melds', () => {
      renderWithProviders(<PlayerRack tiles={[]} mode="charleston" onTileSelect={vi.fn()} />);

      const meldRow = screen.getByTestId('player-rack-meld-row');
      expect(meldRow).toBeInTheDocument();
      expect(meldRow.getAttribute('style')).toContain('min-height: var(--tile-h-md)');
    });

    test('renders both rack rows alongside concealed tiles (meld content deferred to VR-009)', () => {
      renderWithProviders(
        <PlayerRack tiles={charlestonHandInstances} mode="charleston" onTileSelect={vi.fn()} />
      );

      expect(screen.getByTestId('player-rack-meld-row')).toBeInTheDocument();
      expect(screen.getByTestId('player-rack-concealed-row')).toBeInTheDocument();
    });

    test('renders exposed melds inside the rack when melds are provided', () => {
      renderWithProviders(
        <PlayerRack
          tiles={charlestonHandInstances}
          mode="charleston"
          onTileSelect={vi.fn()}
          melds={[mockMeld]}
          yourSeat="South"
        />
      );

      const rackShell = screen.getByTestId('player-rack-shell');
      expect(within(rackShell).getByTestId('exposed-melds-area')).toBeInTheDocument();
    });

    test('keeps the meld row visible without rendering exposed melds when melds are omitted', () => {
      renderWithProviders(
        <PlayerRack tiles={charlestonHandInstances} mode="charleston" onTileSelect={vi.fn()} />
      );

      expect(screen.getByTestId('player-rack-meld-row')).toBeInTheDocument();
      expect(screen.queryByTestId('exposed-melds-area')).not.toBeInTheDocument();
    });

    test('forwards meld upgrade props to the exposed melds area', async () => {
      const handleMeldClick = vi.fn();
      const { user } = renderWithProviders(
        <PlayerRack
          tiles={charlestonHandInstances}
          mode="charleston"
          onTileSelect={vi.fn()}
          melds={[mockMeld]}
          yourSeat="South"
          upgradeableMeldIndices={[0]}
          onMeldClick={handleMeldClick}
        />
      );

      await user.click(screen.getByTestId('meld-upgrade-wrapper-0'));
      expect(handleMeldClick).toHaveBeenCalledWith(0);
    });

    test('forwards exchangeable joker props to the local exposed meld row', async () => {
      const onJokerTileClick = vi.fn();
      const { user } = renderWithProviders(
        <PlayerRack
          tiles={charlestonHandInstances}
          mode="discard"
          onTileSelect={vi.fn()}
          melds={[
            {
              meld_type: 'Quint',
              tiles: [11, 11, 11, 42, 42],
              called_tile: 11,
              joker_assignments: { 3: 11, 4: 12 },
            },
          ]}
          yourSeat="South"
          exchangeableJokersByMeld={{ 0: [3] }}
          onJokerTileClick={onJokerTileClick}
        />
      );

      await user.click(screen.getByTestId('joker-tile-exchangeable'));
      expect(onJokerTileClick).toHaveBeenCalledWith(0, 3);
    });

    test('keeps the rack inside a board-local containment viewport instead of a fixed outer width', () => {
      renderWithProviders(
        <PlayerRack tiles={charlestonHandInstances} mode="charleston" onTileSelect={vi.fn()} />
      );

      expect(screen.getByTestId('player-rack-viewport')).toHaveClass(
        'w-full',
        'max-w-[58rem]'
      );
      expect(screen.getByTestId('player-rack-viewport')).toHaveAttribute(
        'data-board-region',
        'player-rack-containment'
      );
      expect(screen.getByTestId('player-rack-scale-shell')).toHaveAttribute(
        'data-rack-scale',
        'full-size'
      );
      expect(screen.getByTestId('player-rack-scale-shell').getAttribute('style')).toContain(
        'width: 1038px'
      );
    });

    test('switches into scaled containment when the available width is narrower than the rack span', () => {
      const originalResizeObserver = window.ResizeObserver;
      let resizeCallback: ResizeObserverCallback | null = null;

      class MockResizeObserver {
        constructor(callback: ResizeObserverCallback) {
          resizeCallback = callback;
        }

        observe() {}

        disconnect() {}

        unobserve() {}
      }

      Object.defineProperty(window, 'ResizeObserver', {
        configurable: true,
        writable: true,
        value: MockResizeObserver,
      });

      renderWithProviders(
        <div style={{ width: '800px' }}>
          <PlayerRack tiles={charlestonHandInstances} mode="charleston" onTileSelect={vi.fn()} />
        </div>
      );

      const viewport = screen.getByTestId('player-rack-viewport');
      Object.defineProperty(viewport, 'clientWidth', {
        configurable: true,
        value: 800,
      });

      act(() => {
        resizeCallback?.([] as ResizeObserverEntry[], {} as ResizeObserver);
      });

      const rackScaleShell = screen.getByTestId('player-rack-scale-shell');
      expect(rackScaleShell).toHaveAttribute('data-rack-scale', 'scaled');
      expect(rackScaleShell.getAttribute('style')).toContain('scale(');
      expect(viewport.getAttribute('style')).toContain('height:');

      Object.defineProperty(window, 'ResizeObserver', {
        configurable: true,
        writable: true,
        value: originalResizeObserver,
      });
    });

    test('centers concealed tiles within the rack shell (AC-4)', () => {
      renderWithProviders(
        <PlayerRack tiles={charlestonHandInstances} mode="charleston" onTileSelect={vi.fn()} />
      );

      const concealedRow = screen.getByTestId('player-rack-concealed-row');
      const tileContainer = concealedRow.querySelector('.flex.justify-center');
      expect(tileContainer).not.toBeNull();
    });

    test('uses the wooden enclosure styling on the rack shell', () => {
      renderWithProviders(
        <PlayerRack tiles={charlestonHandInstances} mode="charleston" onTileSelect={vi.fn()} />
      );

      const rackShellStyle = screen.getByTestId('player-rack-shell').getAttribute('style');
      expect(rackShellStyle).toContain('linear-gradient');
      expect(rackShellStyle).toContain('rgb(139, 94, 60)');
    });

    test('shows selection counter in charleston mode when the rack owns it', () => {
      renderWithProviders(
        <PlayerRack tiles={charlestonHandInstances} mode="charleston" onTileSelect={vi.fn()} />
      );

      expect(screen.getByTestId('player-rack-selection-counter')).toHaveTextContent('0/3');
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

      expect(screen.getByTestId('player-rack-selection-counter')).toHaveTextContent('2/3');
    });

    test('shows the mixed blind-pass counter when blind staging tiles are available', () => {
      renderWithProviders(
        <PlayerRack
          tiles={charlestonHandInstances}
          mode="charleston"
          selectedTileIds={['t0-0']}
          blindPassCount={2}
          onTileSelect={vi.fn()}
        />
      );

      expect(screen.getByTestId('player-rack-selection-counter')).toHaveTextContent(
        '1 hand + 2 blind = 3 total'
      );
    });

    test('does not render a sort button (AC-4, US-082)', () => {
      renderWithProviders(
        <PlayerRack tiles={charlestonHandInstances} mode="discard" onTileSelect={vi.fn()} />
      );

      expect(screen.queryByTestId('rack-sort-button')).not.toBeInTheDocument();
    });

    test('renders concealed rack in canonical order (AC-2, US-082)', () => {
      // Mixed hand: Joker, Flower, Bam, Green Dragon, Crak, Dot, Wind
      const mixedTiles: TileInstance[] = [
        { id: 'j-0', tile: 42 as Tile }, // Joker
        { id: 'f-0', tile: 34 as Tile }, // Flower F1
        { id: 'b1-0', tile: 0 as Tile }, // 1 Bam
        { id: 'dg-0', tile: 31 as Tile }, // Green Dragon
        { id: 'c1-0', tile: 9 as Tile }, // 1 Crak
        { id: 'd1-0', tile: 18 as Tile }, // 1 Dot
        { id: 'ew-0', tile: 27 as Tile }, // East Wind
      ];

      renderWithProviders(
        <PlayerRack tiles={mixedTiles} mode="view-only" onTileSelect={vi.fn()} />
      );

      // Verify canonical order by checking that each tile's testid exists and
      // appears in the expected sequence within the concealed row
      const expectedOrder = [
        'tile-42-j-0', // Joker
        'tile-34-f-0', // Flower F1
        'tile-0-b1-0', // 1 Bam
        'tile-31-dg-0', // Green Dragon
        'tile-9-c1-0', // 1 Crak
        'tile-18-d1-0', // 1 Dot
        'tile-27-ew-0', // East Wind
      ];

      const concealedRow = screen.getByTestId('player-rack-concealed-row');
      const allTestIds = Array.from(concealedRow.querySelectorAll('[data-testid]'))
        .map((el) => el.getAttribute('data-testid')!)
        .filter((id) => id.startsWith('tile-') && !id.startsWith('tile-image-'));

      expect(allTestIds).toEqual(expectedOrder);
    });

    test('inserts extra boundary gap only between real group boundaries (AC-5, US-082)', () => {
      const mixedTiles: TileInstance[] = [
        { id: 'j-0', tile: 42 as Tile }, // Joker (group: joker)
        { id: 'f-0', tile: 34 as Tile }, // Flower (group: flower)
        { id: 'b1-0', tile: 0 as Tile }, // 1 Bam (group: bam)
        { id: 'b2-0', tile: 1 as Tile }, // 2 Bam (group: bam)
      ];

      renderWithProviders(
        <PlayerRack tiles={mixedTiles} mode="view-only" onTileSelect={vi.fn()} />
      );

      const concealedRow = screen.getByTestId('player-rack-concealed-row');
      const boundaryElements = concealedRow.querySelectorAll('[data-group-boundary="true"]');
      // Boundaries: joker→flower, flower→bam = 2 boundaries
      expect(boundaryElements).toHaveLength(2);
    });

    test('no internal spacing when all tiles are in the same group (EC-2)', () => {
      const allBams: TileInstance[] = [
        { id: 'b1-0', tile: 0 as Tile },
        { id: 'b2-0', tile: 1 as Tile },
        { id: 'b3-0', tile: 2 as Tile },
      ];

      renderWithProviders(<PlayerRack tiles={allBams} mode="view-only" onTileSelect={vi.fn()} />);

      const concealedRow = screen.getByTestId('player-rack-concealed-row');
      const boundaryElements = concealedRow.querySelectorAll('[data-group-boundary="true"]');
      expect(boundaryElements).toHaveLength(0);
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

    test('selected tiles render as ghost placeholders in charleston mode (VR-016)', () => {
      renderWithProviders(
        <PlayerRack
          tiles={charlestonHandInstances}
          mode="charleston"
          selectedTileIds={['t0-0', 't1-1', 't2-2']}
          onTileSelect={vi.fn()}
        />
      );

      // Selected tiles render as ghost wrappers, not with tile-selected class
      expect(screen.getByTestId('ghost-t0-0')).toBeInTheDocument();
      expect(screen.getByTestId('ghost-t1-1')).toBeInTheDocument();
      expect(screen.getByTestId('ghost-t2-2')).toBeInTheDocument();
      expect(screen.getByTestId('tile-0-t0-0')).not.toHaveClass('tile-selected');

      // Non-selected tile renders normally without a ghost wrapper
      expect(screen.queryByTestId('ghost-t9-3')).not.toBeInTheDocument();
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

      expect(screen.queryByTestId('player-rack-selection-counter')).not.toBeInTheDocument();
    });

    test('does not show selection counter when ownership moves to the action region', () => {
      renderWithProviders(
        <PlayerRack
          tiles={charlestonHandInstances}
          mode="charleston"
          showSelectionCounter={false}
          onTileSelect={vi.fn()}
        />
      );

      expect(screen.queryByTestId('player-rack-selection-counter')).not.toBeInTheDocument();
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

      expect(screen.getByTestId('player-rack')).toHaveAttribute('aria-label');
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

      const counter = screen.getByTestId('player-rack-selection-counter');
      expect(counter).toHaveAttribute('aria-live', 'polite');
    });

    test('AC-7: focus a tile via Tab, press Enter → tile becomes selected', async () => {
      const handleSelect = vi.fn(() => ({ status: 'selected' as const, tileId: 't0-0' }));
      const { user } = renderWithProviders(
        <PlayerRack tiles={charlestonHandInstances} mode="charleston" onTileSelect={handleSelect} />
      );

      // Tab into the first interactive tile
      await user.tab();
      const focusedTile = screen.getByTestId('tile-0-t0-0');
      expect(focusedTile).toHaveFocus();

      // Press Enter to select
      await user.keyboard('{Enter}');
      expect(handleSelect).toHaveBeenCalledWith('t0-0');
    });

    test('AC-7: focus a tile via Tab, press Space → tile becomes selected', async () => {
      const handleSelect = vi.fn(() => ({ status: 'selected' as const, tileId: 't0-0' }));
      const { user } = renderWithProviders(
        <PlayerRack tiles={charlestonHandInstances} mode="charleston" onTileSelect={handleSelect} />
      );

      await user.tab();
      const focusedTile = screen.getByTestId('tile-0-t0-0');
      expect(focusedTile).toHaveFocus();

      await user.keyboard(' ');
      expect(handleSelect).toHaveBeenCalledWith('t0-0');
    });

    test('AC-8: disabled tile (Joker in charleston) has tabIndex -1 and is not focusable', () => {
      renderWithProviders(
        <PlayerRack tiles={charlestonHandInstances} mode="charleston" onTileSelect={vi.fn()} />
      );

      const jokerInstance = charlestonHandInstances.find(
        (instance) => instance.tile === TILE_INDICES.JOKER
      )!;
      const jokerTile = screen.getByTestId(`tile-${jokerInstance.tile}-${jokerInstance.id}`);
      expect(jokerTile).toHaveAttribute('tabindex', '-1');
      expect(jokerTile).toHaveAttribute('aria-disabled', 'true');
    });

    test('AC-8: explicitly disabled tile has tabIndex -1', () => {
      renderWithProviders(
        <PlayerRack
          tiles={charlestonHandInstances}
          mode="discard"
          disabledTileIds={['t0-0']}
          onTileSelect={vi.fn()}
        />
      );

      const disabledTile = screen.getByTestId('tile-0-t0-0');
      expect(disabledTile).toHaveAttribute('tabindex', '-1');
      expect(disabledTile).toHaveAttribute('aria-disabled', 'true');
    });

    test('AC-4: selected tile has aria-pressed true, unselected has false', () => {
      renderWithProviders(
        <PlayerRack
          tiles={charlestonHandInstances}
          mode="discard"
          selectedTileIds={['t0-0']}
          onTileSelect={vi.fn()}
        />
      );

      const selectedTile = screen.getByTestId('tile-0-t0-0');
      expect(selectedTile).toHaveAttribute('aria-pressed', 'true');

      const unselectedTile = screen.getByTestId('tile-1-t1-1');
      expect(unselectedTile).toHaveAttribute('aria-pressed', 'false');
    });

    test('AC-6: each interactive tile has an aria-label describing its face value', () => {
      renderWithProviders(
        <PlayerRack tiles={charlestonHandInstances} mode="charleston" onTileSelect={vi.fn()} />
      );

      // Tile 0 = 1 Bam
      expect(screen.getByTestId('tile-0-t0-0')).toHaveAttribute('aria-label', '1 Bam');
      // Tile 27 = East Wind
      expect(screen.getByTestId('tile-27-t27-9')).toHaveAttribute('aria-label', 'East Wind');
      // Tile 42 = Joker
      const jokerInstance = charlestonHandInstances.find(
        (instance) => instance.tile === TILE_INDICES.JOKER
      )!;
      expect(screen.getByTestId(`tile-${jokerInstance.tile}-${jokerInstance.id}`)).toHaveAttribute(
        'aria-label',
        'Joker'
      );
    });

    test('no sort button renders in any mode (AC-4, US-082)', () => {
      renderWithProviders(
        <PlayerRack tiles={charlestonHandInstances} mode="discard" onTileSelect={vi.fn()} />
      );

      expect(screen.queryByTestId('rack-sort-button')).not.toBeInTheDocument();
    });
  });

  describe('Newly Received Highlight - US-049', () => {
    test('applies newly received treatment when rack-local ids are handed off from the store', () => {
      const onAck = vi.fn();
      renderWithProviders(
        <PlayerRack
          tiles={charlestonHandInstances}
          mode="charleston"
          newlyReceivedTileIds={['t0-0', 't1-1']}
          onNewlyReceivedTilesAcknowledged={onAck}
          onTileSelect={vi.fn()}
        />
      );

      expect(screen.getByTestId('tile-0-t0-0')).toHaveClass('tile-highlighted', 'tile-newly-drawn');
      expect(screen.getByTestId('tile-1-t1-1')).toHaveClass('tile-highlighted', 'tile-newly-drawn');
      expect(onAck).toHaveBeenCalledOnce();
    });

    test('expires newly received treatment after 10 seconds', () => {
      vi.useFakeTimers();

      renderWithProviders(
        <PlayerRack
          tiles={charlestonHandInstances}
          mode="charleston"
          newlyReceivedTileIds={['t0-0']}
          onTileSelect={vi.fn()}
        />
      );

      expect(screen.getByTestId('tile-0-t0-0')).toHaveClass('tile-newly-drawn');

      act(() => {
        vi.advanceTimersByTime(10000);
      });

      expect(screen.getByTestId('tile-0-t0-0')).not.toHaveClass('tile-newly-drawn');

      vi.useRealTimers();
    });

    test('highlights only the duplicate instance ids provided by the event layer', () => {
      const duplicateTiles: TileInstance[] = [
        { id: '0-0', tile: 0 },
        { id: '0-1', tile: 0 },
        { id: '0-2', tile: 0 },
        { id: '1-0', tile: 1 },
      ];

      renderWithProviders(
        <PlayerRack
          tiles={duplicateTiles}
          mode="charleston"
          highlightedTileIds={['0-2']}
          newlyReceivedTileIds={['0-2']}
          onTileSelect={vi.fn()}
        />
      );

      expect(screen.getByTestId('tile-0-0-2')).toHaveClass('tile-highlighted', 'tile-newly-drawn');
      expect(screen.getByTestId('tile-0-0-0')).not.toHaveClass('tile-highlighted');
      expect(screen.getByTestId('tile-0-0-1')).not.toHaveClass('tile-highlighted');
    });

    test('remount keeps duplicate glow pinned to the same instance id', () => {
      const duplicateTiles: TileInstance[] = [
        { id: '0-0', tile: 0 },
        { id: '0-1', tile: 0 },
        { id: '0-2', tile: 0 },
        { id: '1-0', tile: 1 },
      ];
      const props = {
        tiles: duplicateTiles,
        mode: 'charleston' as const,
        highlightedTileIds: ['0-2'],
        newlyReceivedTileIds: ['0-2'],
        onTileSelect: vi.fn(),
      };

      const firstRender = renderWithProviders(<PlayerRack {...props} />);
      expect(screen.getByTestId('tile-0-0-2')).toHaveClass('tile-highlighted', 'tile-newly-drawn');
      expect(screen.getByTestId('tile-0-0-0')).not.toHaveClass('tile-highlighted');
      firstRender.unmount();

      renderWithProviders(<PlayerRack {...props} />);

      expect(screen.getByTestId('tile-0-0-2')).toHaveClass('tile-highlighted', 'tile-newly-drawn');
      expect(screen.getByTestId('tile-0-0-0')).not.toHaveClass('tile-highlighted');
      expect(screen.getByTestId('tile-0-0-1')).not.toHaveClass('tile-highlighted');
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

      expect(screen.getByTestId('player-rack-selection-counter')).toHaveTextContent('0/1');
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

      expect(screen.getByTestId('player-rack-selection-counter')).toHaveTextContent('1/1');
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

  describe('Ghost Placeholder — VR-016', () => {
    const ghostTile = charlestonHandInstances[0]; // tile id 't0-0'

    // T-1: Ghost is in the DOM (tile not removed from rack)
    test('T-1: selected tile still appears in DOM as ghost in charleston mode', () => {
      renderWithProviders(
        <PlayerRack
          tiles={charlestonHandInstances}
          mode="charleston"
          selectedTileIds={[ghostTile.id]}
          onTileSelect={vi.fn()}
        />
      );

      expect(screen.getByTestId(`ghost-${ghostTile.id}`)).toBeInTheDocument();
      expect(screen.getByTestId(`tile-${ghostTile.tile}-${ghostTile.id}`)).toBeInTheDocument();
    });

    // T-2: Ghost wrapper has aria-hidden="true"
    test('T-2: ghost placeholder has aria-hidden="true"', () => {
      renderWithProviders(
        <PlayerRack
          tiles={charlestonHandInstances}
          mode="charleston"
          selectedTileIds={[ghostTile.id]}
          onTileSelect={vi.fn()}
        />
      );

      expect(screen.getByTestId(`ghost-${ghostTile.id}`)).toHaveAttribute('aria-hidden', 'true');
    });

    // T-3: Clicking ghost calls onTileSelect with tile id
    test('T-3: clicking the ghost calls onTileSelect with the tile id', async () => {
      const handleSelect = vi.fn();
      const { user } = renderWithProviders(
        <PlayerRack
          tiles={charlestonHandInstances}
          mode="charleston"
          selectedTileIds={[ghostTile.id]}
          onTileSelect={handleSelect}
        />
      );

      await user.click(screen.getByTestId(`ghost-${ghostTile.id}`));
      expect(handleSelect).toHaveBeenCalledWith(ghostTile.id);
    });

    // T-4: No ghost in discard mode — tile renders with selected state
    test('T-4: no ghost rendering in discard mode — tile shows selected state', () => {
      const discardHand: TileInstance[] = [
        { id: 'd0-0', tile: 0 as Tile },
        { id: 'd1-1', tile: 1 as Tile },
      ];
      renderWithProviders(
        <PlayerRack
          tiles={discardHand}
          mode="discard"
          selectedTileIds={['d0-0']}
          onTileSelect={vi.fn()}
        />
      );

      expect(screen.queryByTestId('ghost-d0-0')).not.toBeInTheDocument();
      expect(screen.getByTestId('tile-0-d0-0')).toHaveClass('tile-selected');
    });

    // T-5: No ghosts when no tiles are selected in charleston mode
    test('T-5: no ghost elements when no tiles are selected in charleston mode', () => {
      renderWithProviders(
        <PlayerRack
          tiles={charlestonHandInstances}
          mode="charleston"
          selectedTileIds={[]}
          onTileSelect={vi.fn()}
        />
      );

      charlestonHandInstances.forEach((tile) => {
        expect(screen.queryByTestId(`ghost-${tile.id}`)).not.toBeInTheDocument();
      });
    });
  });
});
