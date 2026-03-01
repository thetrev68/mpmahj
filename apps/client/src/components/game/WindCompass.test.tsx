/**
 * WindCompass Component Tests
 *
 * Tests for the persistent seat-orientation HUD that replaces the scattered
 * active-seat badge approach.
 */

import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { WindCompass } from './WindCompass';
import type { TurnStage } from '@/types/bindings/generated/TurnStage';

function getDirectChildByClass(container: HTMLElement, className: string): HTMLElement {
  const match = Array.from(container.children).find((child) => child.classList.contains(className));
  if (!match) {
    throw new Error(`Expected child with class "${className}"`);
  }
  return match as HTMLElement;
}

describe('WindCompass', () => {
  // ===========================================================================
  // Rendering
  // ===========================================================================

  describe('Basic rendering', () => {
    it('renders the compass region', () => {
      render(<WindCompass yourSeat="South" activeSeat="East" />);
      expect(screen.getByRole('region', { name: /seat orientation compass/i })).toBeInTheDocument();
      expect(screen.getByTestId('wind-compass')).toBeInTheDocument();
    });

    it('renders a node for each of the four seats', () => {
      render(<WindCompass yourSeat="South" activeSeat="East" />);
      expect(screen.getByTestId('compass-seat-east')).toBeInTheDocument();
      expect(screen.getByTestId('compass-seat-south')).toBeInTheDocument();
      expect(screen.getByTestId('compass-seat-west')).toBeInTheDocument();
      expect(screen.getByTestId('compass-seat-north')).toBeInTheDocument();
    });

    it('displays wind letters E / S / W / N', () => {
      render(<WindCompass yourSeat="South" activeSeat="East" />);
      expect(screen.getByText('E')).toBeInTheDocument();
      expect(screen.getByText('S')).toBeInTheDocument();
      expect(screen.getByText('W')).toBeInTheDocument();
      expect(screen.getByText('N')).toBeInTheDocument();
    });
  });

  describe('Visual layout updates (VR-017)', () => {
    it('uses the updated compass size, background, and node offsets', () => {
      render(<WindCompass yourSeat="South" activeSeat="East" />);

      const compass = screen.getByTestId('wind-compass');
      expect(compass).not.toHaveClass('w-28');
      expect(compass).toHaveClass('w-32', 'h-32');

      const background = getDirectChildByClass(compass, 'bg-green-950/90');
      const horizontalLine = getDirectChildByClass(compass, 'left-7');
      const verticalLine = getDirectChildByClass(compass, 'w-px');
      const centerDot = getDirectChildByClass(compass, 'w-1.5');

      expect(background).toHaveClass(
        'absolute',
        'inset-0',
        'rounded-full',
        'bg-green-950/90',
        'border',
        'border-gray-600/60',
        'backdrop-blur-sm'
      );
      expect(horizontalLine).toHaveClass(
        'absolute',
        'top-1/2',
        'left-7',
        'right-7',
        'h-px',
        'bg-gray-600/40',
        '-translate-y-1/2'
      );
      expect(verticalLine).toHaveClass(
        'absolute',
        'left-1/2',
        'top-7',
        'bottom-7',
        'w-px',
        'bg-gray-600/40',
        '-translate-x-1/2'
      );
      expect(centerDot).toHaveClass(
        'absolute',
        'top-1/2',
        'left-1/2',
        '-translate-x-1/2',
        '-translate-y-1/2',
        'w-1.5',
        'h-1.5',
        'rounded-full',
        'bg-gray-500'
      );

      expect(screen.getByTestId('compass-seat-east')).toHaveClass(
        'absolute',
        'flex',
        'items-center',
        'justify-center',
        'right-1.5',
        'top-1/2',
        '-translate-y-1/2'
      );
      expect(screen.getByTestId('compass-seat-south')).toHaveClass(
        'absolute',
        'flex',
        'items-center',
        'justify-center',
        'bottom-1.5',
        'left-1/2',
        '-translate-x-1/2'
      );
      expect(screen.getByTestId('compass-seat-west')).toHaveClass(
        'absolute',
        'flex',
        'items-center',
        'justify-center',
        'left-1.5',
        'top-1/2',
        '-translate-y-1/2'
      );
      expect(screen.getByTestId('compass-seat-north')).toHaveClass(
        'absolute',
        'flex',
        'items-center',
        'justify-center',
        'top-1.5',
        'left-1/2',
        '-translate-x-1/2'
      );
    });
  });

  // ===========================================================================
  // Active seat
  // ===========================================================================

  describe('Active seat indicator', () => {
    it('marks the active seat node with role=status and aria-live', () => {
      render(<WindCompass yourSeat="South" activeSeat="East" />);
      const eastNode = screen.getByTestId('compass-seat-east');
      const badge = within(eastNode).getByRole('status');
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute('aria-live', 'polite');
      expect(badge).toHaveClass('tracking-wide');
    });

    it('includes seat name and "turn" in the accessible label for the active seat', () => {
      render(<WindCompass yourSeat="South" activeSeat="East" />);
      expect(screen.getByRole('status', { name: /East's turn/i })).toBeInTheDocument();
    });

    it('appends stage name to the active seat label when stage is present', () => {
      const stage = { Drawing: { player: 'East' as const } };
      render(<WindCompass yourSeat="South" activeSeat="East" stage={stage} />);
      expect(screen.getByRole('status', { name: /East's turn - Drawing/i })).toBeInTheDocument();
    });

    it('uses "Discarding" stage name', () => {
      const stage = { Discarding: { player: 'West' as const } };
      render(<WindCompass yourSeat="South" activeSeat="West" stage={stage} />);
      expect(screen.getByRole('status', { name: /West's turn - Discarding/i })).toBeInTheDocument();
    });

    it('uses "Call Window" stage name', () => {
      const stage: TurnStage = {
        CallWindow: {
          tile: 1,
          discarded_by: 'East',
          can_act: ['South', 'West', 'North'],
          pending_intents: [],
          timer: 30000,
        },
      };
      render(<WindCompass yourSeat="South" activeSeat="East" stage={stage} />);
      expect(
        screen.getByRole('status', { name: /East's turn - Call Window/i })
      ).toBeInTheDocument();
    });

    it('does not assign role=status to inactive seats', () => {
      render(<WindCompass yourSeat="South" activeSeat="East" />);
      const southNode = screen.getByTestId('compass-seat-south');
      expect(within(southNode).queryByRole('status')).not.toBeInTheDocument();
    });
  });

  // ===========================================================================
  // "You" indicator
  // ===========================================================================

  describe('"You" seat highlighting', () => {
    it('labels your seat node with "(You)" in the accessible label', () => {
      render(<WindCompass yourSeat="South" activeSeat="East" />);
      // South is inactive (East is active), so label includes "(You)"
      const southBadge = within(screen.getByTestId('compass-seat-south')).getByLabelText(
        /South \(You\)/i
      );
      expect(southBadge).toBeInTheDocument();
    });

    it('labels the active "you" seat with "turn" instead of "(You)"', () => {
      render(<WindCompass yourSeat="East" activeSeat="East" />);
      // When you are active, the label shows "East's turn"
      expect(screen.getByRole('status', { name: /East's turn/i })).toBeInTheDocument();
    });

    it('works for any seat as yourSeat', () => {
      for (const seat of ['East', 'South', 'West', 'North'] as const) {
        const { unmount } = render(<WindCompass yourSeat={seat} activeSeat="North" />);
        if (seat !== 'North') {
          const node = screen.getByTestId(`compass-seat-${seat.toLowerCase()}`);
          expect(
            within(node).getByLabelText(new RegExp(`${seat} \\(You\\)`, 'i'))
          ).toBeInTheDocument();
        }
        unmount();
      }
    });
  });

  // ===========================================================================
  // Dead hand
  // ===========================================================================

  describe('Dead hand badges (US-020)', () => {
    it('renders no dead hand indicators by default', () => {
      render(<WindCompass yourSeat="South" activeSeat="East" />);
      expect(screen.queryByLabelText(/Dead Hand/i)).not.toBeInTheDocument();
    });

    it('labels a dead hand seat with "Dead Hand" in its accessible label', () => {
      render(<WindCompass yourSeat="South" activeSeat="East" deadHandSeats={['West']} />);
      expect(screen.getByLabelText(/West.*Dead Hand/i)).toBeInTheDocument();
    });

    it('supports multiple dead hand seats', () => {
      render(<WindCompass yourSeat="South" activeSeat="East" deadHandSeats={['West', 'North']} />);
      expect(screen.getByLabelText(/West.*Dead Hand/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/North.*Dead Hand/i)).toBeInTheDocument();
    });

    it('accepts an empty dead hand array', () => {
      render(<WindCompass yourSeat="South" activeSeat="East" deadHandSeats={[]} />);
      expect(screen.queryByLabelText(/Dead Hand/i)).not.toBeInTheDocument();
    });
  });
});
