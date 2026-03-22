/**
 * Tests for CharlestonTracker Component
 *
 * User Story: US-002 (Charleston First Right), US-079 (Header Simplification)
 * Spec: docs/implementation/frontend/component-specs/game/CharlestonTracker.md
 *
 * Coverage:
 * - P0: Shows correct stage label and direction arrow
 * - P0: Shows progress indicator inline with direction (US-079 AC-1)
 * - P0: Aggregate ready count removed (US-079 AC-2)
 * - P0: Per-seat readiness at tertiary emphasis (US-079 AC-3)
 */

import { describe, expect, test } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { CharlestonTracker } from './CharlestonTracker';
import type { Seat } from '@/types/bindings/generated/Seat';

describe('CharlestonTracker Component', () => {
  describe('Stage Display - P0', () => {
    test('T-1: renders the tracker element for FirstRight stage', () => {
      renderWithProviders(<CharlestonTracker stage="FirstRight" readyPlayers={[]} />);

      const tracker = screen.getByTestId('charleston-tracker');

      expect(tracker).toBeInTheDocument();
      expect(tracker).toHaveAttribute('role', 'status');
      expect(tracker).toHaveAttribute('aria-label', 'Charleston: Pass Right');
    });

    test('T-2: removes legacy pill positioning and rounded styling', () => {
      renderWithProviders(<CharlestonTracker stage="FirstRight" readyPlayers={[]} />);

      const tracker = screen.getByTestId('charleston-tracker');

      expect(tracker).not.toHaveClass('rounded-lg');
      expect(tracker).not.toHaveClass('left-1/2');
    });

    test('T-3: applies the banner gradient and bottom border styles', () => {
      renderWithProviders(<CharlestonTracker stage="FirstRight" readyPlayers={[]} />);

      const tracker = screen.getByTestId('charleston-tracker');

      expect(tracker.getAttribute('style')).toContain('rgba(12, 35, 18');
      expect(tracker.getAttribute('style')).toContain('rgba(80, 160, 100');
    });

    test('retains the required banner layout classes', () => {
      renderWithProviders(<CharlestonTracker stage="FirstRight" readyPlayers={[]} />);

      const tracker = screen.getByTestId('charleston-tracker');

      expect(tracker).toHaveClass('flex');
      expect(tracker).toHaveClass('items-center');
      expect(tracker).toHaveClass('gap-4');
      expect(tracker).toHaveClass('px-6');
      expect(tracker).toHaveClass('py-2');
    });

    test('T-4: preserves core inner tracker test ids', () => {
      renderWithProviders(<CharlestonTracker stage="FirstRight" readyPlayers={[]} />);

      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/right/i);
      expect(screen.getByTestId('charleston-direction')).toHaveClass('tracking-wide');
      expect(screen.getByTestId('charleston-arrow')).toBeInTheDocument();
      expect(screen.getByTestId('charleston-progress')).toBeInTheDocument();
    });

    test('T-5: preserves ready indicators for all four seats', () => {
      renderWithProviders(<CharlestonTracker stage="FirstRight" readyPlayers={[]} />);

      expect(screen.getByTestId('ready-indicator-east')).toBeInTheDocument();
      expect(screen.getByTestId('ready-indicator-south')).toBeInTheDocument();
      expect(screen.getByTestId('ready-indicator-west')).toBeInTheDocument();
      expect(screen.getByTestId('ready-indicator-north')).toBeInTheDocument();
    });

    test('shows "Pass Across" with arrow for FirstAcross stage', () => {
      renderWithProviders(<CharlestonTracker stage="FirstAcross" readyPlayers={[]} />);

      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/across/i);
      expect(screen.getByTestId('charleston-arrow')).toHaveTextContent('\u2194');
    });

    test('shows "Pass Left" with arrow for FirstLeft stage', () => {
      renderWithProviders(<CharlestonTracker stage="FirstLeft" readyPlayers={[]} />);

      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/left/i);
      expect(screen.getByTestId('charleston-arrow')).toHaveTextContent('\u2190');
    });

    test('shows "Vote: Stop or Continue?" for VotingToContinue stage (US-005 AC-1)', () => {
      renderWithProviders(<CharlestonTracker stage="VotingToContinue" readyPlayers={[]} />);

      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/vote.*stop.*continue/i);
      expect(screen.getByTestId('charleston-arrow')).toHaveTextContent('?');
    });
  });

  describe('Hierarchy (US-079)', () => {
    test('AC-1: direction is primary — uses font-semibold at text-base', () => {
      renderWithProviders(<CharlestonTracker stage="FirstRight" readyPlayers={[]} />);

      const direction = screen.getByTestId('charleston-direction');
      expect(direction).toHaveClass('text-base');
      expect(direction).toHaveClass('font-semibold');
    });

    test('AC-1: arrow leads the direction group with font-bold', () => {
      renderWithProviders(<CharlestonTracker stage="FirstRight" readyPlayers={[]} />);

      const arrow = screen.getByTestId('charleston-arrow');
      expect(arrow).toHaveClass('text-lg');
      expect(arrow).toHaveClass('font-bold');
    });

    test('AC-2: aggregate ready count is removed', () => {
      renderWithProviders(
        <CharlestonTracker stage="FirstRight" readyPlayers={['East', 'South']} />
      );

      expect(screen.queryByTestId('ready-count')).not.toBeInTheDocument();
      expect(screen.queryByText('2/4 ready')).not.toBeInTheDocument();
    });

    test('AC-3: per-seat readiness uses tertiary styling', () => {
      renderWithProviders(<CharlestonTracker stage="FirstRight" readyPlayers={[]} />);

      const indicators = screen.getByTestId('ready-indicators');
      expect(indicators).toHaveClass('text-gray-400');
      expect(indicators).toHaveClass('text-[11px]');
    });

    test('AC-3: per-seat readiness shows abbreviated seat initials', () => {
      renderWithProviders(<CharlestonTracker stage="FirstRight" readyPlayers={['East']} />);

      const east = screen.getByTestId('ready-indicator-east');
      expect(east).toHaveTextContent('E');
      expect(east).toHaveTextContent('\u2713');

      const south = screen.getByTestId('ready-indicator-south');
      expect(south).toHaveTextContent('S');
      expect(south).toHaveTextContent('\u2022');
    });
  });

  describe('Player Ready Progress - P0', () => {
    test('shows bullet for unready seats', () => {
      renderWithProviders(<CharlestonTracker stage="FirstRight" readyPlayers={[]} />);

      expect(screen.getByTestId('ready-indicator-east')).toHaveTextContent('\u2022');
      expect(screen.getByTestId('ready-indicator-south')).toHaveTextContent('\u2022');
    });

    test('shows checkmark for ready seats', () => {
      const readyPlayers: Seat[] = ['East', 'South'];
      renderWithProviders(<CharlestonTracker stage="FirstRight" readyPlayers={readyPlayers} />);

      expect(screen.getByTestId('ready-indicator-east')).toHaveTextContent('\u2713');
      expect(screen.getByTestId('ready-indicator-south')).toHaveTextContent('\u2713');
      expect(screen.getByTestId('ready-indicator-west')).toHaveTextContent('\u2022');
    });

    test('all four seats show checkmark when all ready', () => {
      const readyPlayers: Seat[] = ['East', 'South', 'West', 'North'];
      renderWithProviders(<CharlestonTracker stage="FirstRight" readyPlayers={readyPlayers} />);

      expect(screen.getByTestId('ready-indicator-east')).toHaveTextContent('\u2713');
      expect(screen.getByTestId('ready-indicator-north')).toHaveTextContent('\u2713');
    });
  });

  describe('Waiting Message - P0', () => {
    test('shows waiting message when provided', () => {
      renderWithProviders(
        <CharlestonTracker
          stage="FirstRight"
          readyPlayers={['East', 'South']}
          waitingMessage="Waiting for other players..."
        />
      );

      expect(screen.getByText('Waiting for other players...')).toBeInTheDocument();
    });

    // VR-015 T-4: waitingMessage uses status message role color (AC-6)
    test('T-4 (VR-015): waitingMessage container has text-emerald-200 class', () => {
      renderWithProviders(
        <CharlestonTracker
          stage="FirstRight"
          readyPlayers={[]}
          waitingMessage="Waiting for bots..."
        />
      );

      expect(screen.getByText('Waiting for bots...')).toHaveClass('text-emerald-200');
    });
  });

  describe('Status Message - P0', () => {
    test('shows status message when provided', () => {
      renderWithProviders(
        <CharlestonTracker
          stage="FirstAcross"
          readyPlayers={[]}
          statusMessage="West (Bot) has passed tiles."
        />
      );

      expect(screen.getByTestId('charleston-status-message')).toHaveTextContent(
        'West (Bot) has passed tiles.'
      );
    });

    // VR-015 T-2: statusMessage uses italic (AC-5)
    test('T-2 (VR-015): charleston-status-message has italic class', () => {
      renderWithProviders(
        <CharlestonTracker
          stage="FirstAcross"
          readyPlayers={[]}
          statusMessage="West (Bot) has passed tiles."
        />
      );

      expect(screen.getByTestId('charleston-status-message')).toHaveClass('italic');
    });
  });

  describe('Edge Cases (US-079)', () => {
    test('EC-1: voting stage renders correctly without progress', () => {
      renderWithProviders(<CharlestonTracker stage="VotingToContinue" readyPlayers={[]} />);

      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/vote/i);
      expect(screen.queryByTestId('charleston-progress')).not.toBeInTheDocument();
    });

    test('EC-1: blind pass stage shows (Blind) label', () => {
      renderWithProviders(<CharlestonTracker stage="FirstLeft" readyPlayers={[]} />);

      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/blind/i);
    });

    test('EC-1: courtesy stage renders without progress', () => {
      renderWithProviders(<CharlestonTracker stage="CourtesyAcross" readyPlayers={[]} />);

      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/courtesy/i);
      expect(screen.queryByTestId('charleston-progress')).not.toBeInTheDocument();
    });
  });
});
