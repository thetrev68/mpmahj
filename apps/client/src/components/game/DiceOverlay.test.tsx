import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { DiceOverlay } from './DiceOverlay';

describe('DiceOverlay', () => {
  test('renders rolling state when open', () => {
    renderWithProviders(<DiceOverlay isOpen rollTotal={8} />);
    expect(screen.getByText(/Rolling/i)).toBeInTheDocument();
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

    test('omits bounce and pulse classes while rolling when reduced motion is active', () => {
      renderWithProviders(<DiceOverlay isOpen rollTotal={8} />);

      expect(screen.getByTestId('dice-1').className).not.toContain('animate-bounce');
      expect(screen.getByTestId('dice-2').className).not.toContain('animate-bounce');
      expect(screen.getByText(/Rolling/i).className).not.toContain('animate-pulse');
    });
  });
});
