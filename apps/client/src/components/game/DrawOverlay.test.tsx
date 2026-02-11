/**
 * DrawOverlay Component Tests (US-021)
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DrawOverlay } from './DrawOverlay';

describe('DrawOverlay', () => {
  it('renders nothing when show=false', () => {
    render(<DrawOverlay show={false} reason="Wall exhausted" onAcknowledge={vi.fn()} />);
    expect(screen.queryByTestId('draw-overlay')).not.toBeInTheDocument();
  });

  describe('wall exhaustion (normal draw)', () => {
    it('renders the overlay when show=true', () => {
      render(<DrawOverlay show={true} reason="Wall exhausted" onAcknowledge={vi.fn()} />);
      expect(screen.getByTestId('draw-overlay')).toBeInTheDocument();
    });

    it('shows "WALL GAME - No Winner" as the title (AC-2)', () => {
      render(<DrawOverlay show={true} reason="Wall exhausted" onAcknowledge={vi.fn()} />);
      expect(screen.getByTestId('draw-overlay-title')).toHaveTextContent('WALL GAME - No Winner');
    });

    it('shows the reason text', () => {
      render(<DrawOverlay show={true} reason="Wall exhausted" onAcknowledge={vi.fn()} />);
      expect(screen.getByText('Wall exhausted')).toBeInTheDocument();
    });

    it('shows remaining tiles count', () => {
      render(
        <DrawOverlay
          show={true}
          reason="Wall exhausted"
          remainingTiles={0}
          onAcknowledge={vi.fn()}
        />
      );
      expect(screen.getByText(/Remaining Tiles: 0/)).toBeInTheDocument();
    });

    it('shows the draw message (AC-2)', () => {
      render(<DrawOverlay show={true} reason="Wall exhausted" onAcknowledge={vi.fn()} />);
      expect(
        screen.getByText(/Wall exhausted with no winner\. Game ends in a draw\./i)
      ).toBeInTheDocument();
    });

    it('shows "Scores remain unchanged" message', () => {
      render(<DrawOverlay show={true} reason="Wall exhausted" onAcknowledge={vi.fn()} />);
      expect(screen.getByText(/Scores remain unchanged/i)).toBeInTheDocument();
    });

    it('has accessible screen reader text mentioning wall exhausted', () => {
      render(
        <DrawOverlay
          show={true}
          reason="Wall exhausted"
          remainingTiles={0}
          onAcknowledge={vi.fn()}
        />
      );
      const srText = screen.getByText(/Wall exhausted\. 0 tiles remaining/i);
      expect(srText).toBeInTheDocument();
    });
  });

  describe('game abandoned (all dead hands)', () => {
    it('shows "GAME ABANDONED" as title for all-dead-hands', () => {
      render(<DrawOverlay show={true} reason="All players dead hands" onAcknowledge={vi.fn()} />);
      expect(screen.getByTestId('draw-overlay-title')).toHaveTextContent('GAME ABANDONED');
    });

    it('shows "All Players Dead Hands" subtitle', () => {
      render(<DrawOverlay show={true} reason="All players dead hands" onAcknowledge={vi.fn()} />);
      expect(screen.getByText('All Players Dead Hands')).toBeInTheDocument();
    });

    it('does not show Remaining Tiles for abandoned game', () => {
      render(<DrawOverlay show={true} reason="All players dead hands" onAcknowledge={vi.fn()} />);
      expect(screen.queryByText(/Remaining Tiles/)).not.toBeInTheDocument();
    });

    it('has accessible screen reader text mentioning game abandoned', () => {
      render(<DrawOverlay show={true} reason="All players dead hands" onAcknowledge={vi.fn()} />);
      const srText = screen.getByText(/Game abandoned\. All players have dead hands/i);
      expect(srText).toBeInTheDocument();
    });
  });

  describe('Continue button', () => {
    it('calls onAcknowledge when Continue is clicked', () => {
      const onAcknowledge = vi.fn();
      render(<DrawOverlay show={true} reason="Wall exhausted" onAcknowledge={onAcknowledge} />);
      fireEvent.click(screen.getByTestId('draw-overlay-continue'));
      expect(onAcknowledge).toHaveBeenCalledOnce();
    });

    it('Continue button has correct aria-label', () => {
      render(<DrawOverlay show={true} reason="Wall exhausted" onAcknowledge={vi.fn()} />);
      const btn = screen.getByTestId('draw-overlay-continue');
      expect(btn).toHaveAttribute('aria-label', 'Continue to final scores');
    });
  });

  describe('accessibility', () => {
    it('has role="dialog" and aria-modal="true"', () => {
      render(<DrawOverlay show={true} reason="Wall exhausted" onAcknowledge={vi.fn()} />);
      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
    });
  });
});
