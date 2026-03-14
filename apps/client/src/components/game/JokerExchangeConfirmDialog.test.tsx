import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { JokerExchangeConfirmDialog } from './JokerExchangeConfirmDialog';
import type { ExchangeOpportunity } from '@/types/game/exchange';

const opportunity: ExchangeOpportunity = {
  targetSeat: 'West',
  meldIndex: 1,
  tilePosition: 2,
  representedTile: 5,
};

describe('JokerExchangeConfirmDialog', () => {
  it('renders the dialog with tile and seat copy when open', () => {
    render(
      <JokerExchangeConfirmDialog
        isOpen={true}
        opportunity={opportunity}
        isLoading={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByTestId('joker-exchange-confirm-dialog')).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('heading', { name: 'Exchange Joker?' })).toBeInTheDocument();
    expect(screen.getByText('Exchange 6 Bam with Joker from West?')).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    render(
      <JokerExchangeConfirmDialog
        isOpen={false}
        opportunity={opportunity}
        isLoading={false}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.queryByTestId('joker-exchange-confirm-dialog')).not.toBeInTheDocument();
  });

  it('calls onCancel when No is pressed', () => {
    const onCancel = vi.fn();

    render(
      <JokerExchangeConfirmDialog
        isOpen={true}
        opportunity={opportunity}
        isLoading={false}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onConfirm when Yes is pressed', () => {
    const onConfirm = vi.fn();

    render(
      <JokerExchangeConfirmDialog
        isOpen={true}
        opportunity={opportunity}
        isLoading={false}
        onConfirm={onConfirm}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Yes' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('shows loading state on Yes and disables both actions', () => {
    render(
      <JokerExchangeConfirmDialog
        isOpen={true}
        opportunity={opportunity}
        isLoading={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Exchanging/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'No' })).toBeDisabled();
  });

  it('renders inline error text when provided', () => {
    render(
      <JokerExchangeConfirmDialog
        isOpen={true}
        opportunity={opportunity}
        isLoading={false}
        inlineError={"You don't have 6 Bam to exchange."}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );

    expect(screen.getByTestId('joker-exchange-inline-error')).toHaveTextContent(
      "You don't have 6 Bam to exchange."
    );
  });

  it('calls onCancel on Escape', () => {
    const onCancel = vi.fn();

    render(
      <JokerExchangeConfirmDialog
        isOpen={true}
        opportunity={opportunity}
        isLoading={false}
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });
});
