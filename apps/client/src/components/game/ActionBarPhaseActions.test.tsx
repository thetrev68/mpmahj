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
    canProceedCallWindow: false,
    onProceedCallWindow: vi.fn(),
    callWindowInstruction: undefined,
    canDeclareMahjong: false,
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

  test('renders proceed and mahjong buttons for Charleston stage', () => {
    renderWithProviders(<ActionBarPhaseActions {...baseProps} canCommitCharlestonPass={true} />);

    expect(screen.getByTestId('proceed-button')).toBeInTheDocument();
    expect(screen.getByTestId('declare-mahjong-button')).toBeInTheDocument();
  });

  test('preserves read-only branch message', () => {
    renderWithProviders(<ActionBarPhaseActions {...baseProps} readOnly={true} />);

    expect(screen.getByTestId('action-bar-read-only')).toBeInTheDocument();
    expect(screen.queryByTestId('action-instruction')).not.toBeInTheDocument();
  });

  test('renders only proceed and mahjong in drawing state', () => {
    renderWithProviders(
      <ActionBarPhaseActions {...baseProps} phase={{ Playing: { Drawing: { player: 'South' } } }} />
    );

    expect(screen.getByTestId('proceed-button')).toBeDisabled();
    expect(screen.getByTestId('declare-mahjong-button')).toBeDisabled();
    expect(screen.queryByTestId('get-hint-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('exchange-joker-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('playing-status')).not.toBeInTheDocument();
  });

  test('enables mahjong in drawing state when allowed', () => {
    renderWithProviders(
      <ActionBarPhaseActions
        {...baseProps}
        phase={{ Playing: { Drawing: { player: 'West' } } }}
        canDeclareMahjong={true}
        onDeclareMahjong={vi.fn()}
      />
    );

    expect(screen.getByTestId('proceed-button')).toBeDisabled();
    expect(screen.getByTestId('declare-mahjong-button')).toBeEnabled();
  });

  test('enables proceed only when my discard can commit and is not suppressed', () => {
    renderWithProviders(
      <ActionBarPhaseActions
        {...baseProps}
        phase={{ Playing: { Discarding: { player: 'South' } } }}
        canCommitDiscard={true}
      />
    );

    expect(screen.getByTestId('proceed-button')).toBeEnabled();
    expect(screen.getByTestId('declare-mahjong-button')).toBeDisabled();
  });

  test('disables proceed during my discard when discard action is suppressed', () => {
    renderWithProviders(
      <ActionBarPhaseActions
        {...baseProps}
        phase={{ Playing: { Discarding: { player: 'South' } } }}
        canCommitDiscard={true}
        suppressDiscardAction={true}
      />
    );

    expect(screen.getByTestId('proceed-button')).toBeDisabled();
    expect(screen.getByTestId('declare-mahjong-button')).toBeDisabled();
  });

  test('keeps both buttons rendered but disabled during opponent discard', () => {
    renderWithProviders(
      <ActionBarPhaseActions
        {...baseProps}
        phase={{ Playing: { Discarding: { player: 'West' } } }}
        canDeclareMahjong={true}
        onDeclareMahjong={vi.fn()}
      />
    );

    expect(screen.getByTestId('proceed-button')).toBeDisabled();
    expect(screen.getByTestId('declare-mahjong-button')).toBeEnabled();
    expect(screen.queryByTestId('playing-status')).not.toBeInTheDocument();
  });

  test('enables both buttons in call window when I can act and mahjong is legal', () => {
    renderWithProviders(
      <ActionBarPhaseActions
        {...baseProps}
        phase={{
          Playing: {
            CallWindow: {
              tile: 5,
              discarded_by: 'East',
              can_act: ['South'],
              pending_intents: [],
              timer: 10,
            },
          },
        }}
        canProceedCallWindow={true}
        canDeclareMahjong={true}
        onDeclareMahjong={vi.fn()}
      />
    );

    expect(screen.getByTestId('proceed-button')).toBeEnabled();
    expect(screen.getByTestId('declare-mahjong-button')).toBeEnabled();
  });

  test('disables both buttons in call window when I cannot act', () => {
    renderWithProviders(
      <ActionBarPhaseActions
        {...baseProps}
        phase={{
          Playing: {
            CallWindow: {
              tile: 5,
              discarded_by: 'East',
              can_act: ['West'],
              pending_intents: [],
              timer: 10,
            },
          },
        }}
        canProceedCallWindow={true}
        canDeclareMahjong={true}
        onDeclareMahjong={vi.fn()}
      />
    );

    expect(screen.getByTestId('proceed-button')).toBeDisabled();
    expect(screen.getByTestId('declare-mahjong-button')).toBeDisabled();
  });

  test('disables both buttons when disabled is true', () => {
    renderWithProviders(
      <ActionBarPhaseActions
        {...baseProps}
        phase={{ Playing: { Discarding: { player: 'South' } } }}
        canCommitDiscard={true}
        canDeclareMahjong={true}
        onDeclareMahjong={vi.fn()}
        disabled={true}
      />
    );

    expect(screen.getByTestId('proceed-button')).toBeDisabled();
    expect(screen.getByTestId('declare-mahjong-button')).toBeDisabled();
  });

  test('disables both buttons when busy is true, including call window', () => {
    renderWithProviders(
      <ActionBarPhaseActions
        {...baseProps}
        phase={{
          Playing: {
            CallWindow: {
              tile: 5,
              discarded_by: 'East',
              can_act: ['South'],
              pending_intents: [],
              timer: 10,
            },
          },
        }}
        canProceedCallWindow={true}
        canDeclareMahjong={true}
        onDeclareMahjong={vi.fn()}
        isBusy={true}
      />
    );

    expect(screen.getByTestId('proceed-button')).toBeDisabled();
    expect(screen.getByTestId('declare-mahjong-button')).toBeDisabled();
    expect(screen.getByTestId('proceed-button')).toHaveTextContent('Proceeding...');
  });
});
