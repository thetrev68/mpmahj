import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
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

  it('invokes onMoveChange when range changes', async () => {
    const onMoveChange = vi.fn();
    renderWithProviders(
      <TimelineScrubber currentMove={10} totalMoves={20} onMoveChange={onMoveChange} />
    );

    fireEvent.change(screen.getByRole('slider', { name: /timeline scrubber/i }), {
      target: { value: '12' },
    });
    expect(onMoveChange).toHaveBeenCalledWith(12);
  });
});
