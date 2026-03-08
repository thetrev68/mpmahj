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
    hasSubmittedPass: false,
    suppressCharlestonPassAction: false,
    suppressDiscardAction: false,
    canRequestHint: false,
    isHintRequestPending: false,
    canDeclareMahjong: false,
    canExchangeJoker: false,
    disabled: false,
    isBusy: false,
    onRollDice: vi.fn(),
    onCommitCharlestonPass: vi.fn(),
    onDiscardTile: vi.fn(),
  };

  test('shows persistent instruction in setup rolling dice state', () => {
    renderWithProviders(<ActionBarPhaseActions {...baseProps} phase={{ Setup: 'RollingDice' }} />);

    expect(screen.getByTestId('action-instruction')).toHaveTextContent(
      'Waiting for East to roll dice'
    );
  });

  test('keeps charleston pass button in DOM when pass action is suppressed', () => {
    renderWithProviders(
      <ActionBarPhaseActions {...baseProps} suppressCharlestonPassAction={true} />
    );

    expect(screen.getByTestId('action-instruction')).toHaveTextContent('Select 3 tiles to pass');
    expect(screen.getByTestId('pass-tiles-button')).toBeInTheDocument();
    expect(screen.getByTestId('pass-tiles-button')).toBeDisabled();
  });

  test('keeps discard button in DOM but disabled when it is not my turn', () => {
    renderWithProviders(
      <ActionBarPhaseActions
        {...baseProps}
        phase={{ Playing: { Discarding: { player: 'West' } } }}
      />
    );

    expect(screen.getByTestId('action-instruction')).toHaveTextContent("West's turn to discard");
    expect(screen.getByTestId('discard-button')).toBeInTheDocument();
    expect(screen.getByTestId('discard-button')).toBeDisabled();
  });

  test('keeps discard button in DOM but disabled when discard action is suppressed', () => {
    renderWithProviders(
      <ActionBarPhaseActions
        {...baseProps}
        phase={{ Playing: { Discarding: { player: 'South' } } }}
        suppressDiscardAction={true}
      />
    );

    expect(screen.getByTestId('action-instruction')).toHaveTextContent('Select a tile to discard');
    expect(screen.getByTestId('discard-button')).toBeInTheDocument();
    expect(screen.getByTestId('discard-button')).toBeDisabled();
  });

  test('preserves read-only branch message', () => {
    renderWithProviders(<ActionBarPhaseActions {...baseProps} readOnly={true} />);

    expect(screen.getByTestId('action-bar-read-only')).toBeInTheDocument();
    expect(screen.queryByTestId('action-instruction')).not.toBeInTheDocument();
  });
});
