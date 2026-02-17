import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Wall } from './Wall';

describe('Wall', () => {
  it('renders the configured number of stacks', () => {
    render(<Wall position="north" stackCount={12} initialStacks={18} />);
    expect(screen.getAllByTestId('wall-stack')).toHaveLength(12);
  });

  it('renders wall progress percentage from current and initial stacks', () => {
    render(<Wall position="south" stackCount={10} initialStacks={20} />);
    expect(screen.getByTestId('wall-progress-indicator')).toHaveTextContent('50%');
  });

  it('clamps progress to 100 percent when stackCount exceeds initialStacks', () => {
    render(<Wall position="east" stackCount={22} initialStacks={20} />);
    expect(screen.getByTestId('wall-progress-indicator')).toHaveTextContent('100%');
  });

  it('shows 0 percent progress when initialStacks is zero', () => {
    render(<Wall position="west" stackCount={5} initialStacks={0} />);
    expect(screen.getByTestId('wall-progress-indicator')).toHaveTextContent('0%');
  });

  it('renders break and draw markers at expected positions', () => {
    render(<Wall position="east" stackCount={8} initialStacks={20} breakIndex={4} drawIndex={6} />);
    expect(screen.getByTestId('wall-break-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('wall-draw-marker')).toBeInTheDocument();
  });

  it('includes progress in the wall region aria-label', () => {
    render(<Wall position="north" stackCount={15} initialStacks={20} />);
    expect(screen.getByTestId('wall-north')).toHaveAttribute(
      'aria-label',
      'north wall, 15 stacks remaining, 75% remaining'
    );
  });
});
