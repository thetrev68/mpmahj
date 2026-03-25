import { describe, expect, test, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import userEvent from '@testing-library/user-event';
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

  test('preserves read-only branch message', () => {
    renderWithProviders(<ActionBarPhaseActions {...baseProps} readOnly={true} />);

    expect(screen.getByTestId('action-bar-read-only')).toBeInTheDocument();
    expect(screen.queryByTestId('action-instruction')).not.toBeInTheDocument();
  });

  test('renders a single Charleston waiting message after pass submission', () => {
    renderWithProviders(
      <ActionBarPhaseActions
        {...baseProps}
        phase={{ Charleston: 'FirstRight' }}
        hasSubmittedPass={true}
        canCommitCharlestonPass={true}
      />
    );

    expect(screen.getByTestId('action-instruction')).toHaveTextContent(
      'Passing 3 tiles right. Receiving 3 tiles from left.'
    );
    expect(
      screen.getAllByText(/Passing 3 tiles right\. Receiving 3 tiles from left\./)
    ).toHaveLength(1);
    expect(screen.queryByText('Waiting for other players...')).not.toBeInTheDocument();
  });

  test('renders a single courtesy waiting message after courtesy submission', () => {
    renderWithProviders(
      <ActionBarPhaseActions
        {...baseProps}
        phase={{ Charleston: 'CourtesyAcross' }}
        hasSubmittedPass={true}
        onCourtesyPassSubmit={vi.fn()}
      />
    );

    expect(screen.getByTestId('action-instruction')).toHaveTextContent(
      'Courtesy pass submitted. Waiting for player across...'
    );
    expect(
      screen.getAllByText(/Courtesy pass submitted\. Waiting for player across\.\.\./)
    ).toHaveLength(1);
  });

  test('removes duplicate vote status regions from Charleston voting', () => {
    renderWithProviders(
      <ActionBarPhaseActions
        {...baseProps}
        phase={{ Charleston: 'VotingToContinue' }}
        hasSubmittedVote={true}
        canCommitCharlestonPass={true}
      />
    );

    expect(screen.getByTestId('action-instruction')).toHaveTextContent(
      'Round vote. Stage up to 3 tiles to continue. Stage 0 tiles to stop. Press Proceed when ready.'
    );
    expect(screen.queryByTestId('vote-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('vote-status-message')).not.toBeInTheDocument();
    expect(screen.queryByTestId('vote-progress')).not.toBeInTheDocument();
    expect(screen.queryByTestId('vote-waiting-message')).not.toBeInTheDocument();
  });

  test('renders call-window prompt once when I can act', () => {
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
        callWindowInstruction="Press Proceed to pass, or add matching tiles to claim."
      />
    );

    expect(screen.getByTestId('action-instruction')).toHaveTextContent(
      'Press Proceed to pass, or add matching tiles to claim.'
    );
    expect(
      screen.getAllByText('Press Proceed to pass, or add matching tiles to claim.')
    ).toHaveLength(1);
    expect(screen.getByTestId('proceed-button')).toBeEnabled();
    expect(screen.getByTestId('declare-mahjong-button')).toBeEnabled();
  });

  test('renders no action instruction or buttons in call window when I cannot act', () => {
    const { container } = renderWithProviders(
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

    expect(container).toBeEmptyDOMElement();
    expect(screen.queryByTestId('action-instruction')).not.toBeInTheDocument();
    expect(screen.queryByTestId('proceed-button')).not.toBeInTheDocument();
    expect(screen.queryByTestId('declare-mahjong-button')).not.toBeInTheDocument();
  });

  test('enables proceed only when my discard can commit and is not suppressed', () => {
    renderWithProviders(
      <ActionBarPhaseActions
        {...baseProps}
        phase={{ Playing: { Discarding: { player: 'South' } } }}
        canCommitDiscard={true}
      />
    );

    expect(screen.getByTestId('action-instruction')).toHaveTextContent(
      'Select 1 tile to discard, then press Proceed. If you are Mahjong, press Mahjong.'
    );
    expect(screen.getByTestId('proceed-button')).toBeEnabled();
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

  describe('US-078: Charleston action hierarchy and Mahjong demotion', () => {
    test('AC-7: Charleston instruction uses higher-contrast secondary styling', () => {
      renderWithProviders(
        <ActionBarPhaseActions {...baseProps} phase={{ Charleston: 'FirstRight' }} />
      );

      const instruction = screen.getByTestId('action-instruction');
      expect(instruction).toHaveClass(
        'text-left',
        'font-medium',
        'text-foreground/75',
        'dark:text-slate-200/90'
      );
      expect(instruction).not.toHaveClass('text-center', 'text-muted-foreground');
    });

    test('AC-1: non-Charleston instruction keeps centered gray styling', () => {
      renderWithProviders(
        <ActionBarPhaseActions
          {...baseProps}
          phase={{ Playing: { Discarding: { player: 'South' } } }}
          canCommitDiscard={true}
        />
      );

      const instruction = screen.getByTestId('action-instruction');
      expect(instruction).toHaveClass('text-center', 'text-gray-300');
      expect(instruction).not.toHaveClass('text-left', 'text-muted-foreground');
    });

    test('AC-1: Charleston Mahjong button uses a demoted non-pulsing treatment when unavailable', () => {
      renderWithProviders(
        <ActionBarPhaseActions
          {...baseProps}
          phase={{ Charleston: 'FirstRight' }}
          canDeclareMahjong={false}
          onDeclareMahjong={vi.fn()}
        />
      );

      const mahjongBtn = screen.getByTestId('declare-mahjong-button');
      expect(mahjongBtn).toHaveClass(
        'bg-background',
        'border-border/80',
        'text-muted-foreground',
        'dark:bg-slate-950'
      );
      expect(mahjongBtn).not.toHaveClass('from-yellow-500', 'motion-safe:animate-pulse');
      expect(mahjongBtn).toBeDisabled();
    });

    test('AC-2: Charleston Mahjong button uses the full primary CTA treatment when available', () => {
      renderWithProviders(
        <ActionBarPhaseActions
          {...baseProps}
          phase={{ Charleston: 'FirstRight' }}
          canDeclareMahjong={true}
          onDeclareMahjong={vi.fn()}
        />
      );

      const mahjongBtn = screen.getByTestId('declare-mahjong-button');
      expect(mahjongBtn).toHaveClass(
        'from-yellow-500',
        'to-yellow-600',
        'text-black',
        'font-bold',
        'motion-safe:animate-pulse'
      );
      expect(mahjongBtn).toBeEnabled();
    });

    test('AC-3/AC-5: Charleston Mahjong button remains visible and in DOM', () => {
      renderWithProviders(
        <ActionBarPhaseActions
          {...baseProps}
          phase={{ Charleston: 'FirstLeft' }}
          canDeclareMahjong={false}
          onDeclareMahjong={vi.fn()}
        />
      );

      expect(screen.getByTestId('declare-mahjong-button')).toBeInTheDocument();
      expect(screen.getByTestId('proceed-button')).toBeInTheDocument();
    });

    test('AC-4: Proceed remains the first CTA while Charleston Mahjong escalates independently', () => {
      renderWithProviders(
        <ActionBarPhaseActions
          {...baseProps}
          phase={{ Charleston: 'FirstRight' }}
          canDeclareMahjong={true}
          canCommitCharlestonPass={true}
          onDeclareMahjong={vi.fn()}
        />
      );

      const proceedBtn = screen.getByTestId('proceed-button');
      const mahjongBtn = screen.getByTestId('declare-mahjong-button');
      expect(proceedBtn).toHaveClass('from-emerald-500', 'to-emerald-600');
      expect(mahjongBtn).toHaveClass('from-yellow-500', 'motion-safe:animate-pulse');
    });

    test('EC-1: actionable Charleston Mahjong calls the provided handler without moving button order', async () => {
      const user = userEvent.setup();
      const onDeclareMahjong = vi.fn();
      const { container } = renderWithProviders(
        <ActionBarPhaseActions
          {...baseProps}
          phase={{ Charleston: 'FirstRight' }}
          canDeclareMahjong={true}
          onDeclareMahjong={onDeclareMahjong}
          canCommitCharlestonPass={true}
        />
      );

      const buttons = container.querySelectorAll('button');
      const proceedIdx = Array.from(buttons).findIndex(
        (b) => b.getAttribute('data-testid') === 'proceed-button'
      );
      const mahjongIdx = Array.from(buttons).findIndex(
        (b) => b.getAttribute('data-testid') === 'declare-mahjong-button'
      );

      expect(proceedIdx).toBeLessThan(mahjongIdx);

      await user.click(screen.getByTestId('declare-mahjong-button'));

      expect(onDeclareMahjong).toHaveBeenCalledTimes(1);
    });

    test('AC-6: layout position stable — Mahjong always renders after Proceed in Charleston', () => {
      const { container } = renderWithProviders(
        <ActionBarPhaseActions
          {...baseProps}
          phase={{ Charleston: 'FirstRight' }}
          canDeclareMahjong={false}
          onDeclareMahjong={vi.fn()}
          canCommitCharlestonPass={true}
        />
      );

      const buttons = container.querySelectorAll('button');
      const proceedIdx = Array.from(buttons).findIndex(
        (b) => b.getAttribute('data-testid') === 'proceed-button'
      );
      const mahjongIdx = Array.from(buttons).findIndex(
        (b) => b.getAttribute('data-testid') === 'declare-mahjong-button'
      );
      expect(proceedIdx).toBeLessThan(mahjongIdx);
    });

    test('Playing phase Mahjong button retains full yellow gradient styling', () => {
      renderWithProviders(
        <ActionBarPhaseActions
          {...baseProps}
          phase={{ Playing: { Discarding: { player: 'South' } } }}
          canCommitDiscard={true}
          canDeclareMahjong={false}
          onDeclareMahjong={vi.fn()}
        />
      );

      const mahjongBtn = screen.getByTestId('declare-mahjong-button');
      expect(mahjongBtn).toHaveClass('from-yellow-500', 'motion-safe:animate-pulse');
      expect(mahjongBtn).not.toHaveClass('border-muted-foreground/40');
    });

    test('EC-2: read-only state does not show Charleston CTA', () => {
      renderWithProviders(
        <ActionBarPhaseActions
          {...baseProps}
          phase={{ Charleston: 'FirstRight' }}
          readOnly={true}
        />
      );

      expect(screen.getByTestId('action-bar-read-only')).toBeInTheDocument();
      expect(screen.queryByTestId('proceed-button')).not.toBeInTheDocument();
      expect(screen.queryByTestId('declare-mahjong-button')).not.toBeInTheDocument();
    });

    test('EC-3: Charleston courtesy phase also escalates Mahjong when actionable', () => {
      renderWithProviders(
        <ActionBarPhaseActions
          {...baseProps}
          phase={{ Charleston: 'CourtesyAcross' }}
          canDeclareMahjong={true}
          onDeclareMahjong={vi.fn()}
          onCourtesyPassSubmit={vi.fn()}
        />
      );

      const mahjongBtn = screen.getByTestId('declare-mahjong-button');
      expect(mahjongBtn).toHaveClass('from-yellow-500', 'motion-safe:animate-pulse');
    });
  });
});
