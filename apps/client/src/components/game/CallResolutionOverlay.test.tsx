/**
 * CallResolutionOverlay Component Tests
 *
 * Tests for US-012: Call Priority Resolution
 * Related ACs: AC-1, AC-2, AC-3, AC-4
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CallResolutionOverlay } from './CallResolutionOverlay';
import type { CallResolution } from '@/types/bindings/generated/CallResolution';
import type { CallTieBreakReason } from '@/types/bindings/generated/CallTieBreakReason';
import type { CallIntentSummary } from '@/types/bindings/generated/CallIntentSummary';

describe('CallResolutionOverlay', () => {
  describe('AC-1: Priority Rule Display', () => {
    it('displays priority rules when resolution is shown', () => {
      const resolution: CallResolution = { Mahjong: 'South' };
      const allCallers: CallIntentSummary[] = [
        { seat: 'South', kind: 'Mahjong' },
        { seat: 'West', kind: { Meld: { meld_type: 'Pung' } } },
      ];

      render(
        <CallResolutionOverlay
          resolution={resolution}
          tieBreak={null}
          allCallers={allCallers}
          discardedBy="North"
          onDismiss={() => {}}
        />
      );

      // Should show priority rules
      expect(screen.getByText(/Priority Rules:/i)).toBeInTheDocument();
      expect(screen.getByText(/Mahjong beats Pung\/Kong\/Quint/i)).toBeInTheDocument();
      expect(screen.getByText(/closest player to discarder wins/i)).toBeInTheDocument();
    });

    it('shows overlay as a dialog with proper accessibility', () => {
      const resolution: CallResolution = { Mahjong: 'South' };

      render(
        <CallResolutionOverlay
          resolution={resolution}
          tieBreak={null}
          allCallers={[]}
          discardedBy="North"
          onDismiss={() => {}}
        />
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-label', 'Call resolution');
    });
  });

  describe('AC-2: Mahjong Beats Meld', () => {
    it('shows "South wins: Mahjong beats Pung" when Mahjong wins over Pung', () => {
      const resolution: CallResolution = { Mahjong: 'South' };
      const allCallers: CallIntentSummary[] = [
        { seat: 'South', kind: 'Mahjong' },
        { seat: 'West', kind: { Meld: { meld_type: 'Pung' } } },
      ];

      render(
        <CallResolutionOverlay
          resolution={resolution}
          tieBreak={null}
          allCallers={allCallers}
          discardedBy="North"
          onDismiss={() => {}}
        />
      );

      // Check for the resolution message specifically (not priority rules)
      expect(screen.getByText(/South wins: Mahjong beats Pung/i)).toBeInTheDocument();
    });

    it('shows "East wins: Mahjong beats Kong" when Mahjong wins over Kong', () => {
      const resolution: CallResolution = { Mahjong: 'East' };
      const allCallers: CallIntentSummary[] = [
        { seat: 'East', kind: 'Mahjong' },
        { seat: 'South', kind: { Meld: { meld_type: 'Kong' } } },
      ];

      render(
        <CallResolutionOverlay
          resolution={resolution}
          tieBreak={null}
          allCallers={allCallers}
          discardedBy="North"
          onDismiss={() => {}}
        />
      );

      expect(screen.getByText(/East wins/i)).toBeInTheDocument();
      expect(screen.getByText(/Mahjong beats Kong/i)).toBeInTheDocument();
    });

    it('displays all callers with their intent types', () => {
      const resolution: CallResolution = { Mahjong: 'South' };
      const allCallers: CallIntentSummary[] = [
        { seat: 'South', kind: 'Mahjong' },
        { seat: 'West', kind: { Meld: { meld_type: 'Pung' } } },
        { seat: 'North', kind: { Meld: { meld_type: 'Kong' } } },
      ];

      render(
        <CallResolutionOverlay
          resolution={resolution}
          tieBreak={null}
          allCallers={allCallers}
          discardedBy="East"
          onDismiss={() => {}}
        />
      );

      // All callers should be listed - use more specific queries
      expect(screen.getByText('All Callers:')).toBeInTheDocument();
      expect(screen.getByText(/South: Mahjong ✓/i)).toBeInTheDocument();
      expect(screen.getByText(/West: Pung/i)).toBeInTheDocument();
      expect(screen.getByText(/North: Kong/i)).toBeInTheDocument();
    });
  });

  describe('AC-3: Closest Player Wins (Meld Tie)', () => {
    it('shows "South wins: Closest to discarder" when tie-break by seat order (meld)', () => {
      const resolution: CallResolution = {
        Meld: {
          seat: 'South',
          meld: {
            meld_type: 'Pung',
            tiles: [22, 22, 22],
            called_tile: 22,
            joker_assignments: {},
          },
        },
      };
      const tieBreak: CallTieBreakReason = {
        SeatOrder: {
          discarded_by: 'East',
          contenders: ['South', 'West'],
        },
      };
      const allCallers: CallIntentSummary[] = [
        { seat: 'South', kind: { Meld: { meld_type: 'Pung' } } },
        { seat: 'West', kind: { Meld: { meld_type: 'Pung' } } },
      ];

      render(
        <CallResolutionOverlay
          resolution={resolution}
          tieBreak={tieBreak}
          allCallers={allCallers}
          discardedBy="East"
          onDismiss={() => {}}
        />
      );

      expect(screen.getByText(/South wins/i)).toBeInTheDocument();
      expect(screen.getByText(/Closest to discarder/i)).toBeInTheDocument();
    });

    it('lists contenders who were tied', () => {
      const resolution: CallResolution = {
        Meld: {
          seat: 'South',
          meld: {
            meld_type: 'Kong',
            tiles: [22, 22, 22, 22],
            called_tile: 22,
            joker_assignments: {},
          },
        },
      };
      const tieBreak: CallTieBreakReason = {
        SeatOrder: {
          discarded_by: 'East',
          contenders: ['South', 'West', 'North'],
        },
      };
      const allCallers: CallIntentSummary[] = [
        { seat: 'South', kind: { Meld: { meld_type: 'Kong' } } },
        { seat: 'West', kind: { Meld: { meld_type: 'Kong' } } },
        { seat: 'North', kind: { Meld: { meld_type: 'Kong' } } },
      ];

      render(
        <CallResolutionOverlay
          resolution={resolution}
          tieBreak={tieBreak}
          allCallers={allCallers}
          discardedBy="East"
          onDismiss={() => {}}
        />
      );

      // Should show contenders (South, West, North tied for Kong)
      expect(screen.getByText(/Tied contenders:.*South, West, North/i)).toBeInTheDocument();
    });
  });

  describe('AC-4: Closest Player Wins (Mahjong Tie)', () => {
    it('shows "South wins: Both Mahjong, South is closer" when multiple Mahjong calls', () => {
      const resolution: CallResolution = { Mahjong: 'South' };
      const tieBreak: CallTieBreakReason = {
        SeatOrder: {
          discarded_by: 'East',
          contenders: ['South', 'North'],
        },
      };
      const allCallers: CallIntentSummary[] = [
        { seat: 'South', kind: 'Mahjong' },
        { seat: 'North', kind: 'Mahjong' },
      ];

      render(
        <CallResolutionOverlay
          resolution={resolution}
          tieBreak={tieBreak}
          allCallers={allCallers}
          discardedBy="East"
          onDismiss={() => {}}
        />
      );

      expect(screen.getByText(/South wins/i)).toBeInTheDocument();
      expect(screen.getByText(/Both.*Mahjong.*closer/i)).toBeInTheDocument();
    });

    it('handles three-way Mahjong tie correctly', () => {
      const resolution: CallResolution = { Mahjong: 'South' };
      const tieBreak: CallTieBreakReason = {
        SeatOrder: {
          discarded_by: 'East',
          contenders: ['South', 'West', 'North'],
        },
      };
      const allCallers: CallIntentSummary[] = [
        { seat: 'South', kind: 'Mahjong' },
        { seat: 'West', kind: 'Mahjong' },
        { seat: 'North', kind: 'Mahjong' },
      ];

      render(
        <CallResolutionOverlay
          resolution={resolution}
          tieBreak={tieBreak}
          allCallers={allCallers}
          discardedBy="East"
          onDismiss={() => {}}
        />
      );

      expect(screen.getByText(/South wins/i)).toBeInTheDocument();
      expect(screen.getByText(/Multiple.*Mahjong.*closer/i)).toBeInTheDocument();
    });
  });

  describe('User Interactions', () => {
    it('calls onDismiss when dismiss button clicked', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      const resolution: CallResolution = { Mahjong: 'South' };

      render(
        <CallResolutionOverlay
          resolution={resolution}
          tieBreak={null}
          allCallers={[]}
          discardedBy="North"
          onDismiss={onDismiss}
        />
      );

      const dismissButton = screen.getByRole('button', { name: /continue/i });
      await user.click(dismissButton);

      expect(onDismiss).toHaveBeenCalledOnce();
    });

    it('supports keyboard navigation (Enter/Escape to dismiss)', async () => {
      const user = userEvent.setup();
      const onDismiss = vi.fn();
      const resolution: CallResolution = { Mahjong: 'South' };

      render(
        <CallResolutionOverlay
          resolution={resolution}
          tieBreak={null}
          allCallers={[]}
          discardedBy="North"
          onDismiss={onDismiss}
        />
      );

      const dialog = screen.getByRole('dialog');
      dialog.focus();

      // Press Escape to dismiss
      await user.keyboard('{Escape}');
      expect(onDismiss).toHaveBeenCalledOnce();
    });
  });

  describe('Edge Cases', () => {
    it('handles NoCall resolution gracefully (should not render)', () => {
      const resolution: CallResolution = 'NoCall';

      const { container } = render(
        <CallResolutionOverlay
          resolution={resolution}
          tieBreak={null}
          allCallers={[]}
          discardedBy="East"
          onDismiss={() => {}}
        />
      );

      // Should render nothing for NoCall
      expect(container.firstChild).toBeNull();
    });

    it('handles single caller (no competition) correctly', () => {
      const resolution: CallResolution = {
        Meld: {
          seat: 'West',
          meld: {
            meld_type: 'Pung',
            tiles: [15, 15, 15],
            called_tile: 15,
            joker_assignments: {},
          },
        },
      };
      const allCallers: CallIntentSummary[] = [
        { seat: 'West', kind: { Meld: { meld_type: 'Pung' } } },
      ];

      render(
        <CallResolutionOverlay
          resolution={resolution}
          tieBreak={null}
          allCallers={allCallers}
          discardedBy="South"
          onDismiss={() => {}}
        />
      );

      expect(screen.getByText(/West wins: Meld/i)).toBeInTheDocument();
      // Priority rules should still be shown
      expect(screen.getByText(/Priority Rules:/i)).toBeInTheDocument();
      // Should not show tie-break details section
      expect(screen.queryByText(/Tie-Break:/i)).not.toBeInTheDocument();
    });

    it('handles empty allCallers array (edge case)', () => {
      const resolution: CallResolution = { Mahjong: 'North' };

      render(
        <CallResolutionOverlay
          resolution={resolution}
          tieBreak={null}
          allCallers={[]}
          discardedBy="East"
          onDismiss={() => {}}
        />
      );

      expect(screen.getByText(/North wins/i)).toBeInTheDocument();
    });
  });
});
