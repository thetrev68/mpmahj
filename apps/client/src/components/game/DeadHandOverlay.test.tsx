/**
 * DeadHandOverlay Component Tests
 *
 * Tests the penalty overlay shown when a player's Mahjong is declared invalid.
 *
 * Related: US-020 (Invalid Mahjong → Dead Hand), AC-2
 */

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { DeadHandOverlay } from './DeadHandOverlay';

describe('DeadHandOverlay', () => {
  const defaultProps = {
    show: true,
    player: 'South' as const,
    reason: 'Invalid Mahjong claim',
    onAcknowledge: vi.fn(),
  };

  describe('Visibility', () => {
    it('renders when show is true', () => {
      render(<DeadHandOverlay {...defaultProps} />);
      expect(screen.getByTestId('dead-hand-overlay')).toBeInTheDocument();
    });

    it('does not render when show is false', () => {
      render(<DeadHandOverlay {...defaultProps} show={false} />);
      expect(screen.queryByTestId('dead-hand-overlay')).not.toBeInTheDocument();
    });
  });

  describe('Content', () => {
    it('shows DEAD HAND PENALTY title', () => {
      render(<DeadHandOverlay {...defaultProps} />);
      expect(screen.getByTestId('dead-hand-title')).toHaveTextContent('DEAD HAND PENALTY');
    });

    it('shows DEAD HAND badge', () => {
      render(<DeadHandOverlay {...defaultProps} />);
      expect(screen.getByTestId('dead-hand-badge')).toHaveTextContent('DEAD HAND');
    });

    it('displays the player seat', () => {
      render(<DeadHandOverlay {...defaultProps} player="East" />);
      expect(screen.getByText('East')).toBeInTheDocument();
    });

    it('displays the reason', () => {
      render(<DeadHandOverlay {...defaultProps} reason="Invalid Mahjong claim" />);
      expect(screen.getByText('Invalid Mahjong claim')).toBeInTheDocument();
    });

    it('displays all four consequences', () => {
      render(<DeadHandOverlay {...defaultProps} />);
      // Use getAllByText since sr-only also contains similar text
      expect(screen.getAllByText(/Your hand is revealed to all players/).length).toBeGreaterThan(0);
      expect(screen.getByText(/You cannot declare Mahjong/)).toBeInTheDocument();
      expect(screen.getByText(/You cannot call discards/)).toBeInTheDocument();
      expect(screen.getByText(/You must continue playing/)).toBeInTheDocument();
    });
  });

  describe('Revealed Hand', () => {
    it('shows revealed hand when provided', () => {
      // Tiles: 1 Bam (0), 5 Crack (13), 9 Dot (26)
      render(<DeadHandOverlay {...defaultProps} revealedHand={[0, 13, 26]} />);
      const revealedHand = screen.getByTestId('revealed-hand');
      expect(revealedHand).toBeInTheDocument();
      expect(revealedHand).toHaveTextContent('1 Bam');
      expect(revealedHand).toHaveTextContent('5 Crack');
      expect(revealedHand).toHaveTextContent('9 Dot');
    });

    it('does not show revealed hand section when not provided', () => {
      render(<DeadHandOverlay {...defaultProps} />);
      expect(screen.queryByTestId('revealed-hand')).not.toBeInTheDocument();
    });

    it('does not show revealed hand section when empty', () => {
      render(<DeadHandOverlay {...defaultProps} revealedHand={[]} />);
      expect(screen.queryByTestId('revealed-hand')).not.toBeInTheDocument();
    });
  });

  describe('Acknowledge Button', () => {
    it('renders acknowledge button', () => {
      render(<DeadHandOverlay {...defaultProps} />);
      expect(screen.getByTestId('dead-hand-acknowledge')).toBeInTheDocument();
    });

    it('calls onAcknowledge when clicked', async () => {
      const onAcknowledge = vi.fn();
      const user = userEvent.setup();
      render(<DeadHandOverlay {...defaultProps} onAcknowledge={onAcknowledge} />);

      await user.click(screen.getByTestId('dead-hand-acknowledge'));

      expect(onAcknowledge).toHaveBeenCalledOnce();
    });
  });

  describe('Accessibility', () => {
    it('has dialog role and aria-modal', () => {
      render(<DeadHandOverlay {...defaultProps} />);
      const overlay = screen.getByTestId('dead-hand-overlay');
      expect(overlay).toHaveAttribute('role', 'dialog');
      expect(overlay).toHaveAttribute('aria-modal', 'true');
    });

    it('has descriptive aria-label', () => {
      render(<DeadHandOverlay {...defaultProps} />);
      const overlay = screen.getByTestId('dead-hand-overlay');
      expect(overlay).toHaveAttribute('aria-label', 'Dead Hand Penalty');
    });

    it('acknowledge button has aria-label', () => {
      render(<DeadHandOverlay {...defaultProps} />);
      expect(screen.getByTestId('dead-hand-acknowledge')).toHaveAttribute(
        'aria-label',
        'Acknowledge dead hand penalty'
      );
    });
  });
});
