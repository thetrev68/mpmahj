/**
 * CallTimer Component Tests
 *
 * Related: US-011 (Call Window & Intent Buffering)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CallTimer } from './CallTimer';

describe('CallTimer', () => {
  it('renders countdown timer', () => {
    render(<CallTimer remainingSeconds={10} durationSeconds={10} />);

    expect(screen.getByText('10s')).toBeInTheDocument();
    expect(screen.getByRole('timer')).toBeInTheDocument();
  });

  it('displays correct remaining time', () => {
    render(<CallTimer remainingSeconds={7} durationSeconds={10} />);

    expect(screen.getByText('7s')).toBeInTheDocument();
  });

  it('shows 0s when time expired', () => {
    render(<CallTimer remainingSeconds={0} durationSeconds={10} />);

    expect(screen.getByText('0s')).toBeInTheDocument();
  });

  it('applies warning style when under 3 seconds', () => {
    render(<CallTimer remainingSeconds={2} durationSeconds={10} />);

    const timerText = screen.getByText('2s');
    expect(timerText).toHaveClass('text-red-500');
  });

  it('applies normal style when 3+ seconds remain', () => {
    render(<CallTimer remainingSeconds={5} durationSeconds={10} />);

    const timerText = screen.getByText('5s');
    expect(timerText).not.toHaveClass('text-red-500');
  });

  it('shows progress bar at correct percentage', () => {
    const { container } = render(<CallTimer remainingSeconds={5} durationSeconds={10} />);

    // 5/10 = 50% remaining
    const progressBar = container.querySelector('[data-testid="timer-progress"]');
    expect(progressBar).toHaveStyle({ width: '50%' });
  });

  it('progress bar is empty when time expired', () => {
    const { container } = render(<CallTimer remainingSeconds={0} durationSeconds={10} />);

    const progressBar = container.querySelector('[data-testid="timer-progress"]');
    expect(progressBar).toHaveStyle({ width: '0%' });
  });

  it('progress bar is full at start', () => {
    const { container } = render(<CallTimer remainingSeconds={10} durationSeconds={10} />);

    const progressBar = container.querySelector('[data-testid="timer-progress"]');
    expect(progressBar).toHaveStyle({ width: '100%' });
  });
});
