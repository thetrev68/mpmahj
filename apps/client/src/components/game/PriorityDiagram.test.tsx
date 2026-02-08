/**
 * PriorityDiagram Component Tests
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PriorityDiagram } from './PriorityDiagram';

describe('PriorityDiagram', () => {
  it('renders discarder and priority order clockwise', () => {
    render(<PriorityDiagram discardedBy="East" winner="South" />);

    expect(screen.getByTestId('priority-diagram')).toBeInTheDocument();
    expect(screen.getByTestId('priority-discarder')).toHaveTextContent('East');
    expect(screen.getByTestId('priority-seat-south')).toBeInTheDocument();
    expect(screen.getByTestId('priority-seat-west')).toBeInTheDocument();
    expect(screen.getByTestId('priority-seat-north')).toBeInTheDocument();
  });

  it('marks the winning seat', () => {
    render(<PriorityDiagram discardedBy="North" winner="East" />);

    const winnerBadge = screen.getByTestId('priority-seat-east');
    expect(winnerBadge).toHaveAttribute('data-winner', 'true');
    expect(winnerBadge).toHaveTextContent('East (winner)');
  });

  it('renders contenders when provided', () => {
    render(<PriorityDiagram discardedBy="East" winner="South" contenders={['South', 'West']} />);

    const contenders = screen.getByTestId('priority-contenders');
    expect(contenders).toHaveTextContent('Contenders: South, West');
  });
});
