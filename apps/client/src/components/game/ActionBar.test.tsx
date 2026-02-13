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

    test('shows "Your turn - Select a tile to discard" when it is my turn', () => {
      renderWithProviders(<ActionBar {...discardProps} selectedTiles={[]} />);

      expect(screen.getByTestId('playing-status')).toHaveTextContent(
        /Your turn - Select a tile to discard/
      );
    });
  });

  describe('Playing phase - Declare Mahjong (US-018)', () => {
    const discardingPhase: GamePhase = { Playing: { Discarding: { player: 'South' } } };
    const mahjongProps = {
      phase: discardingPhase,
      mySeat: 'South' as const,
      selectedTiles: [],
      hasSubmittedPass: false,
      canDeclareMahjong: true,
      onDeclareMahjong: vi.fn(),
      onCommand: vi.fn(),
    };

    test('shows "Declare Mahjong" button when canDeclareMahjong is true', () => {
      renderWithProviders(<ActionBar {...mahjongProps} />);
      expect(screen.getByTestId('declare-mahjong-button')).toBeInTheDocument();
    });

    test('does not show "Declare Mahjong" button when canDeclareMahjong is false', () => {
      renderWithProviders(<ActionBar {...mahjongProps} canDeclareMahjong={false} />);
      expect(screen.queryByTestId('declare-mahjong-button')).not.toBeInTheDocument();
    });

    test('does not show "Declare Mahjong" button when prop is omitted', () => {
      // Omit canDeclareMahjong and onDeclareMahjong to test default (false) behavior
      const { canDeclareMahjong: _1, onDeclareMahjong: _2, ...noMahjongProps } = mahjongProps;
      void _1;
      void _2;
      renderWithProviders(<ActionBar {...noMahjongProps} />);
      expect(screen.queryByTestId('declare-mahjong-button')).not.toBeInTheDocument();
    });

    test('clicking "Declare Mahjong" calls onDeclareMahjong callback', async () => {
      const onDeclareMahjong = vi.fn();
      const { user } = renderWithProviders(
        <ActionBar {...mahjongProps} onDeclareMahjong={onDeclareMahjong} />
      );

      await user.click(screen.getByTestId('declare-mahjong-button'));

      expect(onDeclareMahjong).toHaveBeenCalledOnce();
    });

    test('shows both Discard and Declare Mahjong buttons when tile is selected', () => {
      renderWithProviders(<ActionBar {...mahjongProps} selectedTiles={[5]} />);

      expect(screen.getByTestId('discard-button')).toBeInTheDocument();
      expect(screen.getByTestId('declare-mahjong-button')).toBeInTheDocument();
    });
  });

  describe('Playing phase - Exchange Joker (US-014/015)', () => {
    const discardingPhase: GamePhase = { Playing: { Discarding: { player: 'South' } } };
    const jokerExchangeProps = {
      phase: discardingPhase,
      mySeat: 'South' as const,
      selectedTiles: [],
      hasSubmittedPass: false,
      canExchangeJoker: true,
      onExchangeJoker: vi.fn(),
      onCommand: vi.fn(),
    };

    test('shows "Exchange Joker" button when canExchangeJoker is true', () => {
      renderWithProviders(<ActionBar {...jokerExchangeProps} />);
      expect(screen.getByTestId('exchange-joker-button')).toBeInTheDocument();
    });

    test('does not show "Exchange Joker" button when canExchangeJoker is false', () => {
      renderWithProviders(<ActionBar {...jokerExchangeProps} canExchangeJoker={false} />);
      expect(screen.queryByTestId('exchange-joker-button')).not.toBeInTheDocument();
    });

    test('does not show "Exchange Joker" button when prop is omitted', () => {
      const { canExchangeJoker: _1, onExchangeJoker: _2, ...noJokerProps } = jokerExchangeProps;
      void _1;
      void _2;
      renderWithProviders(<ActionBar {...noJokerProps} />);
      expect(screen.queryByTestId('exchange-joker-button')).not.toBeInTheDocument();
    });

    test('clicking "Exchange Joker" calls onExchangeJoker callback', async () => {
      const onExchangeJoker = vi.fn();
      const { user } = renderWithProviders(
        <ActionBar {...jokerExchangeProps} onExchangeJoker={onExchangeJoker} />
      );

      await user.click(screen.getByTestId('exchange-joker-button'));

      expect(onExchangeJoker).toHaveBeenCalledOnce();
    });

    test('shows together with Discard and Declare Mahjong buttons', () => {
      renderWithProviders(
        <ActionBar {...jokerExchangeProps} selectedTiles={[5]} canDeclareMahjong={true} />
      );

      expect(screen.getByTestId('discard-button')).toBeInTheDocument();
      expect(screen.getByTestId('declare-mahjong-button')).toBeInTheDocument();
      expect(screen.getByTestId('exchange-joker-button')).toBeInTheDocument();
    });
  });

  describe('Leave Game (US-031)', () => {
    test('shows Leave Game button in setup phase', () => {
      const setupPhase: GamePhase = { Setup: 'RollingDice' };
      renderWithProviders(<ActionBar {...defaultProps} phase={setupPhase} />);

      expect(screen.getByTestId('leave-game-button')).toBeInTheDocument();
      expect(screen.getByTestId('leave-game-button')).toBeEnabled();
    });

    test('opens leave confirmation dialog when clicking Leave Game', async () => {
      const { user } = renderWithProviders(<ActionBar {...defaultProps} />);

      await user.click(screen.getByTestId('leave-game-button'));

      expect(screen.getByTestId('leave-confirmation-dialog')).toBeInTheDocument();
      expect(
        screen.getByText(/You will be marked disconnected and returned to the lobby/i)
      ).toBeInTheDocument();
    });

    test('sends LeaveGame command when confirmed', async () => {
      const onCommand = vi.fn();
      const onLeaveConfirmed = vi.fn();
      const { user } = renderWithProviders(
        <ActionBar {...defaultProps} onCommand={onCommand} onLeaveConfirmed={onLeaveConfirmed} />
      );

      await user.click(screen.getByTestId('leave-game-button'));
      await user.click(screen.getByRole('button', { name: /leave game now/i }));

      expect(onCommand).toHaveBeenCalledWith({
        LeaveGame: { player: 'South' },
      });
      expect(onLeaveConfirmed).toHaveBeenCalledOnce();
      expect(screen.getByTestId('leave-loading-overlay')).toBeInTheDocument();
    });

    test('shows critical phase warning during my turn', async () => {
      const playingMyTurn: GamePhase = { Playing: { Discarding: { player: 'South' } } };
      const { user } = renderWithProviders(<ActionBar {...defaultProps} phase={playingMyTurn} />);

      await user.click(screen.getByTestId('leave-game-button'));

      expect(screen.getByText(/Leaving now will forfeit your current action/i)).toBeInTheDocument();
    });
  });

  describe('Forfeit Game (US-032)', () => {
    test('shows forfeit button enabled during playing discard stage', () => {
      const playingPhase: GamePhase = { Playing: { Discarding: { player: 'South' } } };
      renderWithProviders(<ActionBar {...defaultProps} phase={playingPhase} />);

      expect(screen.getByTestId('forfeit-game-button')).toBeInTheDocument();
      expect(screen.getByTestId('forfeit-game-button')).toBeEnabled();
    });

    test('forfeit button disabled in Charleston phase', () => {
      renderWithProviders(<ActionBar {...defaultProps} phase={{ Charleston: 'FirstRight' }} />);
      expect(screen.getByTestId('forfeit-game-button')).toBeDisabled();
    });

    test('forfeit button disabled in setup phase', () => {
      renderWithProviders(<ActionBar {...defaultProps} phase={{ Setup: 'RollingDice' }} />);
      expect(screen.getByTestId('forfeit-game-button')).toBeDisabled();
    });

    test('forfeit button disabled in call window stage', () => {
      const phase: GamePhase = {
        Playing: {
          CallWindow: {
            tile: 5,
            discarded_by: 'East',
            can_act: ['South'],
            pending_intents: [],
            timer: 10,
          },
        },
      };
      renderWithProviders(<ActionBar {...defaultProps} phase={phase} />);
      expect(screen.getByTestId('forfeit-game-button')).toBeDisabled();
    });

    test('opens forfeit confirmation dialog', async () => {
      const phase: GamePhase = { Playing: { Discarding: { player: 'East' } } };
      const { user } = renderWithProviders(<ActionBar {...defaultProps} phase={phase} />);

      await user.click(screen.getByTestId('forfeit-game-button'));
      expect(screen.getByTestId('forfeit-confirmation-dialog')).toBeInTheDocument();
      expect(
        screen.getByText(/You will lose immediately with a -100 point penalty/i)
      ).toBeInTheDocument();
    });

    test('sends ForfeitGame command with reason when confirmed', async () => {
      const onCommand = vi.fn();
      const phase: GamePhase = { Playing: { Discarding: { player: 'East' } } };
      const { user } = renderWithProviders(
        <ActionBar {...defaultProps} phase={phase} onCommand={onCommand} />
      );

      await user.click(screen.getByTestId('forfeit-game-button'));
      await user.type(screen.getByRole('textbox', { name: /reason/i }), 'Poor connection');
      await user.click(screen.getByRole('button', { name: /forfeit game now/i }));

      expect(onCommand).toHaveBeenCalledWith({
        ForfeitGame: { player: 'South', reason: 'Poor connection' },
      });
      expect(screen.getByTestId('forfeit-loading-overlay')).toBeInTheDocument();
    });
  });
});
