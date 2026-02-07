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
    test('shows "Pass Right" with arrow for FirstRight stage', () => {
      renderWithProviders(<CharlestonTracker stage="FirstRight" readyPlayers={[]} />);

      expect(screen.getByTestId('charleston-tracker')).toBeInTheDocument();
      expect(screen.getByTestId('charleston-direction')).toHaveTextContent(/right/i);
      expect(screen.getByTestId('charleston-arrow')).toHaveTextContent('→');
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
  });
});
