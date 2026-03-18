import { describe, expect, test } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { HintPanel } from './HintPanel';
import type { HintData } from '@/types/bindings/generated/HintData';

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

function renderPanel() {
  return renderWithProviders(<HintPanel hint={baseHint} />);
}

describe('HintPanel', () => {
  test('renders discard guidance and top pattern guidance together', () => {
    renderPanel();

    expect(screen.getByTestId('hint-recommended-discard')).toHaveTextContent('2 Crack');
    expect(screen.getByTestId('hint-best-patterns')).toBeInTheDocument();
    expect(screen.getByText('Patterns to play for')).toBeInTheDocument();
    expect(screen.getByText('Consecutive Run')).toBeInTheDocument();
    expect(screen.getByText('30 pts')).toBeInTheDocument();
    expect(screen.getByText('Distance 3')).toBeInTheDocument();
    expect(screen.getByText('Win chance 62%')).toBeInTheDocument();
  });

  test('does not render a close button or fixed positioning classes', () => {
    renderPanel();

    expect(screen.queryByTestId('close-hint-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('hint-panel')).not.toHaveClass('fixed');
    expect(screen.getByTestId('hint-panel')).not.toHaveClass('left-6');
    expect(screen.getByTestId('hint-panel')).not.toHaveClass('top-20');
  });

  test('uses theme-aware tokens instead of hardcoded dark palette classes', () => {
    renderPanel();

    expect(screen.getByTestId('hint-panel')).toHaveClass(
      'border',
      'bg-card/90',
      'text-card-foreground'
    );
    expect(screen.getByTestId('hint-panel')).not.toHaveClass(
      'border-cyan-400/50',
      'bg-slate-950/95',
      'text-slate-100'
    );
    expect(screen.getByText('Recommended discard')).toHaveClass('text-muted-foreground');
    expect(screen.getByTestId('hint-recommended-discard')).toHaveClass('text-primary');
    expect(screen.getByText('Tile scores')).toHaveClass('text-muted-foreground');
    expect(screen.getByText('Patterns to play for')).toHaveClass('text-muted-foreground');
    expect(screen.getByText('Utility scores')).toHaveClass('text-muted-foreground');
  });

  test('shows tile and utility score views for all verbosity levels when present', () => {
    renderPanel();
    expect(screen.getByTestId('hint-tile-scores')).toBeInTheDocument();
    expect(screen.getByTestId('hint-utility-scores')).toBeInTheDocument();
  });

  test('renders a coherent partial result when patterns exist without a discard recommendation', () => {
    renderWithProviders(
      <HintPanel
        hint={{
          ...baseHint,
          recommended_discard: null,
        }}
      />
    );

    expect(screen.getByTestId('hint-recommended-discard')).toHaveTextContent(
      'No discard recommendation'
    );
    expect(screen.getByTestId('hint-best-patterns')).toBeInTheDocument();
  });

  test('omits the pattern section entirely when best_patterns is empty', () => {
    renderWithProviders(
      <HintPanel
        hint={{
          ...baseHint,
          best_patterns: [],
        }}
      />
    );

    expect(screen.queryByTestId('hint-best-patterns')).not.toBeInTheDocument();
    expect(screen.queryByText('Patterns to play for')).not.toBeInTheDocument();
  });

  test('keeps duplicate pattern names distinguishable and formats small probabilities legibly', () => {
    renderWithProviders(
      <HintPanel
        hint={{
          ...baseHint,
          best_patterns: [
            {
              pattern_id: 'p1',
              variation_id: 'var-a',
              pattern_name: '2468',
              probability: 0.0062,
              score: 25.125,
              distance: 4,
            },
            {
              pattern_id: 'p2',
              variation_id: 'var-b',
              pattern_name: '2468',
              probability: 0.042,
              score: 25.5,
              distance: 3,
            },
          ],
        }}
      />
    );

    expect(screen.getAllByText('2468')).toHaveLength(2);
    expect(screen.getByText('var-a')).toBeInTheDocument();
    expect(screen.getByText('var-b')).toBeInTheDocument();
    expect(screen.getByText('Win chance 0.62%')).toBeInTheDocument();
    expect(screen.getByText('25.13 pts')).toBeInTheDocument();
  });
});
