import { describe, expect, test } from 'vitest';
import { renderWithProviders, screen, within } from '@/test/test-utils';
import { fixtures } from '@/test/fixtures';
import { HintPanel } from './HintPanel';
import type { HintData } from '@/types/bindings/generated/HintData';

const { baseHint, charlestonHint } = fixtures.hintData;

describe('HintPanel', () => {
  // --- AC-1: Recommended Pass renders tile visuals ---
  test('AC-1: renders tile visuals for charleston pass recommendations', () => {
    renderWithProviders(<HintPanel hint={charlestonHint} />);

    const passSection = screen.getByTestId('hint-charleston-pass-recommendations');
    expect(passSection).toBeInTheDocument();
    expect(screen.getByTestId('hint-pass-tiles')).toBeInTheDocument();
    expect(screen.getByTestId('hint-pass-tile-0')).toBeInTheDocument();
    expect(screen.getByTestId('hint-pass-tile-1')).toBeInTheDocument();
    expect(screen.getByTestId('hint-pass-tile-2')).toBeInTheDocument();
  });

  // --- AC-3: Patterns render compact tile sequences ---
  test('AC-3: renders tile sequences in pattern cards', () => {
    renderWithProviders(<HintPanel hint={baseHint} />);

    expect(screen.getByTestId('hint-pattern-tiles-0')).toBeInTheDocument();
    // baseHint has 14 tiles in pattern_tiles
    expect(screen.getByTestId('hint-pattern-0-tile-0')).toBeInTheDocument();
    expect(screen.getByTestId('hint-pattern-0-tile-13')).toBeInTheDocument();
  });

  // --- AC-4: Each pattern entry includes point value, key, exposure marker, distance, win chance ---
  test('AC-4: pattern entry shows all required metadata', () => {
    renderWithProviders(<HintPanel hint={baseHint} />);

    const pattern = screen.getByTestId('hint-best-pattern-0');
    expect(within(pattern).getByText('Consecutive Run')).toBeInTheDocument();
    expect(within(pattern).getByText('30 pts')).toBeInTheDocument();
    expect(within(pattern).getByText(baseHint.best_patterns[0].variation_id)).toBeInTheDocument();
    expect(within(pattern).getByText('X')).toBeInTheDocument(); // exposed marker
    expect(within(pattern).getByText('Distance 3')).toBeInTheDocument();
    expect(within(pattern).getByText('Win chance 62%')).toBeInTheDocument();
  });

  test('AC-4: concealed pattern shows C marker', () => {
    const concealedHint: HintData = {
      ...baseHint,
      best_patterns: [
        {
          ...baseHint.best_patterns[0],
          concealed: true,
        },
      ],
    };
    renderWithProviders(<HintPanel hint={concealedHint} />);

    const pattern = screen.getByTestId('hint-best-pattern-0');
    expect(within(pattern).getByText('C')).toBeInTheDocument();
  });

  // --- AC-6: tile_scores and utility_scores removed from player-facing panel ---
  test('AC-6: does not render tile_scores or utility_scores sections', () => {
    renderWithProviders(<HintPanel hint={baseHint} />);

    expect(screen.queryByTestId('hint-tile-scores')).not.toBeInTheDocument();
    expect(screen.queryByTestId('hint-utility-scores')).not.toBeInTheDocument();
    expect(screen.queryByText('Tile scores')).not.toBeInTheDocument();
    expect(screen.queryByText('Utility scores')).not.toBeInTheDocument();
  });

  // --- AC-5: tile visuals are small but readable (class-based check) ---
  test('AC-5: pattern tile visuals use compact sizing', () => {
    renderWithProviders(<HintPanel hint={baseHint} />);

    const tile = screen.getByTestId('hint-pattern-0-tile-0');
    expect(tile).toHaveClass('h-5', 'w-4');
  });

  // --- AC-7: panel hierarchy favors recommendations and patterns ---
  test('AC-7: panel hierarchy shows recommendation then patterns, no technical internals', () => {
    renderWithProviders(<HintPanel hint={baseHint} />);

    expect(screen.getByText('Current Recommendation')).toBeInTheDocument();
    expect(screen.getByText('Recommended discard')).toBeInTheDocument();
    expect(screen.getByTestId('hint-best-patterns')).toBeInTheDocument();
    expect(screen.queryByText('Tile scores')).not.toBeInTheDocument();
    expect(screen.queryByText('Utility scores')).not.toBeInTheDocument();
  });

  // --- EC-1: Duplicate pattern names distinguishable via key identifier ---
  test('EC-1: duplicate pattern names show variant labels', () => {
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
              score: 25,
              distance: 4,
              pattern_tiles: [1, 3, 5, 7],
              concealed: false,
            },
            {
              pattern_id: 'p2',
              variation_id: 'var-b',
              pattern_name: '2468',
              probability: 0.042,
              score: 25,
              distance: 3,
              pattern_tiles: [2, 4, 6, 8],
              concealed: false,
            },
          ],
        }}
      />
    );

    expect(screen.getAllByText('2468')).toHaveLength(2);
    expect(screen.getByText('var-a')).toBeInTheDocument();
    expect(screen.getByText('var-b')).toBeInTheDocument();
  });

  test('EC-1: unique pattern names still show a key identifier', () => {
    renderWithProviders(
      <HintPanel
        hint={{
          ...baseHint,
          best_patterns: [
            {
              pattern_id: '2025-UNIQUE-001',
              variation_id: '2025-GRP1-H1-VAR7',
              pattern_name: 'Unique Pattern',
              probability: 0.25,
              score: 40,
              distance: 1,
              pattern_tiles: [1, 1, 1],
              concealed: false,
            },
          ],
        }}
      />
    );

    const pattern = screen.getByTestId('hint-best-pattern-0');
    expect(within(pattern).getByText('Unique Pattern')).toBeInTheDocument();
    expect(within(pattern).getByText('2025-GRP1-H1-VAR7')).toBeInTheDocument();
  });

  // --- EC-2: Graceful degradation ---
  test('EC-2: no recommended pass degrades to discard view', () => {
    renderWithProviders(
      <HintPanel
        hint={{
          ...baseHint,
          charleston_pass_recommendations: [],
        }}
      />
    );

    expect(screen.queryByTestId('hint-charleston-pass-recommendations')).not.toBeInTheDocument();
    expect(screen.getByTestId('hint-recommended-discard')).toBeInTheDocument();
  });

  test('EC-2: empty best_patterns omits pattern section', () => {
    renderWithProviders(
      <HintPanel
        hint={{
          ...baseHint,
          best_patterns: [],
        }}
      />
    );

    expect(screen.queryByTestId('hint-best-patterns')).not.toBeInTheDocument();
  });

  test('EC-2: no discard recommendation shows fallback text', () => {
    renderWithProviders(
      <HintPanel
        hint={{
          ...baseHint,
          recommended_discard: null,
          discard_reason: null,
        }}
      />
    );

    expect(screen.getByTestId('hint-recommended-discard')).toHaveTextContent(
      'No discard recommendation'
    );
  });

  test('renders discard tile as a visual when present', () => {
    renderWithProviders(<HintPanel hint={baseHint} />);

    expect(screen.getByTestId('hint-discard-tile')).toBeInTheDocument();
  });

  test('does not render a close button or fixed positioning classes', () => {
    renderWithProviders(<HintPanel hint={baseHint} />);

    expect(screen.queryByTestId('close-hint-panel')).not.toBeInTheDocument();
    expect(screen.getByTestId('hint-panel')).not.toHaveClass('fixed');
  });

  test('uses theme-aware tokens', () => {
    renderWithProviders(<HintPanel hint={baseHint} />);

    expect(screen.getByTestId('hint-panel')).toHaveClass(
      'border',
      'bg-card/90',
      'text-card-foreground',
      'dark:bg-card'
    );
  });

  test('pattern cards with empty pattern_tiles omit tile strip', () => {
    renderWithProviders(
      <HintPanel
        hint={{
          ...baseHint,
          best_patterns: [
            {
              pattern_id: 'p1',
              variation_id: 'v1',
              pattern_name: 'Empty Pattern',
              probability: 0.5,
              score: 25,
              distance: 2,
              pattern_tiles: [],
              concealed: false,
            },
          ],
        }}
      />
    );

    expect(screen.queryByTestId('hint-pattern-tiles-0')).not.toBeInTheDocument();
    expect(screen.getByText('Empty Pattern')).toBeInTheDocument();
  });
});
