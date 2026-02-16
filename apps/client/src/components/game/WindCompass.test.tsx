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
