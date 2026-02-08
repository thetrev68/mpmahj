/**
 * @vitest-environment jsdom
 */

/**
 * VoteResultOverlay Component Tests
 *
 * Tests for US-005 Charleston Vote Result Display
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { VoteResultOverlay } from './VoteResultOverlay';
import type { Seat } from '@/types/bindings/generated/Seat';
import type { CharlestonVote } from '@/types/bindings/generated/CharlestonVote';

afterEach(() => {
  cleanup();
});

describe('VoteResultOverlay', () => {
  describe('AC-10: Vote result display (Stop)', () => {
    it('displays "Charleston STOPPED" when result is Stop', () => {
      render(<VoteResultOverlay result="Stop" onDismiss={vi.fn()} />);

      expect(screen.getByTestId('vote-result-title').textContent).toContain('Charleston STOPPED');
    });

    it('displays "Main game starting" message for Stop result', () => {
      render(<VoteResultOverlay result="Stop" onDismiss={vi.fn()} />);

      expect(screen.getByText(/main game starting/i)).toBeTruthy();
    });

    it('displays exact breakdown when votes are provided', () => {
      const votes: Record<Seat, CharlestonVote> = {
        East: 'Stop',
        South: 'Continue',
        West: 'Stop',
        North: 'Stop',
      };
      render(<VoteResultOverlay result="Stop" onDismiss={vi.fn()} votes={votes} />);

      expect(screen.getByTestId('vote-breakdown-counts').textContent).toContain(
        '3 Stop, 1 Continue'
      );
      expect(screen.getByText(/East:/)).toBeTruthy();
      expect(screen.getByText(/South:/)).toBeTruthy();
      const breakdownText = screen.getByTestId('vote-breakdown').textContent ?? '';
      expect(breakdownText.indexOf('East:')).toBeLessThan(breakdownText.indexOf('South:'));
      expect(breakdownText.indexOf('South:')).toBeLessThan(breakdownText.indexOf('West:'));
      expect(breakdownText.indexOf('West:')).toBeLessThan(breakdownText.indexOf('North:'));
    });

    it('shows user own vote when votes breakdown is missing', () => {
      render(<VoteResultOverlay result="Stop" onDismiss={vi.fn()} myVote="Stop" />);

      expect(screen.getByTestId('vote-breakdown-unavailable').textContent).toContain(
        'Vote breakdown unavailable'
      );
      expect(screen.getByTestId('vote-my-vote').textContent).toContain('You voted: Stop');
    });
  });

  describe('AC-10: Vote result display (Continue)', () => {
    it('displays "Charleston CONTINUES" when result is Continue', () => {
      render(<VoteResultOverlay result="Continue" onDismiss={vi.fn()} />);

      expect(screen.getByText(/charleston continues/i)).toBeTruthy();
    });

    it('displays "Second Charleston starting" message for Continue result', () => {
      render(<VoteResultOverlay result="Continue" onDismiss={vi.fn()} />);

      expect(screen.getByText(/second charleston starting/i)).toBeTruthy();
    });

    it('displays exact breakdown for Continue result (0 Stop, 4 Continue)', () => {
      const votes: Record<Seat, CharlestonVote> = {
        East: 'Continue',
        South: 'Continue',
        West: 'Continue',
        North: 'Continue',
      };
      render(<VoteResultOverlay result="Continue" onDismiss={vi.fn()} votes={votes} />);

      expect(screen.getByTestId('vote-breakdown-counts').textContent).toContain(
        '0 Stop, 4 Continue'
      );
    });

    it('shows user own vote when provided', () => {
      render(<VoteResultOverlay result="Continue" onDismiss={vi.fn()} myVote="Continue" />);

      expect(screen.getByTestId('vote-my-vote').textContent).toContain('You voted: Continue');
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
      expect(overlay).toBeTruthy();
    });

    it('has aria-live="assertive" for immediate announcement', () => {
      render(<VoteResultOverlay result="Stop" onDismiss={vi.fn()} />);

      const overlay = screen.getByRole('alert');
      expect(overlay.getAttribute('aria-live')).toBe('assertive');
    });
  });
});
