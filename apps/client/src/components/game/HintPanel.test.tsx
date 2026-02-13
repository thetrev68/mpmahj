import { describe, expect, test, vi } from 'vitest';
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
  return renderWithProviders(<HintPanel hint={baseHint} verbosity={verbosity} onClose={vi.fn()} />);
}

describe('HintPanel', () => {
  test('shows reason and patterns for Beginner', () => {
    renderPanel('Beginner');

    expect(screen.getByTestId('hint-discard-reason')).toBeInTheDocument();
    expect(screen.getByTestId('hint-best-patterns')).toBeInTheDocument();
  });

  test('shows reason but hides beginner-only pattern list for Intermediate', () => {
    renderPanel('Intermediate');

    expect(screen.getByTestId('hint-discard-reason')).toBeInTheDocument();
    expect(screen.queryByTestId('hint-best-patterns')).not.toBeInTheDocument();
  });

  test('hides text reason for Expert', () => {
    renderPanel('Expert');

    expect(screen.queryByTestId('hint-discard-reason')).not.toBeInTheDocument();
  });

  test('shows tile and utility score views for all verbosity levels when present', () => {
    renderPanel('Beginner');
    expect(screen.getByTestId('hint-tile-scores')).toBeInTheDocument();
    expect(screen.getByTestId('hint-utility-scores')).toBeInTheDocument();
  });
});
