import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { PassAnimationLayer } from './PassAnimationLayer';

describe('PassAnimationLayer', () => {
  test('renders pass direction label', () => {
    renderWithProviders(<PassAnimationLayer direction="Right" />);
    expect(screen.getByText(/Passing Right/i)).toBeInTheDocument();
    expect(screen.getByTestId('pass-animation-layer')).toHaveClass('z-30');
    expect(screen.getByTestId('pass-animation-layer')).toHaveAttribute('data-board-layer', 'z-30');
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

    test('does not apply pass animation class when reduced motion is active', () => {
      renderWithProviders(<PassAnimationLayer direction="Across" />);

      expect(screen.getByText(/Passing Across/i).closest('.pass-animation-card')).toBeNull();
    });
  });
});
