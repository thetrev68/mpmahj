import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { WallCounter } from './WallCounter';

describe('WallCounter', () => {
  test('shows exhausted wall warning', () => {
    renderWithProviders(<WallCounter remainingTiles={0} totalTiles={152} />);
    expect(screen.getByTestId('wall-exhausted-warning')).toBeInTheDocument();
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
