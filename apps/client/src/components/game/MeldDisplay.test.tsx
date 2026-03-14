/**
 * MeldDisplay Component Tests
 *
 * Tests individual meld visualization with called tile rotation
 * Related: US-013 (Calling Pung/Kong/Quint/Sextet)
 */

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MeldDisplay } from './MeldDisplay';
import type { Meld } from '@/types/bindings/generated/Meld';

describe('MeldDisplay', () => {
  describe('AC-1: Pung Display', () => {
    it('should render a Pung with 3 tiles', () => {
      const pungMeld: Meld = {
        meld_type: 'Pung',
        tiles: [4, 4, 4], // Three 5 Bams
        called_tile: 4,
        joker_assignments: {},
      };

      render(<MeldDisplay meld={pungMeld} />);

      const tiles = screen.getAllByTestId(/^tile-4-/);
      expect(tiles).toHaveLength(3);
    });

    it('should rotate the called tile 90 degrees', () => {
      const pungMeld: Meld = {
        meld_type: 'Pung',
        tiles: [4, 4, 4],
        called_tile: 4,
        joker_assignments: {},
      };

      render(<MeldDisplay meld={pungMeld} />);

      // At least one tile should have rotation indicator
      const rotatedTile = screen.getByTestId('meld-called-tile-0');
      expect(rotatedTile).toBeInTheDocument();
      expect(rotatedTile).toHaveAttribute('data-rotated', 'true');
    });

    it('should display meld type label', () => {
      const pungMeld: Meld = {
        meld_type: 'Pung',
        tiles: [4, 4, 4],
        called_tile: 4,
        joker_assignments: {},
      };

      render(<MeldDisplay meld={pungMeld} />);

      expect(screen.getByText(/Pung/i)).toBeInTheDocument();
    });

    it('should set rotation direction based on called_from', () => {
      const pungMeld: Meld & { called_from?: 'East' | 'South' | 'West' | 'North' } = {
        meld_type: 'Pung',
        tiles: [4, 4, 4],
        called_tile: 4,
        joker_assignments: {},
        called_from: 'South',
      };

      render(<MeldDisplay meld={pungMeld} ownerSeat="East" />);

      const calledTile = screen.getByTestId('meld-called-tile-0');
      expect(calledTile).toHaveAttribute('data-rotation', 'right');
    });
  });

  describe('AC-2: Kong Display', () => {
    it('should render a Kong with 4 tiles', () => {
      const kongMeld: Meld = {
        meld_type: 'Kong',
        tiles: [27, 27, 27, 27], // Four East Winds
        called_tile: 27,
        joker_assignments: {},
      };

      render(<MeldDisplay meld={kongMeld} />);

      const tiles = screen.getAllByTestId(/^tile-27-/);
      expect(tiles).toHaveLength(4);
    });

    it('should display Kong label', () => {
      const kongMeld: Meld = {
        meld_type: 'Kong',
        tiles: [27, 27, 27, 27],
        called_tile: 27,
        joker_assignments: {},
      };

      render(<MeldDisplay meld={kongMeld} />);

      expect(screen.getByText(/Kong/i)).toBeInTheDocument();
    });
  });

  describe('AC-3: Quint Display', () => {
    it('should render a Quint with 5 tiles', () => {
      const quintMeld: Meld = {
        meld_type: 'Quint',
        tiles: [11, 11, 11, 42, 42], // Three 2 Cracks + 2 Jokers
        called_tile: 11,
        joker_assignments: { 3: 11, 4: 11 },
      };

      render(<MeldDisplay meld={quintMeld} />);

      const tiles = screen.getAllByRole('img');
      expect(tiles).toHaveLength(5);
    });

    it('should display Jokers in the meld (EC-2)', () => {
      const quintMeld: Meld = {
        meld_type: 'Quint',
        tiles: [11, 11, 11, 42, 42],
        called_tile: 11,
        joker_assignments: { 3: 11, 4: 11 },
      };

      render(<MeldDisplay meld={quintMeld} />);

      // Should have both real tiles and jokers
      const jokerTiles = screen.getAllByTestId(/^tile-42-/);
      expect(jokerTiles).toHaveLength(2);
    });
  });

  describe('AC-4: Sextet Display', () => {
    it('should render a Sextet with 6 tiles', () => {
      const sextetMeld: Meld = {
        meld_type: 'Sextet',
        tiles: [8, 8, 8, 42, 42, 42], // Three 9 Bams + 3 Jokers
        called_tile: 8,
        joker_assignments: { 3: 8, 4: 8, 5: 8 },
      };

      render(<MeldDisplay meld={sextetMeld} />);

      const tiles = screen.getAllByRole('img');
      expect(tiles).toHaveLength(6);
    });

    it('should display multiple Jokers (EC-2)', () => {
      const sextetMeld: Meld = {
        meld_type: 'Sextet',
        tiles: [8, 8, 8, 42, 42, 42],
        called_tile: 8,
        joker_assignments: { 3: 8, 4: 8, 5: 8 },
      };

      render(<MeldDisplay meld={sextetMeld} />);

      const jokerTiles = screen.getAllByTestId(/^tile-42-/);
      expect(jokerTiles).toHaveLength(3);
    });
  });

  describe('AC-5: Compact Mode', () => {
    it('should render smaller tiles in compact mode', () => {
      const pungMeld: Meld = {
        meld_type: 'Pung',
        tiles: [4, 4, 4],
        called_tile: 4,
        joker_assignments: {},
      };

      const { container } = render(<MeldDisplay meld={pungMeld} compact />);

      // Compact mode should have smaller tile size class
      const meldContainer = container.querySelector('[data-testid="meld-display"]');
      expect(meldContainer).toHaveAttribute('data-compact', 'true');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      const pungMeld: Meld = {
        meld_type: 'Pung',
        tiles: [4, 4, 4],
        called_tile: 4,
        joker_assignments: {},
      };

      render(<MeldDisplay meld={pungMeld} />);

      const meldContainer = screen.getByRole('group');
      expect(meldContainer).toHaveAttribute('aria-label', expect.stringContaining('Pung'));
    });

    it('should indicate called tile in ARIA label', () => {
      const pungMeld: Meld = {
        meld_type: 'Pung',
        tiles: [4, 4, 4],
        called_tile: 4,
        joker_assignments: {},
      };

      render(<MeldDisplay meld={pungMeld} />);

      const calledTile = screen.getByTestId('meld-called-tile-0');
      expect(calledTile).toHaveAttribute('aria-label', expect.stringContaining('called'));
    });

    it('renders exchangeable joker tiles as interactive buttons with exchange label', () => {
      const onJokerTileClick = vi.fn();
      const meld: Meld = {
        meld_type: 'Quint',
        tiles: [11, 11, 11, 42, 42],
        called_tile: 11,
        joker_assignments: { 3: 11, 4: 12 },
      };

      render(
        <MeldDisplay
          meld={meld}
          exchangeableTilePositions={[3]}
          onJokerTileClick={onJokerTileClick}
        />
      );

      const exchangeButton = screen.getByTestId('joker-tile-exchangeable');
      expect(exchangeButton).toHaveAttribute(
        'aria-label',
        'Exchange Joker for 3 Crack - click to exchange'
      );

      fireEvent.click(exchangeButton);
      expect(onJokerTileClick).toHaveBeenCalledWith(3);
    });

    it('keeps non-exchangeable jokers plain and non-interactive', () => {
      const meld: Meld = {
        meld_type: 'Quint',
        tiles: [11, 11, 11, 42, 42],
        called_tile: 11,
        joker_assignments: { 3: 11, 4: 12 },
      };

      render(<MeldDisplay meld={meld} exchangeableTilePositions={[3]} />);

      expect(screen.getAllByTestId(/^tile-42-/)).toHaveLength(2);
      expect(screen.getAllByTestId('joker-tile-exchangeable')).toHaveLength(1);
      expect(
        screen.queryByLabelText('Exchange Joker for 4 Crack - click to exchange')
      ).not.toBeInTheDocument();
    });
  });
});
