/**
 * ScoringScreen Component Tests
 *
 * Related: US-018 (Declaring Mahjong - Self-Draw), AC-6
 */

import { describe, test, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { ScoringScreen } from './ScoringScreen';
import type { ScoreBreakdown } from '@/types/bindings/generated/ScoreBreakdown';
import type { GameResult } from '@/types/bindings/generated/GameResult';

describe('ScoringScreen', () => {
  const scoreBreakdown: ScoreBreakdown = {
    base_score: 35,
    self_draw_bonus: 0,
    total: 35,
    payments: {
      East: -35,
      West: -35,
      North: -35,
    },
  };

  const gameResult: GameResult = {
    winner: 'South',
    winning_pattern: 'Odds Only',
    score_breakdown: scoreBreakdown,
    final_scores: {
      East: -35,
      South: 105,
      West: -35,
      North: -35,
    },
    final_hands: {},
    next_dealer: 'East',
    end_condition: 'Win',
  };

  const defaultProps = {
    isOpen: true,
    result: gameResult,
    winnerName: 'Alice',
    isSelfDraw: true,
    onContinue: vi.fn(),
  };

  test('renders when isOpen is true', () => {
    renderWithProviders(<ScoringScreen {...defaultProps} />);
    expect(screen.getByTestId('scoring-screen')).toBeInTheDocument();
  });

  test('does not render when isOpen is false', () => {
    renderWithProviders(<ScoringScreen {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('scoring-screen')).not.toBeInTheDocument();
  });

  test('renders all core content: heading, winner, pattern, score, payments, final scores, button', () => {
    renderWithProviders(<ScoringScreen {...defaultProps} />);

    // Heading, winner, pattern, base score
    expect(screen.getByText(/MAHJONG/i)).toBeInTheDocument();
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
    expect(screen.getByText(/Odds Only/)).toBeInTheDocument();
    expect(screen.getByTestId('base-score')).toHaveTextContent('35 pts');

    // Payments for each payer
    expect(screen.getByTestId('payment-East')).toBeInTheDocument();
    expect(screen.getByTestId('payment-West')).toBeInTheDocument();
    expect(screen.getByTestId('payment-North')).toBeInTheDocument();

    // Final scores for all seats
    expect(screen.getByTestId('final-score-East')).toBeInTheDocument();
    expect(screen.getByTestId('final-score-South')).toBeInTheDocument();
    expect(screen.getByTestId('final-score-West')).toBeInTheDocument();
    expect(screen.getByTestId('final-score-North')).toBeInTheDocument();

    // Continue button
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  test('shows self-draw indicator when isSelfDraw is true', () => {
    renderWithProviders(<ScoringScreen {...defaultProps} isSelfDraw={true} />);
    expect(screen.getByText(/self.draw/i)).toBeInTheDocument();
  });

  test('does not show self-draw indicator when isSelfDraw is false', () => {
    renderWithProviders(<ScoringScreen {...defaultProps} isSelfDraw={false} />);
    expect(screen.queryByText(/self.draw/i)).not.toBeInTheDocument();
  });

  test('calls onContinue when Continue button clicked', async () => {
    const onContinue = vi.fn();
    const { user } = renderWithProviders(
      <ScoringScreen {...defaultProps} onContinue={onContinue} />
    );
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onContinue).toHaveBeenCalledOnce();
  });

  // ── P2-2: Score formatting edge cases ─────────────────────────────────

  describe('Score formatting edge cases', () => {
    test('displays negative final scores with minus sign and red color', () => {
      renderWithProviders(<ScoringScreen {...defaultProps} />);

      const eastScore = screen.getByTestId('final-score-East');
      expect(eastScore).toHaveTextContent('-35');
      expect(eastScore.querySelector('span:last-child')).toHaveClass('text-red-400');
    });

    test('displays positive final scores with plus sign and green color', () => {
      renderWithProviders(<ScoringScreen {...defaultProps} />);

      const southScore = screen.getByTestId('final-score-South');
      expect(southScore).toHaveTextContent('+105');
      expect(southScore.querySelector('span:last-child')).toHaveClass('text-green-400');
    });

    test('displays zero final score with plus sign and green color', () => {
      const zeroResult: GameResult = {
        ...gameResult,
        final_scores: { East: 0, South: 0, West: 0, North: 0 },
      };
      renderWithProviders(<ScoringScreen {...defaultProps} result={zeroResult} />);

      const eastScore = screen.getByTestId('final-score-East');
      expect(eastScore).toHaveTextContent('+0');
      expect(eastScore.querySelector('span:last-child')).toHaveClass('text-green-400');
    });

    test('displays large scores correctly (high-value hands)', () => {
      const highValueResult: GameResult = {
        ...gameResult,
        score_breakdown: {
          base_score: 500,
          self_draw_bonus: 0,
          total: 500,
          payments: { East: -500, West: -500, North: -500 },
        },
        final_scores: { East: -500, South: 1500, West: -500, North: -500 },
      };
      renderWithProviders(<ScoringScreen {...defaultProps} result={highValueResult} />);

      expect(screen.getByTestId('base-score')).toHaveTextContent('500 pts');
      expect(screen.getByTestId('final-score-South')).toHaveTextContent('+1500');
      expect(screen.getByTestId('payment-East')).toHaveTextContent('-500 pts');
    });

    test('displays mixed positive and negative final scores in same round', () => {
      const mixedResult: GameResult = {
        ...gameResult,
        final_scores: { East: -70, South: 210, West: -70, North: -70 },
        score_breakdown: {
          base_score: 70,
          self_draw_bonus: 0,
          total: 70,
          payments: { East: -70, West: -70, North: -70 },
        },
      };
      renderWithProviders(<ScoringScreen {...defaultProps} result={mixedResult} />);

      // Winner positive
      const southScore = screen.getByTestId('final-score-South');
      expect(southScore).toHaveTextContent('+210');
      expect(southScore.querySelector('span:last-child')).toHaveClass('text-green-400');

      // Losers negative
      const eastScore = screen.getByTestId('final-score-East');
      expect(eastScore).toHaveTextContent('-70');
      expect(eastScore.querySelector('span:last-child')).toHaveClass('text-red-400');
    });

    test('handles undefined final score for a seat (shows dash)', () => {
      const partialResult: GameResult = {
        ...gameResult,
        final_scores: { South: 105 },
      };
      renderWithProviders(<ScoringScreen {...defaultProps} result={partialResult} />);

      const eastScore = screen.getByTestId('final-score-East');
      expect(eastScore).toHaveTextContent('-');
      expect(eastScore.querySelector('span:last-child')).toHaveClass('text-gray-500');
    });

    test('handles null score_breakdown gracefully', () => {
      const noBreakdown: GameResult = {
        ...gameResult,
        score_breakdown: null,
      };
      renderWithProviders(<ScoringScreen {...defaultProps} result={noBreakdown} />);

      // Base score section should not render
      expect(screen.queryByTestId('base-score')).not.toBeInTheDocument();
      // Payments section should not render (no payments data)
      expect(screen.queryByTestId('payment-East')).not.toBeInTheDocument();
      // Final scores should still render
      expect(screen.getByTestId('final-score-East')).toBeInTheDocument();
    });

    test('payment amounts display as absolute values', () => {
      renderWithProviders(<ScoringScreen {...defaultProps} />);

      // Payments are -35 in data but displayed as "-35 pts" (Math.abs applied)
      expect(screen.getByTestId('payment-East')).toHaveTextContent('-35 pts');
      expect(screen.getByTestId('payment-West')).toHaveTextContent('-35 pts');
    });

    test('shows called-from row when not self-draw', () => {
      renderWithProviders(
        <ScoringScreen {...defaultProps} isSelfDraw={false} calledFrom="North" />
      );

      expect(screen.getByTestId('called-from-row')).toHaveTextContent('North');
    });
  });
});
