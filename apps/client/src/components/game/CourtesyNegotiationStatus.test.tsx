/**
 * CourtesyNegotiationStatus Component Tests
 *
 * Related: US-007 (Courtesy Pass Negotiation), AC-3, AC-4, AC-5
 */

import { describe, expect, test } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { CourtesyNegotiationStatus } from './CourtesyNegotiationStatus';

describe('CourtesyNegotiationStatus', () => {
  test('shows agreement message when both proposed same count', () => {
    renderWithProviders(
      <CourtesyNegotiationStatus type="agreement" agreedCount={2} acrossPartnerSeat="North" />
    );

    expect(screen.getByText(/Agreed to pass 2 tiles with North/i)).toBeInTheDocument();
  });

  test('shows agreement for 1 tile', () => {
    renderWithProviders(
      <CourtesyNegotiationStatus type="agreement" agreedCount={1} acrossPartnerSeat="West" />
    );

    expect(screen.getByText(/Agreed to pass 1 tile with West/i)).toBeInTheDocument();
  });

  test('shows mismatch message with both proposals and agreed count', () => {
    renderWithProviders(
      <CourtesyNegotiationStatus
        type="mismatch"
        myProposal={3}
        partnerProposal={1}
        agreedCount={1}
        acrossPartnerSeat="South"
      />
    );

    expect(screen.getByText(/Mismatch! You proposed 3, South proposed 1/i)).toBeInTheDocument();
    expect(screen.getByText(/Agreed on 1 tile \(lower count wins\)/i)).toBeInTheDocument();
  });

  test('shows mismatch with different counts', () => {
    renderWithProviders(
      <CourtesyNegotiationStatus
        type="mismatch"
        myProposal={2}
        partnerProposal={3}
        agreedCount={2}
        acrossPartnerSeat="East"
      />
    );

    expect(screen.getByText(/You proposed 2, East proposed 3/i)).toBeInTheDocument();
    expect(screen.getByText(/Agreed on 2 tiles \(lower count wins\)/i)).toBeInTheDocument();
  });

  test('shows zero tiles message when both proposed 0', () => {
    renderWithProviders(
      <CourtesyNegotiationStatus type="zero" agreedCount={0} acrossPartnerSeat="North" />
    );

    expect(screen.getByText(/No courtesy pass with North/i)).toBeInTheDocument();
  });

  test('shows zero tiles message when I proposed 0', () => {
    renderWithProviders(
      <CourtesyNegotiationStatus
        type="zero"
        myProposal={0}
        partnerProposal={2}
        agreedCount={0}
        acrossPartnerSeat="West"
      />
    );

    expect(screen.getByText(/No courtesy pass \(you proposed 0\)/i)).toBeInTheDocument();
  });

  test('shows zero tiles message when partner proposed 0', () => {
    renderWithProviders(
      <CourtesyNegotiationStatus
        type="zero"
        myProposal={2}
        partnerProposal={0}
        agreedCount={0}
        acrossPartnerSeat="South"
      />
    );

    expect(screen.getByText(/No courtesy pass \(South proposed 0\)/i)).toBeInTheDocument();
  });

  test('renders with testid', () => {
    renderWithProviders(
      <CourtesyNegotiationStatus type="agreement" agreedCount={2} acrossPartnerSeat="West" />
    );

    expect(screen.getByTestId('courtesy-negotiation-status')).toBeInTheDocument();
  });

  test('uses success styling for agreement', () => {
    renderWithProviders(
      <CourtesyNegotiationStatus type="agreement" agreedCount={2} acrossPartnerSeat="North" />
    );

    const element = screen.getByTestId('courtesy-negotiation-status');
    expect(element).toHaveClass('border-green-500');
  });

  test('uses warning styling for mismatch', () => {
    renderWithProviders(
      <CourtesyNegotiationStatus
        type="mismatch"
        myProposal={3}
        partnerProposal={1}
        agreedCount={1}
        acrossPartnerSeat="South"
      />
    );

    const element = screen.getByTestId('courtesy-negotiation-status');
    expect(element).toHaveClass('border-yellow-500');
  });

  test('uses muted styling for zero', () => {
    renderWithProviders(
      <CourtesyNegotiationStatus type="zero" agreedCount={0} acrossPartnerSeat="West" />
    );

    const element = screen.getByTestId('courtesy-negotiation-status');
    expect(element).toHaveClass('border-slate-500');
  });
});
