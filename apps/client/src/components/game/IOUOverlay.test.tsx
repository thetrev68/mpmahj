/**
 * IOUOverlay Component Tests
 *
 * Tests for the IOU scenario overlay that appears when all 4 players
 * attempt full blind pass (3 tiles each) during Charleston.
 *
 * Related: US-004 (Charleston First Left - Blind Pass), AC-10
 */

import { describe, expect, test } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { IOUOverlay } from './IOUOverlay';
import type { Seat } from '@/types/bindings/generated/Seat';

describe('IOUOverlay', () => {
  const defaultDebts: Array<[Seat, number]> = [
    ['East', 3],
    ['South', 3],
    ['West', 3],
    ['North', 3],
  ];

  describe('IOU detected state', () => {
    test('renders overlay with detection message', () => {
      renderWithProviders(<IOUOverlay debts={defaultDebts} resolved={false} />);

      expect(screen.getByTestId('iou-overlay')).toBeInTheDocument();
      expect(screen.getByText(/IOU Scenario Detected/i)).toBeInTheDocument();
    });

    test('displays all player debts', () => {
      renderWithProviders(<IOUOverlay debts={defaultDebts} resolved={false} />);

      expect(screen.getByTestId('iou-debt-East')).toHaveTextContent('3');
      expect(screen.getByTestId('iou-debt-South')).toHaveTextContent('3');
      expect(screen.getByTestId('iou-debt-West')).toHaveTextContent('3');
      expect(screen.getByTestId('iou-debt-North')).toHaveTextContent('3');
    });

    test('shows resolving spinner when not yet resolved', () => {
      renderWithProviders(<IOUOverlay debts={defaultDebts} resolved={false} />);

      expect(screen.getByTestId('iou-resolving-spinner')).toBeInTheDocument();
      expect(screen.getByText(/Resolving IOU/i)).toBeInTheDocument();
    });
  });

  describe('IOU resolved state', () => {
    test('shows resolution summary when resolved', () => {
      renderWithProviders(
        <IOUOverlay
          debts={defaultDebts}
          resolved={true}
          summary="IOU resolved - all players passed 2 tiles, East picked up final pass"
        />
      );

      expect(screen.getByTestId('iou-summary')).toHaveTextContent(
        'IOU resolved - all players passed 2 tiles, East picked up final pass'
      );
    });

    test('does not show spinner when resolved', () => {
      renderWithProviders(<IOUOverlay debts={defaultDebts} resolved={true} summary="Resolved." />);

      expect(screen.queryByTestId('iou-resolving-spinner')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    test('has appropriate aria attributes', () => {
      renderWithProviders(<IOUOverlay debts={defaultDebts} resolved={false} />);

      const overlay = screen.getByTestId('iou-overlay');
      expect(overlay).toHaveAttribute('role', 'alertdialog');
      expect(overlay).toHaveAttribute('aria-label', expect.stringContaining('IOU'));
    });
  });
});
