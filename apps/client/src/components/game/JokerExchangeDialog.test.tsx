/**
 * Tests for JokerExchangeDialog Component
 *
 * Related: US-014 (Exchanging Joker - Single), US-015 (Exchanging Joker - Multiple)
 */

import { describe, test, expect, vi } from 'vitest';
import { renderWithProviders, screen, fireEvent } from '@/test/test-utils';
import { JokerExchangeDialog } from './JokerExchangeDialog';
import type { ExchangeOpportunity } from './JokerExchangeDialog';

// Bam3 = 2, Red Dragon = 32, Joker = 42
const opp1: ExchangeOpportunity = {
  targetSeat: 'South',
  meldIndex: 0,
  tilePosition: 2,
  representedTile: 2, // 3 Bam
};

const opp2: ExchangeOpportunity = {
  targetSeat: 'West',
  meldIndex: 1,
  tilePosition: 0,
  representedTile: 32, // Red Dragon
};

describe('JokerExchangeDialog', () => {
  test('renders nothing when isOpen=false', () => {
    renderWithProviders(
      <JokerExchangeDialog
        isOpen={false}
        opportunities={[opp1]}
        onExchange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.queryByTestId('joker-exchange-dialog')).not.toBeInTheDocument();
  });

  test('renders dialog when isOpen=true', () => {
    renderWithProviders(
      <JokerExchangeDialog
        isOpen={true}
        opportunities={[opp1]}
        onExchange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByTestId('joker-exchange-dialog')).toBeInTheDocument();
    expect(screen.getByTestId('joker-exchange-dialog-title')).toHaveTextContent('Exchange Joker');
  });

  test('shows each exchange opportunity with tile names and seats', () => {
    renderWithProviders(
      <JokerExchangeDialog
        isOpen={true}
        opportunities={[opp1, opp2]}
        onExchange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByTestId('exchange-opportunity-0')).toBeInTheDocument();
    expect(screen.getByTestId('exchange-opportunity-1')).toBeInTheDocument();
    expect(screen.getByText(/3 Bam/)).toBeInTheDocument();
    expect(screen.getByText(/Red Dragon/)).toBeInTheDocument();
    expect(screen.getByText(/South's meld/)).toBeInTheDocument();
    expect(screen.getByText(/West's meld/)).toBeInTheDocument();
  });

  test('shows empty state when no opportunities', () => {
    renderWithProviders(
      <JokerExchangeDialog
        isOpen={true}
        opportunities={[]}
        onExchange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText(/No exchange opportunities available/i)).toBeInTheDocument();
  });

  test('calls onExchange with correct opportunity when Exchange button clicked', () => {
    const handleExchange = vi.fn();
    renderWithProviders(
      <JokerExchangeDialog
        isOpen={true}
        opportunities={[opp1, opp2]}
        onExchange={handleExchange}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('exchange-confirm-button-0'));
    expect(handleExchange).toHaveBeenCalledWith(opp1);
    expect(handleExchange).toHaveBeenCalledTimes(1);
  });

  test('calls onExchange with second opportunity when second button clicked', () => {
    const handleExchange = vi.fn();
    renderWithProviders(
      <JokerExchangeDialog
        isOpen={true}
        opportunities={[opp1, opp2]}
        onExchange={handleExchange}
        onClose={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTestId('exchange-confirm-button-1'));
    expect(handleExchange).toHaveBeenCalledWith(opp2);
  });

  test('calls onClose when Cancel button clicked', () => {
    const handleClose = vi.fn();
    renderWithProviders(
      <JokerExchangeDialog
        isOpen={true}
        opportunities={[opp1]}
        onExchange={vi.fn()}
        onClose={handleClose}
      />
    );
    fireEvent.click(screen.getByTestId('joker-exchange-cancel-button'));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  test('disables buttons when isLoading=true', () => {
    renderWithProviders(
      <JokerExchangeDialog
        isOpen={true}
        opportunities={[opp1]}
        isLoading={true}
        onExchange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByTestId('exchange-confirm-button-0')).toBeDisabled();
    expect(screen.getByTestId('joker-exchange-cancel-button')).toBeDisabled();
  });

  test('shows loading text on exchange buttons when isLoading=true', () => {
    renderWithProviders(
      <JokerExchangeDialog
        isOpen={true}
        opportunities={[opp1]}
        isLoading={true}
        onExchange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByTestId('exchange-confirm-button-0')).toHaveTextContent(/Exchanging/i);
  });

  test('has accessible dialog role and label', () => {
    renderWithProviders(
      <JokerExchangeDialog
        isOpen={true}
        opportunities={[opp1]}
        onExchange={vi.fn()}
        onClose={vi.fn()}
      />
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-label', 'Exchange Joker');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  test('Escape key closes dialog (Issue #5)', () => {
    const onClose = vi.fn();
    renderWithProviders(
      <JokerExchangeDialog
        isOpen={true}
        opportunities={[opp1]}
        onExchange={vi.fn()}
        onClose={onClose}
      />
    );

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('Enter key confirms when only one opportunity and not loading (Issue #5)', () => {
    const onExchange = vi.fn();
    renderWithProviders(
      <JokerExchangeDialog
        isOpen={true}
        opportunities={[opp1]}
        isLoading={false}
        onExchange={onExchange}
        onClose={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onExchange).toHaveBeenCalledTimes(1);
    expect(onExchange).toHaveBeenCalledWith(opp1);
  });

  test('Enter key does nothing when multiple opportunities (Issue #5)', () => {
    const onExchange = vi.fn();
    renderWithProviders(
      <JokerExchangeDialog
        isOpen={true}
        opportunities={[opp1, opp2]}
        isLoading={false}
        onExchange={onExchange}
        onClose={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onExchange).not.toHaveBeenCalled();
  });

  test('Enter key does nothing when loading (Issue #5)', () => {
    const onExchange = vi.fn();
    renderWithProviders(
      <JokerExchangeDialog
        isOpen={true}
        opportunities={[opp1]}
        isLoading={true}
        onExchange={onExchange}
        onClose={vi.fn()}
      />
    );

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onExchange).not.toHaveBeenCalled();
  });
});
