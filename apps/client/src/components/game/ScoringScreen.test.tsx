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
    concealed_bonus: 0,
    self_draw_bonus: 0,
    dealer_bonus: 0,
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

  test('shows MAHJONG heading', () => {
    renderWithProviders(<ScoringScreen {...defaultProps} />);
    expect(screen.getByText(/MAHJONG/i)).toBeInTheDocument();
  });

  test('shows winner name', () => {
    renderWithProviders(<ScoringScreen {...defaultProps} />);
    expect(screen.getByText(/Alice/)).toBeInTheDocument();
  });

  test('shows winning pattern name', () => {
    renderWithProviders(<ScoringScreen {...defaultProps} />);
    expect(screen.getByText(/Odds Only/)).toBeInTheDocument();
  });

  test('shows base score', () => {
    renderWithProviders(<ScoringScreen {...defaultProps} />);
    expect(screen.getByTestId('base-score')).toHaveTextContent('35 pts');
  });

  test('shows self-draw indicator when isSelfDraw is true', () => {
    renderWithProviders(<ScoringScreen {...defaultProps} isSelfDraw={true} />);
    expect(screen.getByText(/self.draw/i)).toBeInTheDocument();
  });

  test('does not show self-draw indicator when isSelfDraw is false', () => {
    renderWithProviders(<ScoringScreen {...defaultProps} isSelfDraw={false} />);
    expect(screen.queryByText(/self.draw/i)).not.toBeInTheDocument();
  });

  test('shows payment for each payer', () => {
    renderWithProviders(<ScoringScreen {...defaultProps} />);
    // Each of East, West, North pays 35
    expect(screen.getByTestId('payment-East')).toBeInTheDocument();
    expect(screen.getByTestId('payment-West')).toBeInTheDocument();
    expect(screen.getByTestId('payment-North')).toBeInTheDocument();
  });

  test('shows final scores for all seats', () => {
    renderWithProviders(<ScoringScreen {...defaultProps} />);
    expect(screen.getByTestId('final-score-East')).toBeInTheDocument();
    expect(screen.getByTestId('final-score-South')).toBeInTheDocument();
    expect(screen.getByTestId('final-score-West')).toBeInTheDocument();
    expect(screen.getByTestId('final-score-North')).toBeInTheDocument();
  });

  test('renders Continue button', () => {
    renderWithProviders(<ScoringScreen {...defaultProps} />);
    expect(screen.getByRole('button', { name: /continue/i })).toBeInTheDocument();
  });

  test('calls onContinue when Continue button clicked', async () => {
    const onContinue = vi.fn();
    const { user } = renderWithProviders(
      <ScoringScreen {...defaultProps} onContinue={onContinue} />
    );
    await user.click(screen.getByRole('button', { name: /continue/i }));
    expect(onContinue).toHaveBeenCalledOnce();
  });
});
