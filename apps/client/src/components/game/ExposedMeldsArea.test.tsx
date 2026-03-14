/**
 * ExposedMeldsArea Component Tests
 *
 * Tests container for displaying all exposed melds
 * Related: US-013 (Calling Pung/Kong/Quint/Sextet)
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExposedMeldsArea } from './ExposedMeldsArea';
import type { Meld } from '@/types/bindings/generated/Meld';

describe('ExposedMeldsArea', () => {
  describe('Empty State', () => {
    it('should render empty state when no melds', () => {
      render(<ExposedMeldsArea melds={[]} />);

      expect(screen.getByText(/No exposed melds/i)).toBeInTheDocument();
    });

    it('should have proper ARIA label for empty state', () => {
      render(<ExposedMeldsArea melds={[]} />);

      const container = screen.getByRole('region');
      expect(container).toHaveAttribute('aria-label', 'Exposed melds');
    });
  });

  describe('Single Meld Display', () => {
    it('should render a single Pung meld', () => {
      const melds: Meld[] = [
        {
          meld_type: 'Pung',
          tiles: [4, 4, 4],
          called_tile: 4,
          joker_assignments: {},
        },
      ];

      render(<ExposedMeldsArea melds={melds} />);

      expect(screen.getByText(/Pung/i)).toBeInTheDocument();
    });
  });

  describe('Multiple Melds Display', () => {
    it('should render multiple melds in order', () => {
      const melds: Meld[] = [
        {
          meld_type: 'Pung',
          tiles: [4, 4, 4],
          called_tile: 4,
          joker_assignments: {},
        },
        {
          meld_type: 'Kong',
          tiles: [27, 27, 27, 27],
          called_tile: 27,
          joker_assignments: {},
        },
      ];

      render(<ExposedMeldsArea melds={melds} />);

      expect(screen.getByText(/Pung/i)).toBeInTheDocument();
      expect(screen.getByText(/Kong/i)).toBeInTheDocument();
    });

    it('should maintain meld order (left to right)', () => {
      const melds: Meld[] = [
        {
          meld_type: 'Pung',
          tiles: [4, 4, 4],
          called_tile: 4,
          joker_assignments: {},
        },
        {
          meld_type: 'Kong',
          tiles: [27, 27, 27, 27],
          called_tile: 27,
          joker_assignments: {},
        },
        {
          meld_type: 'Quint',
          tiles: [11, 11, 11, 42, 42],
          called_tile: 11,
          joker_assignments: { 3: 11, 4: 11 },
        },
      ];

      const { container } = render(<ExposedMeldsArea melds={melds} />);

      const meldElements = container.querySelectorAll('[data-testid^="meld-display"]');
      expect(meldElements).toHaveLength(3);
    });
  });

  describe('Compact Mode', () => {
    it('should render smaller melds in compact mode', () => {
      const melds: Meld[] = [
        {
          meld_type: 'Pung',
          tiles: [4, 4, 4],
          called_tile: 4,
          joker_assignments: {},
        },
      ];

      const { container } = render(<ExposedMeldsArea melds={melds} compact />);

      const areaContainer = container.querySelector('[data-testid="exposed-melds-area"]');
      expect(areaContainer).toHaveAttribute('data-compact', 'true');
    });
  });

  describe('Layout', () => {
    it('should display melds horizontally with proper spacing', () => {
      const melds: Meld[] = [
        {
          meld_type: 'Pung',
          tiles: [4, 4, 4],
          called_tile: 4,
          joker_assignments: {},
        },
        {
          meld_type: 'Kong',
          tiles: [27, 27, 27, 27],
          called_tile: 27,
          joker_assignments: {},
        },
      ];

      const { container } = render(<ExposedMeldsArea melds={melds} />);

      const areaContainer = container.querySelector('[data-testid="exposed-melds-area"]');
      expect(areaContainer).toHaveClass('flex');
    });
  });

  describe('Upgrade Highlighting (US-016)', () => {
    const upgradeablePung: Meld = {
      meld_type: 'Pung',
      tiles: [22, 22, 22],
      called_tile: 22,
      joker_assignments: {},
    };

    it('marks meld as upgradeable when upgradeableMeldIndices includes its index (AC-1)', () => {
      render(<ExposedMeldsArea melds={[upgradeablePung]} upgradeableMeldIndices={[0]} />);
      const meldWrapper = screen.getByTestId('meld-upgrade-wrapper-0');
      expect(meldWrapper).toHaveAttribute('data-upgradeable', 'true');
    });

    it('does not mark meld as upgradeable when index not in upgradeableMeldIndices', () => {
      render(<ExposedMeldsArea melds={[upgradeablePung]} upgradeableMeldIndices={[]} />);
      const meldWrapper = screen.getByTestId('meld-upgrade-wrapper-0');
      expect(meldWrapper).not.toHaveAttribute('data-upgradeable', 'true');
    });

    it('calls onMeldClick with correct index when upgradeable meld is clicked (AC-2)', () => {
      const onMeldClick = vi.fn();
      render(
        <ExposedMeldsArea
          melds={[upgradeablePung]}
          upgradeableMeldIndices={[0]}
          onMeldClick={onMeldClick}
        />
      );
      fireEvent.click(screen.getByTestId('meld-upgrade-wrapper-0'));
      expect(onMeldClick).toHaveBeenCalledWith(0);
    });

    it('does not call onMeldClick when meld is not upgradeable', () => {
      const onMeldClick = vi.fn();
      render(
        <ExposedMeldsArea
          melds={[upgradeablePung]}
          upgradeableMeldIndices={[]}
          onMeldClick={onMeldClick}
        />
      );
      fireEvent.click(screen.getByTestId('meld-upgrade-wrapper-0'));
      expect(onMeldClick).not.toHaveBeenCalled();
    });

    it('shows upgrade tooltip text for upgradeable meld (AC-1)', () => {
      render(<ExposedMeldsArea melds={[upgradeablePung]} upgradeableMeldIndices={[0]} />);
      expect(screen.getByText(/click to upgrade/i)).toBeInTheDocument();
    });
  });

  describe('Joker Exchange Affordance', () => {
    it('forwards exchangeable joker positions to the correct meld', () => {
      const melds: Meld[] = [
        {
          meld_type: 'Pung',
          tiles: [4, 4, 4],
          called_tile: 4,
          joker_assignments: {},
        },
        {
          meld_type: 'Quint',
          tiles: [11, 11, 11, 42, 42],
          called_tile: 11,
          joker_assignments: { 3: 11, 4: 12 },
        },
      ];

      render(<ExposedMeldsArea melds={melds} exchangeableJokersByMeld={{ 1: [3] }} />);

      expect(screen.getAllByTestId('joker-tile-exchangeable')).toHaveLength(1);
      expect(
        screen.getByLabelText('Exchange Joker for 3 Crack - click to exchange')
      ).toBeInTheDocument();
    });

    it('prepends meld index when forwarding joker click callbacks', () => {
      const onJokerTileClick = vi.fn();
      const melds: Meld[] = [
        {
          meld_type: 'Quint',
          tiles: [11, 11, 11, 42, 42],
          called_tile: 11,
          joker_assignments: { 3: 11, 4: 12 },
        },
      ];

      render(
        <ExposedMeldsArea
          melds={melds}
          exchangeableJokersByMeld={{ 0: [3] }}
          onJokerTileClick={onJokerTileClick}
        />
      );

      fireEvent.click(screen.getByTestId('joker-tile-exchangeable'));
      expect(onJokerTileClick).toHaveBeenCalledWith(0, 3);
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA labels', () => {
      const melds: Meld[] = [
        {
          meld_type: 'Pung',
          tiles: [4, 4, 4],
          called_tile: 4,
          joker_assignments: {},
        },
      ];

      render(<ExposedMeldsArea melds={melds} />);

      const container = screen.getByRole('region');
      expect(container).toHaveAttribute('aria-label', expect.stringContaining('exposed meld'));
    });

    it('should indicate count in ARIA label', () => {
      const melds: Meld[] = [
        {
          meld_type: 'Pung',
          tiles: [4, 4, 4],
          called_tile: 4,
          joker_assignments: {},
        },
        {
          meld_type: 'Kong',
          tiles: [27, 27, 27, 27],
          called_tile: 27,
          joker_assignments: {},
        },
      ];

      render(<ExposedMeldsArea melds={melds} />);

      const container = screen.getByRole('region');
      expect(container).toHaveAttribute('aria-label', expect.stringContaining('2 exposed melds'));
    });
  });
});
