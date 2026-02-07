/**
 * DrawAnimationLayer Component Tests
 */

import { render, screen, act } from '@testing-library/react';
import { vi, beforeEach, afterEach, describe, it, expect } from 'vitest';
import { DrawAnimationLayer } from './DrawAnimationLayer';
import { TILE_INDICES } from '@/lib/utils/tileUtils';

describe('DrawAnimationLayer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('renders animation layer with animated tile', () => {
      const onComplete = vi.fn();
      render(
        <DrawAnimationLayer
          from={{ x: 100, y: 100 }}
          to={{ x: 500, y: 600 }}
          tile={TILE_INDICES.DOT_START + 4} // Dot 5
          onComplete={onComplete}
        />
      );

      expect(screen.getByTestId('draw-animation-layer')).toBeInTheDocument();
      expect(screen.getByTestId('animated-tile')).toBeInTheDocument();
    });

    it('shows actual tile when tile prop is provided', () => {
      const onComplete = vi.fn();
      render(
        <DrawAnimationLayer
          from={{ x: 100, y: 100 }}
          to={{ x: 500, y: 600 }}
          tile={TILE_INDICES.DOT_START + 4}
          onComplete={onComplete}
        />
      );

      // TileImage should be rendered
      expect(screen.getByAltText(/5 Dot/i)).toBeInTheDocument();
    });

    it('shows face-down tile when tile prop is null', () => {
      const onComplete = vi.fn();
      render(
        <DrawAnimationLayer
          from={{ x: 100, y: 100 }}
          to={{ x: 500, y: 600 }}
          tile={null}
          onComplete={onComplete}
        />
      );

      expect(screen.getByTestId('face-down-tile')).toBeInTheDocument();
      expect(screen.getByLabelText('Face-down tile')).toBeInTheDocument();
    });
  });

  describe('Animation', () => {
    it('applies correct transform based on from/to positions', () => {
      const onComplete = vi.fn();
      render(
        <DrawAnimationLayer
          from={{ x: 100, y: 200 }}
          to={{ x: 500, y: 600 }}
          tile={TILE_INDICES.JOKER}
          onComplete={onComplete}
        />
      );

      const animatedTile = screen.getByTestId('animated-tile');
      expect(animatedTile).toHaveStyle({
        left: '100px',
        top: '200px',
        transform: 'translate(400px, 400px)', // dx=400, dy=400
      });
    });

    it('uses custom duration when provided', () => {
      const onComplete = vi.fn();
      render(
        <DrawAnimationLayer
          from={{ x: 0, y: 0 }}
          to={{ x: 100, y: 100 }}
          tile={TILE_INDICES.JOKER}
          duration={800}
          onComplete={onComplete}
        />
      );

      const animatedTile = screen.getByTestId('animated-tile');
      expect(animatedTile).toHaveStyle({
        transitionDuration: '800ms',
      });
    });

    it('uses default duration of 400ms when not provided', () => {
      const onComplete = vi.fn();
      render(
        <DrawAnimationLayer
          from={{ x: 0, y: 0 }}
          to={{ x: 100, y: 100 }}
          tile={TILE_INDICES.JOKER}
          onComplete={onComplete}
        />
      );

      const animatedTile = screen.getByTestId('animated-tile');
      expect(animatedTile).toHaveStyle({
        transitionDuration: '400ms',
      });
    });
  });

  describe('Completion', () => {
    it('calls onComplete after duration expires', () => {
      const onComplete = vi.fn();
      render(
        <DrawAnimationLayer
          from={{ x: 0, y: 0 }}
          to={{ x: 100, y: 100 }}
          tile={TILE_INDICES.JOKER}
          duration={400}
          onComplete={onComplete}
        />
      );

      expect(onComplete).not.toHaveBeenCalled();

      act(() => {
        vi.advanceTimersByTime(400);
      });

      expect(onComplete).toHaveBeenCalledTimes(1);
    });

    it('removes animation layer after completion', () => {
      const onComplete = vi.fn();
      const { rerender } = render(
        <DrawAnimationLayer
          from={{ x: 0, y: 0 }}
          to={{ x: 100, y: 100 }}
          tile={TILE_INDICES.JOKER}
          duration={400}
          onComplete={onComplete}
        />
      );

      expect(screen.getByTestId('draw-animation-layer')).toBeInTheDocument();

      act(() => {
        vi.advanceTimersByTime(400);
      });

      rerender(
        <DrawAnimationLayer
          from={{ x: 0, y: 0 }}
          to={{ x: 100, y: 100 }}
          tile={TILE_INDICES.JOKER}
          duration={400}
          onComplete={onComplete}
        />
      );

      expect(screen.queryByTestId('draw-animation-layer')).not.toBeInTheDocument();
    });

    it('cleans up timer on unmount', () => {
      const onComplete = vi.fn();
      const { unmount } = render(
        <DrawAnimationLayer
          from={{ x: 0, y: 0 }}
          to={{ x: 100, y: 100 }}
          tile={TILE_INDICES.JOKER}
          duration={400}
          onComplete={onComplete}
        />
      );

      unmount();

      act(() => {
        vi.advanceTimersByTime(400);
      });

      expect(onComplete).not.toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('has presentation role and aria-hidden', () => {
      const onComplete = vi.fn();
      render(
        <DrawAnimationLayer
          from={{ x: 0, y: 0 }}
          to={{ x: 100, y: 100 }}
          tile={TILE_INDICES.JOKER}
          onComplete={onComplete}
        />
      );

      const layer = screen.getByTestId('draw-animation-layer');
      expect(layer).toHaveAttribute('role', 'presentation');
      expect(layer).toHaveAttribute('aria-hidden', 'true');
    });

    it('is not interactive (pointer-events-none)', () => {
      const onComplete = vi.fn();
      render(
        <DrawAnimationLayer
          from={{ x: 0, y: 0 }}
          to={{ x: 100, y: 100 }}
          tile={TILE_INDICES.JOKER}
          onComplete={onComplete}
        />
      );

      const layer = screen.getByTestId('draw-animation-layer');
      expect(layer).toHaveClass('pointer-events-none');
    });
  });
});
