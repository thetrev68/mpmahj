/**
 * CourtesyPassPanel Component Tests
 *
 * Related: US-007 (Courtesy Pass Negotiation), AC-2
 */

import { describe, expect, test, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { CourtesyPassPanel } from './CourtesyPassPanel';

describe('CourtesyPassPanel', () => {
  test('renders tile count buttons (0-3)', () => {
    renderWithProviders(<CourtesyPassPanel onPropose={vi.fn()} acrossPartnerSeat="West" />);

    expect(screen.getByTestId('courtesy-pass-panel')).toBeInTheDocument();
    expect(screen.getByTestId('courtesy-count-0')).toBeInTheDocument();
    expect(screen.getByTestId('courtesy-count-1')).toBeInTheDocument();
    expect(screen.getByTestId('courtesy-count-2')).toBeInTheDocument();
    expect(screen.getByTestId('courtesy-count-3')).toBeInTheDocument();
  });

  test('displays instruction message with across partner name', () => {
    renderWithProviders(<CourtesyPassPanel onPropose={vi.fn()} acrossPartnerSeat="North" />);

    expect(screen.getByText(/Negotiate with North - select 0-3 tiles/i)).toBeInTheDocument();
  });

  test('calls onPropose with count 0 when Skip button clicked', async () => {
    const onPropose = vi.fn();
    const { user } = renderWithProviders(
      <CourtesyPassPanel onPropose={onPropose} acrossPartnerSeat="West" />
    );

    await user.click(screen.getByTestId('courtesy-count-0'));
    expect(onPropose).toHaveBeenCalledWith(0);
  });

  test('calls onPropose with count 2 when 2 tiles button clicked', async () => {
    const onPropose = vi.fn();
    const { user } = renderWithProviders(
      <CourtesyPassPanel onPropose={onPropose} acrossPartnerSeat="West" />
    );

    await user.click(screen.getByTestId('courtesy-count-2'));
    expect(onPropose).toHaveBeenCalledWith(2);
  });

  test('calls onPropose with count 3 when 3 tiles button clicked', async () => {
    const onPropose = vi.fn();
    const { user } = renderWithProviders(
      <CourtesyPassPanel onPropose={onPropose} acrossPartnerSeat="West" />
    );

    await user.click(screen.getByTestId('courtesy-count-3'));
    expect(onPropose).toHaveBeenCalledWith(3);
  });

  test('disables all buttons when isPending is true', () => {
    renderWithProviders(
      <CourtesyPassPanel onPropose={vi.fn()} acrossPartnerSeat="West" isPending={true} />
    );

    expect(screen.getByTestId('courtesy-count-0')).toBeDisabled();
    expect(screen.getByTestId('courtesy-count-1')).toBeDisabled();
    expect(screen.getByTestId('courtesy-count-2')).toBeDisabled();
    expect(screen.getByTestId('courtesy-count-3')).toBeDisabled();
  });

  test('shows waiting message when isPending is true', () => {
    renderWithProviders(
      <CourtesyPassPanel
        onPropose={vi.fn()}
        acrossPartnerSeat="South"
        isPending={true}
        proposedCount={2}
      />
    );

    expect(screen.getByText(/Proposed 2 tiles. Waiting for South/i)).toBeInTheDocument();
  });

  test('shows waiting message for 0 tiles (skip)', () => {
    renderWithProviders(
      <CourtesyPassPanel
        onPropose={vi.fn()}
        acrossPartnerSeat="North"
        isPending={true}
        proposedCount={0}
      />
    );

    expect(screen.getByText(/Proposed 0 tiles. Waiting for North/i)).toBeInTheDocument();
  });

  test('buttons are enabled by default when isPending is false', () => {
    renderWithProviders(<CourtesyPassPanel onPropose={vi.fn()} acrossPartnerSeat="West" />);

    expect(screen.getByTestId('courtesy-count-0')).not.toBeDisabled();
    expect(screen.getByTestId('courtesy-count-1')).not.toBeDisabled();
    expect(screen.getByTestId('courtesy-count-2')).not.toBeDisabled();
    expect(screen.getByTestId('courtesy-count-3')).not.toBeDisabled();
  });
});
