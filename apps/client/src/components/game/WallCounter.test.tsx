import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { WallCounter } from './WallCounter';

describe('WallCounter', () => {
  test('shows exhausted wall warning', () => {
    renderWithProviders(<WallCounter remainingTiles={0} totalTiles={152} />);
    expect(screen.getByTestId('wall-exhausted-warning')).toBeInTheDocument();
  });

  test('AC-5 (US-079): uses chrome-family gradient instead of black card', () => {
    renderWithProviders(<WallCounter remainingTiles={80} totalTiles={152} />);
    const counter = screen.getByTestId('wall-counter');

    expect(counter.getAttribute('style')).toContain('rgba(12, 35, 18');
    expect(counter.getAttribute('style')).toContain('rgba(80, 160, 100');
    expect(counter.className).not.toContain('bg-black');
    expect(counter).not.toHaveClass('fixed');
    expect(counter).toHaveAttribute('data-chrome-layer', 'z-20');
  });

  test('AC-5 (US-079): uses compact label "Wall:" instead of "Tiles Remaining:"', () => {
    renderWithProviders(<WallCounter remainingTiles={80} totalTiles={152} />);

    expect(screen.getByText('Wall:')).toBeInTheDocument();
  });

  test('displays remaining and total tile count', () => {
    renderWithProviders(<WallCounter remainingTiles={80} totalTiles={152} />);
    expect(screen.getByTestId('wall-counter-value')).toHaveTextContent('80');
  });

  describe('Reduced Motion', () => {
    const originalMatchMedia = window.matchMedia;

    beforeEach(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        })),
      });
    });

    afterEach(() => {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        value: originalMatchMedia,
      });
    });

    test('omits pulse animation on exhausted warning when reduced motion is active', () => {
      renderWithProviders(<WallCounter remainingTiles={0} totalTiles={152} />);
      expect(screen.getByTestId('wall-exhausted-warning').className).not.toContain('animate-pulse');
    });
  });
});
