import { describe, expect, test, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { ActionBarPhaseActions } from './ActionBarPhaseActions';
import type { GamePhase } from '@/types/bindings/generated/GamePhase';

describe('ActionBarPhaseActions', () => {
  const baseProps = {
    phase: { Charleston: 'FirstLeft' } as GamePhase,
    mySeat: 'South' as const,
    readOnly: false,
    readOnlyMessage: 'Historical View - No actions available',
    selectedTiles: [],
    canCommitCharlestonPass: false,
    hasSubmittedPass: false,
    hasSubmittedVote: false,
    votedPlayers: [],
    totalPlayers: 4,
    suppressCharlestonPassAction: false,
    suppressDiscardAction: false,
    canCommitDiscard: false,
    canRequestHint: false,
    isHintRequestPending: false,
    canDeclareMahjong: false,
    canExchangeJoker: false,
    disabled: false,
    isBusy: false,
    onRollDice: vi.fn(),
    onCommitCharlestonPass: vi.fn(),
    onVoteCharleston: vi.fn(),
    onDiscardTile: vi.fn(),
  };

  test('shows persistent instruction in setup rolling dice state', () => {
    renderWithProviders(<ActionBarPhaseActions {...baseProps} phase={{ Setup: 'RollingDice' }} />);

    expect(screen.getByTestId('action-instruction')).toHaveTextContent(
      'Waiting for East to roll dice'
    );
  });

  test('hides charleston pass button when staging owns the pass action', () => {
    renderWithProviders(
      <ActionBarPhaseActions {...baseProps} suppressCharlestonPassAction={true} />
    );

    expect(screen.getByTestId('action-instruction')).toHaveTextContent(
      'Charleston. Select 3 tiles to pass left, then press Proceed.'
    );
    expect(screen.queryByTestId('pass-tiles-button')).not.toBeInTheDocument();
  });

  test('prefers explicit Charleston eligibility over local recomputation', () => {
    renderWithProviders(
      <ActionBarPhaseActions {...baseProps} selectedTiles={[]} canCommitCharlestonPass={true} />
    );

    expect(screen.getByTestId('pass-tiles-button')).toBeEnabled();
  });

  test('keeps discard button in DOM but disabled when it is not my turn', () => {
    renderWithProviders(
      <ActionBarPhaseActions
        {...baseProps}
        phase={{ Playing: { Discarding: { player: 'West' } } }}
      />
    );

    expect(screen.getByTestId('action-instruction')).toHaveTextContent(
      'Waiting for West to discard.'
    );
    expect(screen.getByTestId('discard-button')).toBeInTheDocument();
    expect(screen.getByTestId('discard-button')).toBeDisabled();
  });

  test('hides discard button when staging owns the discard action', () => {
    renderWithProviders(
      <ActionBarPhaseActions
        {...baseProps}
        phase={{ Playing: { Discarding: { player: 'South' } } }}
        suppressDiscardAction={true}
      />
    );

    expect(screen.getByTestId('action-instruction')).toHaveTextContent(
      'Select 1 tile to discard, then press Proceed. If you are Mahjong, press Mahjong.'
    );
    expect(screen.queryByTestId('discard-button')).not.toBeInTheDocument();
  });

  test('prefers explicit discard eligibility over local recomputation', () => {
    renderWithProviders(
      <ActionBarPhaseActions
        {...baseProps}
        phase={{ Playing: { Discarding: { player: 'South' } } }}
        selectedTiles={[]}
        canCommitDiscard={true}
      />
    );

    expect(screen.getByTestId('discard-button')).toBeEnabled();
  });

  test('keeps declare-mahjong button in DOM but disabled when canDeclareMahjong is false', () => {
    renderWithProviders(
      <ActionBarPhaseActions
        {...baseProps}
        phase={{ Playing: { Discarding: { player: 'South' } } }}
        canDeclareMahjong={false}
      />
    );

    expect(screen.getByTestId('declare-mahjong-button')).toBeInTheDocument();
    expect(screen.getByTestId('declare-mahjong-button')).toBeDisabled();
  });

  test('enables declare-mahjong button when canDeclareMahjong is true', () => {
    renderWithProviders(
      <ActionBarPhaseActions
        {...baseProps}
        phase={{ Playing: { Discarding: { player: 'South' } } }}
        canDeclareMahjong={true}
        onDeclareMahjong={vi.fn()}
      />
    );

    expect(screen.getByTestId('declare-mahjong-button')).not.toBeDisabled();
    expect(screen.getByTestId('declare-mahjong-button')).toHaveTextContent('Mahjong');
  });

  test('keeps exchange-joker button in DOM but disabled when canExchangeJoker is false', () => {
    renderWithProviders(
      <ActionBarPhaseActions
        {...baseProps}
        phase={{ Playing: { Discarding: { player: 'South' } } }}
        canExchangeJoker={false}
      />
    );

    expect(screen.getByTestId('exchange-joker-button')).toBeInTheDocument();
    expect(screen.getByTestId('exchange-joker-button')).toBeDisabled();
  });

  test('enables exchange-joker button when canExchangeJoker is true', () => {
    renderWithProviders(
      <ActionBarPhaseActions
        {...baseProps}
        phase={{ Playing: { Discarding: { player: 'South' } } }}
        canExchangeJoker={true}
        onExchangeJoker={vi.fn()}
      />
    );

    expect(screen.getByTestId('exchange-joker-button')).not.toBeDisabled();
  });

  test('preserves read-only branch message', () => {
    renderWithProviders(<ActionBarPhaseActions {...baseProps} readOnly={true} />);

    expect(screen.getByTestId('action-bar-read-only')).toBeInTheDocument();
    expect(screen.queryByTestId('action-instruction')).not.toBeInTheDocument();
  });

  test('shows proceed-first voting UI and disables proceed for invalid staged counts', () => {
    renderWithProviders(
      <ActionBarPhaseActions
        {...baseProps}
        phase={{ Charleston: 'VotingToContinue' }}
        selectedTiles={[0, 1]}
      />
    );

    expect(screen.getByTestId('vote-panel')).toBeInTheDocument();
    expect(screen.getByTestId('action-instruction')).toHaveTextContent(
      'Round vote. Stage 3 tiles to continue. Stage 0 tiles to stop. Press Proceed when ready.'
    );
    expect(screen.getByTestId('proceed-button')).toBeDisabled();
  });

  test('shows submitted vote status and progress in voting stage', () => {
    renderWithProviders(
      <ActionBarPhaseActions
        {...baseProps}
        phase={{ Charleston: 'VotingToContinue' }}
        hasSubmittedVote={true}
        myVote="Stop"
        votedPlayers={['East', 'South', 'West']}
        botVoteMessage="West (Bot) has voted"
      />
    );

    expect(screen.getByTestId('vote-status-message')).toHaveTextContent(
      'You voted to STOP. Waiting for other players...'
    );
    expect(screen.getByTestId('vote-progress')).toHaveTextContent('3/4 players voted');
    expect(screen.getByTestId('vote-waiting-message')).toHaveTextContent('Waiting for North...');
    expect(screen.getByTestId('bot-vote-message')).toHaveTextContent('West (Bot) has voted');
  });
});
