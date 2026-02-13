import { describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '@/test/test-utils';
import { TimelineScrubber } from './TimelineScrubber';

describe('TimelineScrubber', () => {
  it('renders current and total move labels', () => {
    renderWithProviders(
      <TimelineScrubber currentMove={42} totalMoves={87} onMoveChange={vi.fn()} />
    );
    expect(screen.getByTestId('timeline-scrubber')).toBeInTheDocument();
    expect(screen.getByText(/Move #42 \/ #87/i)).toBeInTheDocument();
  });

  it('invokes onMoveChange when ArrowRight is pressed on the slider', async () => {
    const user = userEvent.setup();
    const onMoveChange = vi.fn();
    renderWithProviders(
      <TimelineScrubber currentMove={10} totalMoves={20} onMoveChange={onMoveChange} />
    );

    const slider = screen.getByRole('slider', { name: /timeline scrubber/i });
    slider.focus();
    await user.keyboard('{ArrowRight}');
    expect(onMoveChange).toHaveBeenCalledWith(11);
  });
});
