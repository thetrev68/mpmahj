/**
 * BlindPassPanel Component Tests
 *
 * Tests for the blind pass slider/control used during Charleston FirstLeft
 * (and SecondRight) stages.
 *
 * Related: US-004 (Charleston First Left - Blind Pass)
 */

import { describe, expect, test, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { renderWithProviders, screen } from '@/test/test-utils';
import { BlindPassPanel } from './BlindPassPanel';

describe('BlindPassPanel', () => {
  const defaultProps = {
    blindCount: 0,
    onBlindCountChange: vi.fn(),
    handSelectionCount: 0,
    totalRequired: 3,
    disabled: false,
  };

  describe('rendering', () => {
    test('renders with default blind count of 0', () => {
      renderWithProviders(<BlindPassPanel {...defaultProps} />);

      expect(screen.getByTestId('blind-pass-panel')).toBeInTheDocument();
      expect(screen.getByTestId('blind-count-display')).toHaveTextContent('0');
      expect(screen.getByTestId('blind-pass-label')).toHaveTextContent('Pass 0 tiles blindly');
      expect(screen.getByTestId('blind-pass-slider')).toBeInTheDocument();
    });

    test('shows total counter breakdown when blind count > 0', () => {
      renderWithProviders(
        <BlindPassPanel {...defaultProps} blindCount={2} handSelectionCount={1} />
      );

      expect(screen.getByTestId('total-counter')).toHaveTextContent('1 hand + 2 blind = 3 total');
    });

    test('shows standard counter when blind count is 0', () => {
      renderWithProviders(
        <BlindPassPanel {...defaultProps} blindCount={0} handSelectionCount={2} />
      );

      // When blindCount is 0, no mixed breakdown needed
      expect(screen.queryByTestId('total-counter')).not.toBeInTheDocument();
    });

    test('shows warning when blind count is 3', () => {
      renderWithProviders(<BlindPassPanel {...defaultProps} blindCount={3} />);

      expect(screen.getByTestId('blind-pass-warning')).toHaveTextContent(/IOU/i);
    });

    test('does not show warning when blind count < 3', () => {
      renderWithProviders(<BlindPassPanel {...defaultProps} blindCount={2} />);

      expect(screen.queryByTestId('blind-pass-warning')).not.toBeInTheDocument();
    });
  });

  describe('interaction', () => {
    test('increment button increases blind count', async () => {
      const onChange = vi.fn();
      const { user } = renderWithProviders(
        <BlindPassPanel {...defaultProps} blindCount={0} onBlindCountChange={onChange} />
      );

      await user.click(screen.getByTestId('blind-increment'));
      expect(onChange).toHaveBeenCalledWith(1);
    });

    test('slider emits updated blind count', async () => {
      const onChange = vi.fn();
      renderWithProviders(
        <BlindPassPanel {...defaultProps} blindCount={0} onBlindCountChange={onChange} />
      );

      const sliderThumb = screen.getByRole('slider');
      fireEvent.keyDown(sliderThumb, { key: 'ArrowRight' });
      fireEvent.keyDown(sliderThumb, { key: 'ArrowRight' });
      expect(onChange).toHaveBeenCalled();
      expect(onChange).toHaveBeenLastCalledWith(1);
    });

    test('decrement button decreases blind count', async () => {
      const onChange = vi.fn();
      const { user } = renderWithProviders(
        <BlindPassPanel {...defaultProps} blindCount={2} onBlindCountChange={onChange} />
      );

      await user.click(screen.getByTestId('blind-decrement'));
      expect(onChange).toHaveBeenCalledWith(1);
    });

    test('increment is disabled at max (3)', () => {
      renderWithProviders(<BlindPassPanel {...defaultProps} blindCount={3} />);

      expect(screen.getByTestId('blind-increment')).toBeDisabled();
    });

    test('decrement is disabled at min (0)', () => {
      renderWithProviders(<BlindPassPanel {...defaultProps} blindCount={0} />);

      expect(screen.getByTestId('blind-decrement')).toBeDisabled();
    });

    test('all controls disabled when disabled prop is true', () => {
      renderWithProviders(<BlindPassPanel {...defaultProps} blindCount={1} disabled={true} />);

      expect(screen.getByTestId('blind-increment')).toBeDisabled();
      expect(screen.getByTestId('blind-decrement')).toBeDisabled();
    });
  });

  describe('validation display', () => {
    test('shows correct remaining hand tiles needed', () => {
      // 2 blind means need 1 from hand
      renderWithProviders(
        <BlindPassPanel {...defaultProps} blindCount={2} handSelectionCount={0} />
      );

      expect(screen.getByTestId('hand-tiles-needed')).toHaveTextContent('1');
    });

    test('shows 0 hand tiles needed when full blind', () => {
      renderWithProviders(
        <BlindPassPanel {...defaultProps} blindCount={3} handSelectionCount={0} />
      );

      expect(screen.getByTestId('hand-tiles-needed')).toHaveTextContent('0');
    });

    test('shows 3 hand tiles needed when no blind', () => {
      renderWithProviders(
        <BlindPassPanel {...defaultProps} blindCount={0} handSelectionCount={0} />
      );

      expect(screen.getByTestId('hand-tiles-needed')).toHaveTextContent('3');
    });
  });
});
