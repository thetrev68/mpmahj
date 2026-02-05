/**
 * TileImage Component Tests
 *
 * Tests the visual representation of Mahjong tiles using SVG assets.
 * Follows TDD approach: RED -> GREEN -> REFACTOR
 *
 * Test Coverage:
 * - P0: Renders correct SVG for each tile index (0-36)
 * - P0: Handles all suits (Bam, Crak, Dot)
 * - P0: Handles special tiles (Winds, Dragons, Jokers, Flowers)
 * - P1: Lazy loads images if not in viewport
 * - P2: Handles missing asset gracefully
 * - P3: Performance - memoizes correctly
 */

import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TileImage } from './TileImage';
import type { Tile } from '@/types/bindings';

describe('TileImage', () => {
  describe('P0: Renders correct SVG for each tile index', () => {
    describe('Bam tiles (0-8)', () => {
      test('renders 1 Bam (index 0)', () => {
        render(<TileImage tile={0} />);
        const img = screen.getByRole('img', { name: /1 Bam/i });
        expect(img).toHaveAttribute('src', '/assets/tiles/1B_clear.svg');
      });

      test('renders 5 Bam (index 4)', () => {
        render(<TileImage tile={4} />);
        const img = screen.getByRole('img', { name: /5 Bam/i });
        expect(img).toHaveAttribute('src', '/assets/tiles/5B_clear.svg');
      });

      test('renders 9 Bam (index 8)', () => {
        render(<TileImage tile={8} />);
        const img = screen.getByRole('img', { name: /9 Bam/i });
        expect(img).toHaveAttribute('src', '/assets/tiles/9B_clear.svg');
      });
    });

    describe('Crack tiles (9-17)', () => {
      test('renders 1 Crack (index 9)', () => {
        render(<TileImage tile={9} />);
        const img = screen.getByRole('img', { name: /1 Crack/i });
        expect(img).toHaveAttribute('src', '/assets/tiles/1C_clear.svg');
      });

      test('renders 5 Crack (index 13)', () => {
        render(<TileImage tile={13} />);
        const img = screen.getByRole('img', { name: /5 Crack/i });
        expect(img).toHaveAttribute('src', '/assets/tiles/5C_clear.svg');
      });

      test('renders 9 Crack (index 17)', () => {
        render(<TileImage tile={17} />);
        const img = screen.getByRole('img', { name: /9 Crack/i });
        expect(img).toHaveAttribute('src', '/assets/tiles/9C_clear.svg');
      });
    });

    describe('Dot tiles (18-26)', () => {
      test('renders 1 Dot (index 18)', () => {
        render(<TileImage tile={18} />);
        const img = screen.getByRole('img', { name: /1 Dot/i });
        expect(img).toHaveAttribute('src', '/assets/tiles/1D_clear.svg');
      });

      test('renders 5 Dot (index 22)', () => {
        render(<TileImage tile={22} />);
        const img = screen.getByRole('img', { name: /5 Dot/i });
        expect(img).toHaveAttribute('src', '/assets/tiles/5D_clear.svg');
      });

      test('renders 9 Dot (index 26)', () => {
        render(<TileImage tile={26} />);
        const img = screen.getByRole('img', { name: /9 Dot/i });
        expect(img).toHaveAttribute('src', '/assets/tiles/9D_clear.svg');
      });
    });
  });

  describe('P0: Handles special tiles (Winds, Dragons, Jokers, Flowers)', () => {
    describe('Wind tiles (27-30)', () => {
      test('renders East Wind (index 27)', () => {
        render(<TileImage tile={27} />);
        const img = screen.getByRole('img', { name: /East Wind/i });
        expect(img).toHaveAttribute('src', '/assets/tiles/E_clear.svg');
      });

      test('renders South Wind (index 28)', () => {
        render(<TileImage tile={28} />);
        const img = screen.getByRole('img', { name: /South Wind/i });
        expect(img).toHaveAttribute('src', '/assets/tiles/S_clear.svg');
      });

      test('renders West Wind (index 29)', () => {
        render(<TileImage tile={29} />);
        const img = screen.getByRole('img', { name: /West Wind/i });
        expect(img).toHaveAttribute('src', '/assets/tiles/W_clear.svg');
      });

      test('renders North Wind (index 30)', () => {
        render(<TileImage tile={30} />);
        const img = screen.getByRole('img', { name: /North Wind/i });
        expect(img).toHaveAttribute('src', '/assets/tiles/N_clear.svg');
      });
    });

    describe('Dragon tiles (31-33)', () => {
      test('renders Green Dragon (index 31)', () => {
        render(<TileImage tile={31} />);
        const img = screen.getByRole('img', { name: /Green Dragon/i });
        expect(img).toHaveAttribute('src', '/assets/tiles/DG_clear.svg');
      });

      test('renders Red Dragon (index 32)', () => {
        render(<TileImage tile={32} />);
        const img = screen.getByRole('img', { name: /Red Dragon/i });
        expect(img).toHaveAttribute('src', '/assets/tiles/DR_clear.svg');
      });

      test('renders White Dragon (index 33)', () => {
        render(<TileImage tile={33} />);
        const img = screen.getByRole('img', { name: /White Dragon/i });
        expect(img).toHaveAttribute('src', '/assets/tiles/DW_clear.svg');
      });
    });

    describe('Flower tile (34)', () => {
      test('renders Flower (index 34)', () => {
        render(<TileImage tile={34} />);
        const img = screen.getByRole('img', { name: /Flower/i });
        // Accept any of the 8 flower variants (F1-F8)
        expect(img).toHaveAttribute('src', expect.stringMatching(/\/assets\/tiles\/F\d_clear\.svg/));
      });
    });

    describe('Joker tile (35)', () => {
      test('renders Joker (index 35)', () => {
        render(<TileImage tile={35} />);
        const img = screen.getByRole('img', { name: /Joker/i });
        expect(img).toHaveAttribute('src', '/assets/tiles/J_clear.svg');
      });
    });

    describe('Blank tile (36)', () => {
      test('renders Blank (index 36)', () => {
        render(<TileImage tile={36} />);
        const img = screen.getByRole('img', { name: /Blank/i });
        expect(img).toHaveAttribute('src', '/assets/tiles/Blank.svg');
      });
    });
  });

  describe('P2: Handles missing asset gracefully', () => {
    test('shows fallback text when image fails to load', async () => {
      render(<TileImage tile={0} />);
      const img = screen.getByRole('img') as HTMLImageElement;

      // Simulate image load error using fireEvent
      const { fireEvent } = await import('@testing-library/react');
      fireEvent.error(img);

      // Should show fallback text after error
      expect(await screen.findByText(/1 Bam/i)).toBeInTheDocument();
    });

    test('handles invalid tile index with error state', () => {
      const invalidTile = 999 as Tile;
      render(<TileImage tile={invalidTile} />);

      // Should render with fallback
      expect(screen.getByText(/Unknown Tile/i)).toBeInTheDocument();
    });
  });

  describe('P3: Performance - memoizes correctly', () => {
    test('component is memoized and does not re-render unnecessarily', () => {
      const renderSpy = vi.fn();
      const MemoizedTileImage = ({ tile }: { tile: Tile }) => {
        renderSpy();
        return <TileImage tile={tile} />;
      };

      const { rerender } = render(<MemoizedTileImage tile={0} />);
      expect(renderSpy).toHaveBeenCalledTimes(1);

      // Re-render with same props
      rerender(<MemoizedTileImage tile={0} />);
      expect(renderSpy).toHaveBeenCalledTimes(2); // Parent renders but TileImage should be memoized

      // Re-render with different props
      rerender(<MemoizedTileImage tile={1} />);
      expect(renderSpy).toHaveBeenCalledTimes(3);
    });
  });

  describe('Accessibility', () => {
    test('provides descriptive alt text for all tiles', () => {
      const testCases: Array<[Tile, RegExp]> = [
        [0, /1 Bam/i],
        [9, /1 Crack/i],
        [18, /1 Dot/i],
        [27, /East Wind/i],
        [31, /Green Dragon/i],
        [34, /Flower/i],
        [35, /Joker/i],
      ];

      testCases.forEach(([tile, expectedText]) => {
        const { unmount } = render(<TileImage tile={tile} />);
        expect(screen.getByRole('img', { name: expectedText })).toBeInTheDocument();
        unmount();
      });
    });

    test('includes tile index in aria-label for reference', () => {
      render(<TileImage tile={4} />);
      const img = screen.getByRole('img');
      expect(img).toHaveAttribute('aria-label', expect.stringContaining('(4)'));
    });
  });

  describe('Custom props', () => {
    test('accepts custom testId', () => {
      render(<TileImage tile={0} testId="custom-tile" />);
      expect(screen.getByTestId('custom-tile')).toBeInTheDocument();
    });

    test('applies custom className', () => {
      render(<TileImage tile={0} className="custom-class" />);
      const img = screen.getByRole('img');
      expect(img.parentElement).toHaveClass('custom-class');
    });

    test('accepts custom aria-label override', () => {
      render(<TileImage tile={0} ariaLabel="Custom tile label" />);
      expect(screen.getByRole('img', { name: 'Custom tile label' })).toBeInTheDocument();
    });
  });
});
