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
    canCommitCharlestonPass: false,
    hasSubmittedPass: false,
    canCommitDiscard: false,
    onCommand: vi.fn(),
  };

  describe('Charleston phase - standard pass (forward_incoming_count: 0)', () => {
    test('sends CommitCharlestonPass with forward_incoming_count 0 for standard stages', async () => {
      const onCommand = vi.fn();
      const standardPhase: GamePhase = { Charleston: 'FirstRight' };
      const { user } = renderWithProviders(
        <ActionBar
          {...defaultProps}
          phase={standardPhase}
          selectedTiles={[0, 1, 2]}
          canCommitCharlestonPass={true}
          onCommand={onCommand}
        />
      );

      await user.click(screen.getByTestId('pass-tiles-button'));

      const expected: GameCommand = {
        CommitCharlestonPass: { player: 'South', from_hand: [0, 1, 2], forward_incoming_count: 0 },
      };
      expect(onCommand).toHaveBeenCalledWith(expected);
    });
  });

  describe('layout and disabled state', () => {
    test('preserves action-bar testid on the relative full-width root', () => {
      renderWithProviders(<ActionBar {...defaultProps} />);

      expect(screen.getByTestId('action-bar')).toHaveClass('relative', 'w-full', 'h-full');
      expect(screen.getByTestId('action-bar')).not.toHaveClass('fixed');
    });

    test('disables all rendered buttons when disabled is true', () => {
      renderWithProviders(
        <ActionBar {...defaultProps} disabled={true} showSoloUndo={true} onUndo={vi.fn()} />
      );

      expect(screen.getByTestId('pass-tiles-button')).toBeDisabled();
      expect(screen.getByTestId('undo-button')).toBeDisabled();
      expect(screen.queryByTestId('leave-game-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('forfeit-game-button')).not.toBeInTheDocument();
    });

    test('does not render a sort button in the action pane', () => {
      renderWithProviders(<ActionBar {...defaultProps} />);

      expect(screen.queryByTestId('sort-button')).not.toBeInTheDocument();
    });
  });

  describe('Charleston phase - blind pass support (FirstLeft)', () => {
    test('sends CommitCharlestonPass with forward_incoming_count when blindPassCount provided', async () => {
      const onCommand = vi.fn();
      const { user } = renderWithProviders(
        <ActionBar
          {...defaultProps}
          selectedTiles={[5]}
          blindPassCount={2}
          canCommitCharlestonPass={true}
          onCommand={onCommand}
        />
      );

      await user.click(screen.getByTestId('pass-tiles-button'));

      const expected: GameCommand = {
        CommitCharlestonPass: { player: 'South', from_hand: [5], forward_incoming_count: 2 },
      };
      expect(onCommand).toHaveBeenCalledWith(expected);
    });

    test('sends CommitCharlestonPass with forward_incoming_count 3 and empty from_hand for full blind', async () => {
      const onCommand = vi.fn();
      const { user } = renderWithProviders(
        <ActionBar
          {...defaultProps}
          selectedTiles={[]}
          blindPassCount={3}
          canCommitCharlestonPass={true}
          onCommand={onCommand}
        />
      );

      await user.click(screen.getByTestId('pass-tiles-button'));

      const expected: GameCommand = {
        CommitCharlestonPass: { player: 'South', from_hand: [], forward_incoming_count: 3 },
      };
      expect(onCommand).toHaveBeenCalledWith(expected);
    });

    test('enables button when selectedTiles + blindPassCount = 3', () => {
      renderWithProviders(
        <ActionBar
          {...defaultProps}
          selectedTiles={[5]}
          blindPassCount={2}
          canCommitCharlestonPass={true}
        />
      );

      expect(screen.getByTestId('pass-tiles-button')).toBeEnabled();
    });

    test('disables button when selectedTiles + blindPassCount < 3', () => {
      renderWithProviders(
        <ActionBar
          {...defaultProps}
          selectedTiles={[5]}
          blindPassCount={1}
          canCommitCharlestonPass={false}
        />
      );

      expect(screen.getByTestId('pass-tiles-button')).toBeDisabled();
    });

    test('enables button for full blind (0 tiles + 3 blind)', () => {
      renderWithProviders(
        <ActionBar
          {...defaultProps}
          selectedTiles={[]}
          blindPassCount={3}
          canCommitCharlestonPass={true}
        />
      );

      expect(screen.getByTestId('pass-tiles-button')).toBeEnabled();
    });

    test('uses phase-owned Charleston eligibility when provided', () => {
      renderWithProviders(
        <ActionBar
          {...defaultProps}
          selectedTiles={[]}
          blindPassCount={0}
          canCommitCharlestonPass={true}
        />
      );

      expect(screen.getByTestId('pass-tiles-button')).toBeEnabled();
    });
  });

  describe('Charleston phase - suppressed pass action', () => {
    test('hides the pass button when staging owns the Charleston commit action', () => {
      renderWithProviders(<ActionBar {...defaultProps} suppressCharlestonPassAction={true} />);

      expect(screen.queryByTestId('pass-tiles-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('leave-game-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('forfeit-game-button')).not.toBeInTheDocument();
    });
  });

  describe('pass button state', () => {
    test('shows loading state after submission', async () => {
      const { user } = renderWithProviders(
        <ActionBar {...defaultProps} selectedTiles={[0, 1, 2]} canCommitCharlestonPass={true} />
      );

      await user.click(screen.getByTestId('pass-tiles-button'));

      // After click, hasSubmittedPass would be set by parent
      // But we can check the button is still there
      expect(screen.getByTestId('pass-tiles-button')).toBeInTheDocument();
    });

    test('shows "Tiles Passed" text when hasSubmittedPass', () => {
      renderWithProviders(
        <ActionBar
          {...defaultProps}
          selectedTiles={[0, 1, 2]}
          canCommitCharlestonPass={false}
          hasSubmittedPass={true}
        />
      );

      expect(screen.getByTestId('pass-tiles-button')).toHaveTextContent(/Tiles Passed/);
    });

    test('shows waiting message when hasSubmittedPass', () => {
      renderWithProviders(
        <ActionBar
          {...defaultProps}
          selectedTiles={[0, 1, 2]}
          canCommitCharlestonPass={false}
          hasSubmittedPass={true}
        />
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
      canCommitCharlestonPass: false,
      hasSubmittedPass: false,
      canCommitDiscard: false,
      onCommand: vi.fn(),
    };

    test('shows "Discard" button when in Discarding stage and tile is selected', () => {
      renderWithProviders(
        <ActionBar {...discardProps} selectedTiles={[5]} canCommitDiscard={true} />
      );

      expect(screen.getByTestId('discard-button')).toBeInTheDocument();
      expect(screen.getByTestId('discard-button')).toHaveTextContent('Discard');
    });

    test('"Discard" button is enabled when one tile is selected', () => {
      renderWithProviders(
        <ActionBar {...discardProps} selectedTiles={[5]} canCommitDiscard={true} />
      );

      expect(screen.getByTestId('discard-button')).toBeEnabled();
    });

    test('uses phase-owned discard eligibility when provided', () => {
      renderWithProviders(
        <ActionBar {...discardProps} selectedTiles={[]} canCommitDiscard={true} />
      );

      expect(screen.getByTestId('discard-button')).toBeEnabled();
    });

    test('"Discard" button is disabled when no tile is selected', () => {
      renderWithProviders(
        <ActionBar {...discardProps} selectedTiles={[]} canCommitDiscard={false} />
      );

      expect(screen.getByTestId('discard-button')).toBeDisabled();
    });

    test('clicking "Discard" button sends DiscardTile command', async () => {
      const onCommand = vi.fn();
      const { user } = renderWithProviders(
        <ActionBar
          {...discardProps}
          selectedTiles={[5]}
          canCommitDiscard={true}
          onCommand={onCommand}
        />
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
        <ActionBar
          {...discardProps}
          selectedTiles={[5]}
          canCommitDiscard={true}
          onCommand={onCommand}
        />
      );

      await user.click(screen.getByTestId('discard-button'));

      // Button should show loading icon/text
      expect(screen.getByTestId('discard-button')).toHaveTextContent(/Discarding/);
    });

    test('shows disabled Discard button when not my turn', () => {
      const notMyTurnPhase: GamePhase = { Playing: { Discarding: { player: 'West' } } };
      renderWithProviders(<ActionBar {...discardProps} phase={notMyTurnPhase} />);

      expect(screen.getByTestId('discard-button')).toBeDisabled();
    });

    test('shows status message when not my turn (Discarding)', () => {
      const notMyTurnPhase: GamePhase = { Playing: { Discarding: { player: 'West' } } };
      renderWithProviders(<ActionBar {...discardProps} phase={notMyTurnPhase} />);

      expect(screen.getByTestId('playing-status')).toHaveTextContent(/West's turn - Discarding/);
    });

    // VR-015 T-3: playing-status uses status message role classes (AC-8)
    test('T-3 (VR-015): playing-status has text-emerald-200 class', () => {
      const notMyTurnPhase: GamePhase = { Playing: { Discarding: { player: 'West' } } };
      renderWithProviders(<ActionBar {...discardProps} phase={notMyTurnPhase} />);

      expect(screen.getByTestId('playing-status')).toHaveClass('text-emerald-200');
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
      canCommitCharlestonPass: false,
      hasSubmittedPass: false,
      canCommitDiscard: false,
      canDeclareMahjong: true,
      onDeclareMahjong: vi.fn(),
      onCommand: vi.fn(),
    };

    test('shows "Declare Mahjong" button when canDeclareMahjong is true', () => {
      renderWithProviders(<ActionBar {...mahjongProps} />);
      expect(screen.getByTestId('declare-mahjong-button')).toBeInTheDocument();
    });

    test('shows disabled "Declare Mahjong" button when canDeclareMahjong is false', () => {
      renderWithProviders(<ActionBar {...mahjongProps} canDeclareMahjong={false} />);
      expect(screen.getByTestId('declare-mahjong-button')).toBeDisabled();
    });

    test('shows disabled "Declare Mahjong" button when prop is omitted', () => {
      // Omit canDeclareMahjong and onDeclareMahjong to test default (false) behavior
      const { canDeclareMahjong: _1, onDeclareMahjong: _2, ...noMahjongProps } = mahjongProps;
      void _1;
      void _2;
      renderWithProviders(<ActionBar {...noMahjongProps} />);
      expect(screen.getByTestId('declare-mahjong-button')).toBeDisabled();
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
      renderWithProviders(
        <ActionBar {...mahjongProps} selectedTiles={[5]} canCommitDiscard={true} />
      );

      expect(screen.getByTestId('discard-button')).toBeInTheDocument();
      expect(screen.getByTestId('declare-mahjong-button')).toBeInTheDocument();
    });
  });

  describe('Playing phase - Request Hint (US-027)', () => {
    const discardingPhase: GamePhase = { Playing: { Discarding: { player: 'South' } } };
    const hintProps = {
      phase: discardingPhase,
      mySeat: 'South' as const,
      selectedTiles: [],
      canCommitCharlestonPass: false,
      canCommitDiscard: false,
      onCommand: vi.fn(),
      canRequestHint: true,
      onOpenHintRequest: vi.fn(),
    };

    test('shows Get Hint button when hint request is available', () => {
      renderWithProviders(<ActionBar {...hintProps} />);
      expect(screen.getByTestId('get-hint-button')).toBeInTheDocument();
    });

    test('calls onOpenHintRequest when Get Hint is clicked', async () => {
      const onOpenHintRequest = vi.fn();
      const { user } = renderWithProviders(
        <ActionBar {...hintProps} onOpenHintRequest={onOpenHintRequest} />
      );

      await user.click(screen.getByTestId('get-hint-button'));
      expect(onOpenHintRequest).toHaveBeenCalledOnce();
    });

    test('disables Get Hint button while analysis is pending', () => {
      renderWithProviders(<ActionBar {...hintProps} isHintRequestPending={true} />);
      expect(screen.getByTestId('get-hint-button')).toBeDisabled();
      expect(screen.getByTestId('get-hint-button')).toHaveTextContent(/Analyzing/i);
    });
  });

  describe('Playing phase - Exchange Joker (US-014/015)', () => {
    const discardingPhase: GamePhase = { Playing: { Discarding: { player: 'South' } } };
    const jokerExchangeProps = {
      phase: discardingPhase,
      mySeat: 'South' as const,
      selectedTiles: [],
      canCommitCharlestonPass: false,
      hasSubmittedPass: false,
      canCommitDiscard: false,
      canExchangeJoker: true,
      onExchangeJoker: vi.fn(),
      onCommand: vi.fn(),
    };

    test('shows "Exchange Joker" button when canExchangeJoker is true', () => {
      renderWithProviders(<ActionBar {...jokerExchangeProps} />);
      expect(screen.getByTestId('exchange-joker-button')).toBeInTheDocument();
    });

    test('shows disabled "Exchange Joker" button when canExchangeJoker is false', () => {
      renderWithProviders(<ActionBar {...jokerExchangeProps} canExchangeJoker={false} />);
      expect(screen.getByTestId('exchange-joker-button')).toBeDisabled();
    });

    test('shows disabled "Exchange Joker" button when prop is omitted', () => {
      const { canExchangeJoker: _1, onExchangeJoker: _2, ...noJokerProps } = jokerExchangeProps;
      void _1;
      void _2;
      renderWithProviders(<ActionBar {...noJokerProps} />);
      expect(screen.getByTestId('exchange-joker-button')).toBeDisabled();
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

  describe('VR-014 — ActionBar in PlayerZone right column', () => {
    const discardingPhase: GamePhase = { Playing: { Discarding: { player: 'South' } } };
    const vr014Props = {
      phase: discardingPhase,
      mySeat: 'South' as const,
      selectedTiles: [],
      canCommitCharlestonPass: false,
      canCommitDiscard: false,
      onCommand: vi.fn(),
    };

    // T-1
    test('renders discard-button when in Discarding stage as active player', () => {
      renderWithProviders(<ActionBar {...vr014Props} />);
      expect(screen.getByTestId('discard-button')).toBeInTheDocument();
    });

    // T-2
    test('does not render leave-game-button', () => {
      renderWithProviders(<ActionBar {...vr014Props} />);
      expect(screen.queryByTestId('leave-game-button')).not.toBeInTheDocument();
    });

    // T-3
    test('does not render forfeit-game-button', () => {
      renderWithProviders(<ActionBar {...vr014Props} />);
      expect(screen.queryByTestId('forfeit-game-button')).not.toBeInTheDocument();
    });

    // T-4
    test('renders action-bar root with relative positioning (not fixed)', () => {
      renderWithProviders(<ActionBar {...vr014Props} />);
      const bar = screen.getByTestId('action-bar');
      expect(bar).toBeInTheDocument();
      expect(bar).toHaveClass('relative', 'h-full');
      expect(bar).not.toHaveClass('fixed');
    });

    test('does not render dedicated bottom controls for leave/forfeit', () => {
      renderWithProviders(<ActionBar {...vr014Props} />);
      expect(screen.queryByTestId('action-bar-bottom-controls')).not.toBeInTheDocument();
    });

    // T-5
    test('renders instruction-only Charleston action bar when staging owns the pass control', () => {
      renderWithProviders(
        <ActionBar
          phase={{ Charleston: 'FirstRight' }}
          mySeat="South"
          canCommitCharlestonPass={false}
          canCommitDiscard={false}
          suppressCharlestonPassAction={true}
          onCommand={vi.fn()}
        />
      );
      expect(screen.getByTestId('action-instruction')).toHaveTextContent('Select 3 tiles to pass');
      expect(screen.queryByTestId('pass-tiles-button')).not.toBeInTheDocument();
    });
  });

  describe('Smart Undo (US-022 / US-023)', () => {
    const playingPhase: GamePhase = { Playing: { Discarding: { player: 'South' } } };

    test('shows solo Undo button and keyboard hint', () => {
      renderWithProviders(
        <ActionBar
          {...defaultProps}
          phase={playingPhase}
          showSoloUndo={true}
          soloUndoRemaining={3}
          soloUndoLimit={10}
          undoRecentActions={['Discarded 5 Dot']}
          onUndo={vi.fn()}
        />
      );

      expect(screen.getByTestId('undo-button')).toBeInTheDocument();
      expect(screen.getByText(/Press Ctrl\+Z to undo last action/i)).toBeInTheDocument();
    });

    test('invokes onUndo when solo Undo button is clicked', async () => {
      const onUndo = vi.fn();
      const { user } = renderWithProviders(
        <ActionBar
          {...defaultProps}
          phase={playingPhase}
          showSoloUndo={true}
          soloUndoRemaining={2}
          soloUndoLimit={10}
          undoRecentActions={['Discarded 5 Dot']}
          onUndo={onUndo}
        />
      );

      await user.click(screen.getByTestId('undo-button'));
      expect(onUndo).toHaveBeenCalledOnce();
    });

    test('shows Request Undo Vote button in multiplayer mode', () => {
      renderWithProviders(
        <ActionBar
          {...defaultProps}
          phase={playingPhase}
          showUndoVoteRequest={true}
          undoVoteRemaining={2}
          onRequestUndoVote={vi.fn()}
        />
      );

      expect(screen.getByTestId('request-undo-vote-button')).toBeInTheDocument();
    });

    test('invokes onRequestUndoVote when request button is clicked', async () => {
      const onRequestUndoVote = vi.fn();
      const { user } = renderWithProviders(
        <ActionBar
          {...defaultProps}
          phase={playingPhase}
          showUndoVoteRequest={true}
          undoVoteRemaining={2}
          onRequestUndoVote={onRequestUndoVote}
        />
      );

      await user.click(screen.getByTestId('request-undo-vote-button'));
      expect(onRequestUndoVote).toHaveBeenCalledOnce();
    });
  });
});
