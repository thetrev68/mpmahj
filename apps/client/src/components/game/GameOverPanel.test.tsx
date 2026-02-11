/**
 * GameOverPanel Component Tests
 *
 * Related: US-018 (Declaring Mahjong - Self-Draw), AC-7
 */

import { describe, test, expect, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { GameOverPanel } from './GameOverPanel';
import type { GameResult } from '@/types/bindings/generated/GameResult';

describe('GameOverPanel', () => {
  const gameResult: GameResult = {
    winner: 'South',
    winning_pattern: 'Odds Only',
    score_breakdown: null,
    final_scores: { East: -35, South: 105, West: -35, North: -35 },
    final_hands: {},
    next_dealer: 'East',
    end_condition: 'Win',
  };

  const defaultProps = {
    isOpen: true,
    result: gameResult,
    onNewGame: vi.fn(),
    onReturnToLobby: vi.fn(),
  };

  test('renders when isOpen is true', () => {
    renderWithProviders(<GameOverPanel {...defaultProps} />);
    expect(screen.getByTestId('game-over-panel')).toBeInTheDocument();
  });

  test('does not render when isOpen is false', () => {
    renderWithProviders(<GameOverPanel {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('game-over-panel')).not.toBeInTheDocument();
  });

  test('shows "Game Over" heading', () => {
    renderWithProviders(<GameOverPanel {...defaultProps} />);
    expect(screen.getByText(/Game Over/i)).toBeInTheDocument();
  });

  test('shows winner information when result has a winner', () => {
    renderWithProviders(<GameOverPanel {...defaultProps} />);
    expect(screen.getByText(/South/)).toBeInTheDocument();
  });

  test('shows "Draw" message when result has no winner', () => {
    const drawResult: GameResult = { ...gameResult, winner: null, end_condition: 'WallExhausted' };
    renderWithProviders(<GameOverPanel {...defaultProps} result={drawResult} />);
    expect(screen.getByText(/Draw/i)).toBeInTheDocument();
  });

  test('renders "New Game" button', () => {
    renderWithProviders(<GameOverPanel {...defaultProps} />);
    expect(screen.getByRole('button', { name: /new game/i })).toBeInTheDocument();
  });

  test('renders "Return to Lobby" button', () => {
    renderWithProviders(<GameOverPanel {...defaultProps} />);
    expect(screen.getByRole('button', { name: /return to lobby/i })).toBeInTheDocument();
  });

  test('calls onNewGame when "New Game" clicked', async () => {
    const onNewGame = vi.fn();
    const { user } = renderWithProviders(<GameOverPanel {...defaultProps} onNewGame={onNewGame} />);
    await user.click(screen.getByRole('button', { name: /new game/i }));
    expect(onNewGame).toHaveBeenCalledOnce();
  });

  test('calls onReturnToLobby when "Return to Lobby" clicked', async () => {
    const onReturnToLobby = vi.fn();
    const { user } = renderWithProviders(
      <GameOverPanel {...defaultProps} onReturnToLobby={onReturnToLobby} />
    );
    await user.click(screen.getByRole('button', { name: /return to lobby/i }));
    expect(onReturnToLobby).toHaveBeenCalledOnce();
  });
});
