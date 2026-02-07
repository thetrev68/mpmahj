/**
 * VoteResultOverlay Component Tests
 *
 * Tests for US-005 Charleston Vote Result Display
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { VoteResultOverlay } from './VoteResultOverlay';

describe('VoteResultOverlay', () => {
  describe('AC-10: Vote result display (Stop)', () => {
    it('displays "Charleston STOPPED" when result is Stop', () => {
      render(<VoteResultOverlay result="Stop" onDismiss={vi.fn()} />);

      expect(screen.getByTestId('vote-result-title')).toHaveTextContent('Charleston STOPPED');
    });

    it('displays "Main game starting" message for Stop result', () => {
      render(<VoteResultOverlay result="Stop" onDismiss={vi.fn()} />);

      expect(screen.getByText(/main game starting/i)).toBeInTheDocument();
    });

    it('displays "Charleston STOPPED by vote" breakdown for Stop result', () => {
      render(<VoteResultOverlay result="Stop" onDismiss={vi.fn()} />);

      expect(screen.getByTestId('vote-breakdown-counts')).toHaveTextContent(
        'Charleston STOPPED by vote'
      );
    });

    it('shows user own vote when provided', () => {
      render(<VoteResultOverlay result="Stop" onDismiss={vi.fn()} myVote="Stop" />);

      expect(screen.getByTestId('vote-my-vote')).toHaveTextContent('You voted: Stop');
    });
  });

  describe('AC-10: Vote result display (Continue)', () => {
    it('displays "Charleston CONTINUES" when result is Continue', () => {
      render(<VoteResultOverlay result="Continue" onDismiss={vi.fn()} />);

      expect(screen.getByText(/charleston continues/i)).toBeInTheDocument();
    });

    it('displays "Second Charleston starting" message for Continue result', () => {
      render(<VoteResultOverlay result="Continue" onDismiss={vi.fn()} />);

      expect(screen.getByText(/second charleston starting/i)).toBeInTheDocument();
    });

    it('displays exact breakdown for Continue result (0 Stop, 4 Continue)', () => {
      render(<VoteResultOverlay result="Continue" onDismiss={vi.fn()} totalVoters={4} />);

      expect(screen.getByTestId('vote-breakdown-counts')).toHaveTextContent(
        '0 Stop, 4 Continue'
      );
    });

    it('shows user own vote when provided', () => {
      render(<VoteResultOverlay result="Continue" onDismiss={vi.fn()} myVote="Continue" />);

      expect(screen.getByTestId('vote-my-vote')).toHaveTextContent('You voted: Continue');
    });
  });

  describe('Auto-dismiss behavior', () => {
    it('calls onDismiss after 3 seconds', async () => {
      vi.useFakeTimers();
      const onDismiss = vi.fn();

      render(<VoteResultOverlay result="Stop" onDismiss={onDismiss} />);

      expect(onDismiss).not.toHaveBeenCalled();

      // Fast-forward 3 seconds and run all timers
      await vi.advanceTimersByTimeAsync(3000);

      expect(onDismiss).toHaveBeenCalledTimes(1);

      vi.useRealTimers();
    });

    it('does not call onDismiss before 3 seconds', () => {
      vi.useFakeTimers();
      const onDismiss = vi.fn();

      render(<VoteResultOverlay result="Stop" onDismiss={onDismiss} />);

      // Fast-forward 2.5 seconds (less than 3)
      vi.advanceTimersByTime(2500);

      expect(onDismiss).not.toHaveBeenCalled();

      vi.useRealTimers();
    });
  });

  describe('Accessibility', () => {
    it('has role="alert" for screen readers', () => {
      render(<VoteResultOverlay result="Stop" onDismiss={vi.fn()} />);

      const overlay = screen.getByRole('alert');
      expect(overlay).toBeInTheDocument();
    });

    it('has aria-live="assertive" for immediate announcement', () => {
      render(<VoteResultOverlay result="Stop" onDismiss={vi.fn()} />);

      const overlay = screen.getByRole('alert');
      expect(overlay).toHaveAttribute('aria-live', 'assertive');
    });
  });
});
