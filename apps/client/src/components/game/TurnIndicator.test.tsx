/**
 * TurnIndicator Component Tests
 */

import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, expect, vi } from 'vitest';
import { TurnIndicator } from './TurnIndicator';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';

describe('TurnIndicator', () => {
  describe('Rendering', () => {
    it('uses a board-relative positioning layer instead of viewport-fixed placement', () => {
      render(<TurnIndicator currentSeat="South" stage={null} isMyTurn={true} />);

      expect(screen.getByTestId('turn-indicator-layer')).toHaveAttribute(
        'data-positioning',
        'board-relative'
      );
      expect(screen.getByTestId('turn-indicator-layer')).toHaveClass('absolute', 'inset-0');
    });

    it('renders indicator only for current seat', () => {
      render(<TurnIndicator currentSeat="South" stage={null} isMyTurn={true} />);

      expect(screen.getByTestId('turn-indicator-south')).toBeInTheDocument();
      expect(screen.queryByTestId('turn-indicator-east')).not.toBeInTheDocument();
      expect(screen.queryByTestId('turn-indicator-west')).not.toBeInTheDocument();
      expect(screen.queryByTestId('turn-indicator-north')).not.toBeInTheDocument();
    });

    it('renders indicator for East seat', () => {
      render(<TurnIndicator currentSeat="East" stage={null} />);

      expect(screen.getByTestId('turn-indicator-east')).toBeInTheDocument();
      expect(screen.getByText('East')).toBeInTheDocument();
    });

    it('renders indicator for West seat', () => {
      render(<TurnIndicator currentSeat="West" stage={null} />);

      expect(screen.getByTestId('turn-indicator-west')).toBeInTheDocument();
      expect(screen.getByText('West')).toBeInTheDocument();
    });

    it('renders indicator for North seat', () => {
      render(<TurnIndicator currentSeat="North" stage={null} />);

      expect(screen.getByTestId('turn-indicator-north')).toBeInTheDocument();
      expect(screen.getByText('North')).toBeInTheDocument();
    });
  });

  describe('Stage Display', () => {
    it('shows Drawing stage', () => {
      const stage: TurnStage = { Drawing: { player: 'South' } };
      render(<TurnIndicator currentSeat="South" stage={stage} />);

      expect(screen.getByText(/Drawing/i)).toBeInTheDocument();
    });

    it('shows Discarding stage', () => {
      const stage: TurnStage = { Discarding: { player: 'South' } };
      render(<TurnIndicator currentSeat="South" stage={stage} />);

      expect(screen.getByText(/Discarding/i)).toBeInTheDocument();
    });

    it('shows CallWindow stage', () => {
      const stage: TurnStage = {
        CallWindow: {
          tile: 0,
          discarded_by: 'East',
          can_act: ['South', 'West'],
          pending_intents: [],
          timer: 10,
        },
      };
      render(<TurnIndicator currentSeat="South" stage={stage} />);

      expect(screen.getByText(/Call Window/i)).toBeInTheDocument();
    });

    it('shows AwaitingMahjong stage', () => {
      const stage: TurnStage = {
        AwaitingMahjong: {
          caller: 'South',
          tile: 0,
          discarded_by: 'East',
        },
      };
      render(<TurnIndicator currentSeat="South" stage={stage} />);

      expect(screen.getByText(/Awaiting Mahjong/i)).toBeInTheDocument();
    });

    it('does not show stage when null', () => {
      render(<TurnIndicator currentSeat="South" stage={null} />);

      expect(screen.queryByText(/Drawing/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Discarding/i)).not.toBeInTheDocument();
    });
  });

  describe('My Turn Styling', () => {
    it('applies special styling when isMyTurn is true', () => {
      render(<TurnIndicator currentSeat="South" stage={null} isMyTurn={true} />);

      const indicator = screen.getByTestId('turn-indicator-south');
      const badge = indicator.querySelector('[class*="bg-green"]');
      expect(badge).toBeInTheDocument();
    });

    it('applies different styling when isMyTurn is false', () => {
      render(<TurnIndicator currentSeat="South" stage={null} isMyTurn={false} />);

      const indicator = screen.getByTestId('turn-indicator-south');
      const badge = indicator.querySelector('[class*="bg-yellow"]');
      expect(badge).toBeInTheDocument();
    });

    it('defaults to isMyTurn false when not provided', () => {
      render(<TurnIndicator currentSeat="South" stage={null} />);

      const indicator = screen.getByTestId('turn-indicator-south');
      const badge = indicator.querySelector('[class*="bg-yellow"]');
      expect(badge).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has status role and aria-live', () => {
      render(<TurnIndicator currentSeat="South" stage={null} />);

      const indicator = screen.getByTestId('turn-indicator-south');
      expect(indicator).toHaveClass('absolute');
      expect(indicator).not.toHaveClass('fixed');
      expect(indicator).toHaveAttribute('role', 'status');
      expect(indicator).toHaveAttribute('aria-live', 'polite');
    });

    it('includes seat and stage in aria-label', () => {
      const stage: TurnStage = { Drawing: { player: 'South' } };
      render(<TurnIndicator currentSeat="South" stage={stage} />);

      const indicator = screen.getByTestId('turn-indicator-south');
      expect(indicator).toHaveAttribute('aria-label', "South's turn - Drawing");
    });

    it('has aria-label without stage when stage is null', () => {
      render(<TurnIndicator currentSeat="South" stage={null} />);

      const indicator = screen.getByTestId('turn-indicator-south');
      expect(indicator).toHaveAttribute('aria-label', "South's turn");
    });
  });

  describe('Visual Indicators', () => {
    it('includes pulsing dot indicator', () => {
      render(<TurnIndicator currentSeat="South" stage={null} isMyTurn={true} />);

      const indicator = screen.getByTestId('turn-indicator-south');
      const dot = indicator.querySelector('.w-2.h-2.rounded-full');
      expect(dot).toBeInTheDocument();
      expect(dot).toHaveClass('animate-pulse');
    });

    it('has animate-pulse class on badge when isMyTurn', () => {
      render(<TurnIndicator currentSeat="South" stage={null} isMyTurn={true} />);

      const indicator = screen.getByTestId('turn-indicator-south');
      const badge = indicator.querySelector('[class*="animate-pulse"]');
      expect(badge).toBeInTheDocument();
    });
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

    it('removes pulse animation classes when reduced motion is active', () => {
      render(<TurnIndicator currentSeat="South" stage={null} isMyTurn={true} />);

      const indicator = screen.getByTestId('turn-indicator-south');
      expect(indicator.querySelector('[class*="animate-pulse"]')).toBeNull();
    });
  });

  describe('Dead Hand Badges (US-020)', () => {
    it('shows dead hand badge for a dead-hand seat', () => {
      render(<TurnIndicator currentSeat="East" stage={null} deadHandSeats={['South']} />);
      expect(screen.getByTestId('dead-hand-badge-south')).toBeInTheDocument();
      expect(screen.getByTestId('dead-hand-badge-south')).toHaveTextContent('DEAD HAND');
    });
    it('shows dead hand badges for multiple dead-hand seats', () => {
      render(<TurnIndicator currentSeat="East" stage={null} deadHandSeats={['South', 'West']} />);
      expect(screen.getByTestId('dead-hand-badge-south')).toBeInTheDocument();
      expect(screen.getByTestId('dead-hand-badge-west')).toBeInTheDocument();
    });
    it('does not show dead hand badges when deadHandSeats is empty', () => {
      render(<TurnIndicator currentSeat="South" stage={null} deadHandSeats={[]} />);
      expect(screen.queryByTestId('dead-hand-badge-south')).not.toBeInTheDocument();
    });
    it('does not show dead hand badges when prop is omitted', () => {
      render(<TurnIndicator currentSeat="South" stage={null} />);
      expect(screen.queryByTestId(/dead-hand-badge/)).not.toBeInTheDocument();
    });
    it('dead hand badge has aria-label describing the seat', () => {
      render(<TurnIndicator currentSeat="East" stage={null} deadHandSeats={['South']} />);
      const badge = screen.getByTestId('dead-hand-badge-south');
      expect(badge).toHaveClass('absolute');
      expect(badge).not.toHaveClass('fixed');
      expect(badge).toHaveAttribute('aria-label', 'South has a dead hand');
    });
    it('shows dead hand badge alongside turn indicator for same seat', () => {
      render(<TurnIndicator currentSeat="South" stage={null} deadHandSeats={['South']} />);
      expect(screen.getByTestId('turn-indicator-south')).toBeInTheDocument();
      expect(screen.getByTestId('dead-hand-badge-south')).toBeInTheDocument();
    });
  });
});
