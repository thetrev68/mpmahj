/**
 * WinnerCelebration Component Tests
 *
 * Related: US-018 (Declaring Mahjong - Self-Draw), AC-4
 */

import { afterEach, beforeEach, describe, test, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { WinnerCelebration } from './WinnerCelebration';

describe('WinnerCelebration', () => {
  const defaultProps = {
    isOpen: true,
    winnerName: 'Alice',
    winnerSeat: 'South' as const,
    patternName: 'Odds Only',
    onContinue: vi.fn(),
  };

  test('renders "Mahjong!" heading when open', () => {
    renderWithProviders(<WinnerCelebration {...defaultProps} />);
    expect(screen.getByText(/Mahjong!/i)).toBeInTheDocument();
  });

  test('shows winner name and seat', () => {
    renderWithProviders(<WinnerCelebration {...defaultProps} />);
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/South/)).toBeInTheDocument();
  });

  test('shows pattern name', () => {
    renderWithProviders(<WinnerCelebration {...defaultProps} />);
    expect(screen.getByText(/Odds Only/)).toBeInTheDocument();
  });

  test('shows hand value when provided', () => {
    renderWithProviders(<WinnerCelebration {...defaultProps} handValue={35} />);
    expect(screen.getByText(/35/)).toBeInTheDocument();
  });

  test('does not show points section when handValue is omitted', () => {
    renderWithProviders(<WinnerCelebration {...defaultProps} />);
    expect(screen.queryByTestId('hand-value')).not.toBeInTheDocument();
  });

  test('renders a Continue button', () => {
    renderWithProviders(<WinnerCelebration {...defaultProps} />);
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  test('calls onContinue when Continue button clicked', async () => {
    const onContinue = vi.fn();
    const { user } = renderWithProviders(
      <WinnerCelebration {...defaultProps} onContinue={onContinue} />
    );
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  test('does not render overlay content when isOpen is false', () => {
    renderWithProviders(<WinnerCelebration {...defaultProps} isOpen={false} />);
    expect(screen.queryByText(/Mahjong!/i)).not.toBeInTheDocument();
  });

  test('has data-testid for automation', () => {
    renderWithProviders(<WinnerCelebration {...defaultProps} />);
    expect(screen.getByTestId('winner-celebration')).toBeInTheDocument();
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

    test('does not apply animated title or backdrop classes when reduced motion is active', () => {
      renderWithProviders(<WinnerCelebration {...defaultProps} />);

      expect(screen.getByTestId('winner-celebration-title').className).not.toContain(
        'animate-bounce'
      );
      expect(screen.getByTestId('winner-celebration-backdrop').className).not.toContain(
        'animate-pulse'
      );
    });
  });
});
