import { describe, expect, test } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { HintPanel } from './HintPanel';
import type { HintData } from '@/types/bindings/generated/HintData';
import type { HintVerbosity } from '@/types/bindings/generated/HintVerbosity';

const baseHint: HintData = {
  recommended_discard: 10,
  discard_reason: 'Keeps more pattern options open',
  best_patterns: [
    {
      pattern_id: 'p1',
      variation_id: 'v1',
      pattern_name: 'Consecutive Run',
      probability: 0.62,
      score: 30,
      distance: 3,
    },
  ],
  tiles_needed_for_win: [],
  distance_to_win: 3,
  hot_hand: false,
  call_opportunities: [],
  defensive_hints: [],
  charleston_pass_recommendations: [],
  tile_scores: { 10: 2.2, 11: 1.4 },
  utility_scores: { 10: 0.8, 12: 0.3 },
};

function renderPanel(verbosity: HintVerbosity) {
  return renderWithProviders(<HintPanel hint={baseHint} verbosity={verbosity} />);
}

describe('HintPanel', () => {
  test('shows patterns for Beginner without a discard reason section', () => {
    renderPanel('Beginner');

    expect(screen.queryByTestId('hint-discard-reason')).not.toBeInTheDocument();
    expect(screen.getByTestId('hint-best-patterns')).toBeInTheDocument();
  });

  test('hides beginner-only pattern list for Intermediate and keeps reason removed', () => {
    renderPanel('Intermediate');

    expect(screen.queryByTestId('hint-discard-reason')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hint-best-patterns')).not.toBeInTheDocument();
  });

  test('does not render a discard reason for Expert', () => {
    renderPanel('Expert');

    expect(screen.queryByTestId('hint-discard-reason')).not.toBeInTheDocument();
  });

  test('does not render a close button or fixed positioning classes', () => {
    renderPanel('Beginner');

    expect(screen.queryByTestId('close-hint-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('hint-panel')).not.toHaveClass('fixed');
    expect(screen.getByTestId('hint-panel')).not.toHaveClass('left-6');
    expect(screen.getByTestId('hint-panel')).not.toHaveClass('top-20');
  });

  test('shows tile and utility score views for all verbosity levels when present', () => {
    renderPanel('Beginner');
    expect(screen.getByTestId('hint-tile-scores')).toBeInTheDocument();
    expect(screen.getByTestId('hint-utility-scores')).toBeInTheDocument();
  });
});
