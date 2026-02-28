/**
 * Tests for CharlestonTracker Component
 *
 * User Story: US-002 - Charleston First Right
 * Spec: docs/implementation/frontend/component-specs/game/CharlestonTracker.md
 *
 * Coverage:
 * - P0: Shows correct stage label and direction arrow
 * - P0: Shows progress indicator for ready players
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
      expect(tracker).toHaveClass('py-3');
    });

    test('T-4: preserves core inner tracker test ids', () => {
      renderWithProviders(<CharlestonTracker stage="FirstRight" readyPlayers={[]} />);

      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/right/i);
      expect(screen.getByTestId('charleston-arrow')).toHaveTextContent('→');
      expect(screen.getByTestId('charleston-progress')).toBeInTheDocument();
      expect(screen.getByTestId('ready-count')).toBeInTheDocument();
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
      expect(screen.getByTestId('charleston-arrow')).toHaveTextContent('↔');
    });

    test('shows "Pass Left" with arrow for FirstLeft stage', () => {
      renderWithProviders(<CharlestonTracker stage="FirstLeft" readyPlayers={[]} />);

      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/left/i);
      expect(screen.getByTestId('charleston-arrow')).toHaveTextContent('←');
    });

    test('shows "Vote: Stop or Continue?" for VotingToContinue stage (US-005 AC-1)', () => {
      renderWithProviders(<CharlestonTracker stage="VotingToContinue" readyPlayers={[]} />);

      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/vote.*stop.*continue/i);
      expect(screen.getByTestId('charleston-arrow')).toHaveTextContent('?');
    });
  });

  describe('Player Ready Progress - P0', () => {
    test('shows 0/4 when no players are ready', () => {
      renderWithProviders(<CharlestonTracker stage="FirstRight" readyPlayers={[]} />);

      expect(screen.getByTestId('ready-count')).toHaveTextContent('0/4');
      expect(screen.getByTestId('ready-indicator-east')).toHaveTextContent('•');
      expect(screen.getByTestId('ready-indicator-south')).toHaveTextContent('•');
    });

    test('shows 2/4 when 2 players are ready', () => {
      const readyPlayers: Seat[] = ['East', 'South'];
      renderWithProviders(<CharlestonTracker stage="FirstRight" readyPlayers={readyPlayers} />);

      expect(screen.getByTestId('ready-count')).toHaveTextContent('2/4');
      expect(screen.getByTestId('ready-indicator-east')).toHaveTextContent('✓');
      expect(screen.getByTestId('ready-indicator-south')).toHaveTextContent('✓');
      expect(screen.getByTestId('ready-indicator-west')).toHaveTextContent('•');
    });

    test('shows 4/4 when all players are ready', () => {
      const readyPlayers: Seat[] = ['East', 'South', 'West', 'North'];
      renderWithProviders(<CharlestonTracker stage="FirstRight" readyPlayers={readyPlayers} />);

      expect(screen.getByTestId('ready-count')).toHaveTextContent('4/4');
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
});
