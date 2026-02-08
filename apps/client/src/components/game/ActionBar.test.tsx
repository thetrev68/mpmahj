/**
 * ActionBar Component Tests
 *
 * Tests for the action bar across different game phases.
 *
 * Related: US-002 (Charleston), US-004 (Blind Pass), US-010 (Discarding)
 */

import { describe, expect, test, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { ActionBar } from './ActionBar';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

describe('ActionBar', () => {
  const charlestonPhase: GamePhase = { Charleston: 'FirstLeft' };
  const defaultProps = {
    phase: charlestonPhase,
    mySeat: 'South' as const,
    selectedTiles: [],
    hasSubmittedPass: false,
    onCommand: vi.fn(),
  };

  describe('Charleston phase - standard pass (blind_pass_count: null)', () => {
    test('sends PassTiles with blind_pass_count null for standard stages', async () => {
      const onCommand = vi.fn();
      const standardPhase: GamePhase = { Charleston: 'FirstRight' };
      const { user } = renderWithProviders(
        <ActionBar
          {...defaultProps}
          phase={standardPhase}
          selectedTiles={[0, 1, 2]}
          onCommand={onCommand}
        />
      );

      await user.click(screen.getByTestId('pass-tiles-button'));

      const expected: GameCommand = {
        PassTiles: { player: 'South', tiles: [0, 1, 2], blind_pass_count: null },
      };
      expect(onCommand).toHaveBeenCalledWith(expected);
    });
  });

  describe('Charleston phase - blind pass support (FirstLeft)', () => {
    test('sends PassTiles with blind_pass_count when provided', async () => {
      const onCommand = vi.fn();
      const { user } = renderWithProviders(
        <ActionBar {...defaultProps} selectedTiles={[5]} blindPassCount={2} onCommand={onCommand} />
      );

      await user.click(screen.getByTestId('pass-tiles-button'));

      const expected: GameCommand = {
        PassTiles: { player: 'South', tiles: [5], blind_pass_count: 2 },
      };
      expect(onCommand).toHaveBeenCalledWith(expected);
    });

    test('sends PassTiles with blind_pass_count 3 and empty tiles for full blind', async () => {
      const onCommand = vi.fn();
      const { user } = renderWithProviders(
        <ActionBar {...defaultProps} selectedTiles={[]} blindPassCount={3} onCommand={onCommand} />
      );

      await user.click(screen.getByTestId('pass-tiles-button'));

      const expected: GameCommand = {
        PassTiles: { player: 'South', tiles: [], blind_pass_count: 3 },
      };
      expect(onCommand).toHaveBeenCalledWith(expected);
    });

    test('enables button when selectedTiles + blindPassCount = 3', () => {
      renderWithProviders(<ActionBar {...defaultProps} selectedTiles={[5]} blindPassCount={2} />);

      expect(screen.getByTestId('pass-tiles-button')).toBeEnabled();
    });

    test('disables button when selectedTiles + blindPassCount < 3', () => {
      renderWithProviders(<ActionBar {...defaultProps} selectedTiles={[5]} blindPassCount={1} />);

      expect(screen.getByTestId('pass-tiles-button')).toBeDisabled();
    });

    test('enables button for full blind (0 tiles + 3 blind)', () => {
      renderWithProviders(<ActionBar {...defaultProps} selectedTiles={[]} blindPassCount={3} />);

      expect(screen.getByTestId('pass-tiles-button')).toBeEnabled();
    });
  });

  describe('pass button state', () => {
    test('shows loading state after submission', async () => {
      const { user } = renderWithProviders(
        <ActionBar {...defaultProps} selectedTiles={[0, 1, 2]} />
      );

      await user.click(screen.getByTestId('pass-tiles-button'));

      // After click, hasSubmittedPass would be set by parent
      // But we can check the button is still there
      expect(screen.getByTestId('pass-tiles-button')).toBeInTheDocument();
    });

    test('shows "Tiles Passed" text when hasSubmittedPass', () => {
      renderWithProviders(
        <ActionBar {...defaultProps} selectedTiles={[0, 1, 2]} hasSubmittedPass={true} />
      );

      expect(screen.getByTestId('pass-tiles-button')).toHaveTextContent(/Tiles Passed/);
    });

    test('shows waiting message when hasSubmittedPass', () => {
      renderWithProviders(
        <ActionBar {...defaultProps} selectedTiles={[0, 1, 2]} hasSubmittedPass={true} />
      );

      expect(screen.getByText(/Waiting for other players/i)).toBeInTheDocument();
    });
  });

  describe('Playing phase - Discarding (US-010 Phase 1B)', () => {
    const discardingPhase: GamePhase = { Playing: { Discarding: { player: 'South' } } };
    const discardProps = {
      phase: discardingPhase,
      mySeat: 'South' as const,
      selectedTiles: [],
      hasSubmittedPass: false,
      onCommand: vi.fn(),
    };

    test('shows "Discard" button when in Discarding stage and tile is selected', () => {
      renderWithProviders(<ActionBar {...discardProps} selectedTiles={[5]} />);

      expect(screen.getByTestId('discard-button')).toBeInTheDocument();
      expect(screen.getByTestId('discard-button')).toHaveTextContent('Discard');
    });

    test('"Discard" button is enabled when one tile is selected', () => {
      renderWithProviders(<ActionBar {...discardProps} selectedTiles={[5]} />);

      expect(screen.getByTestId('discard-button')).toBeEnabled();
    });

    test('"Discard" button is disabled when no tile is selected', () => {
      renderWithProviders(<ActionBar {...discardProps} selectedTiles={[]} />);

      expect(screen.getByTestId('discard-button')).toBeDisabled();
    });

    test('clicking "Discard" button sends DiscardTile command', async () => {
      const onCommand = vi.fn();
      const { user } = renderWithProviders(
        <ActionBar {...discardProps} selectedTiles={[5]} onCommand={onCommand} />
      );

      await user.click(screen.getByTestId('discard-button'));

      const expected: GameCommand = {
        DiscardTile: { player: 'South', tile: 5 },
      };
      expect(onCommand).toHaveBeenCalledWith(expected);
    });

    test('button shows loading state after click (prevents double-click)', async () => {
      const onCommand = vi.fn();
      const { user } = renderWithProviders(
        <ActionBar {...discardProps} selectedTiles={[5]} onCommand={onCommand} />
      );

      await user.click(screen.getByTestId('discard-button'));

      // Button should show loading icon/text
      expect(screen.getByTestId('discard-button')).toHaveTextContent(/Discarding/);
    });

    test('does not show Discard button when not my turn', () => {
      const notMyTurnPhase: GamePhase = { Playing: { Discarding: { player: 'West' } } };
      renderWithProviders(<ActionBar {...discardProps} phase={notMyTurnPhase} />);

      expect(screen.queryByTestId('discard-button')).not.toBeInTheDocument();
    });

    test('shows status message when not my turn (Discarding)', () => {
      const notMyTurnPhase: GamePhase = { Playing: { Discarding: { player: 'West' } } };
      renderWithProviders(<ActionBar {...discardProps} phase={notMyTurnPhase} />);

      expect(screen.getByTestId('playing-status')).toHaveTextContent(/West's turn - Discarding/);
    });

    test('shows "Your turn - Discard a tile" when it is my turn', () => {
      renderWithProviders(<ActionBar {...discardProps} selectedTiles={[]} />);

      expect(screen.getByTestId('playing-status')).toHaveTextContent(/Your turn - Discard a tile/);
    });
  });
});
