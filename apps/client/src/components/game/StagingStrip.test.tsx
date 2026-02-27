import { describe, expect, test, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { StagingStrip, type StagingStripProps } from './StagingStrip';

const defaultProps: StagingStripProps = {
  incomingTiles: [],
  outgoingTiles: [],
  incomingSlotCount: 3,
  outgoingSlotCount: 3,
  blindIncoming: false,
  incomingFromSeat: null,
  onFlipIncoming: vi.fn(),
  onAbsorbIncoming: vi.fn(),
  onRemoveOutgoing: vi.fn(),
  onCommitPass: vi.fn(),
  onCommitCall: vi.fn(),
  onCommitDiscard: vi.fn(),
  canCommitPass: false,
  canCommitCall: false,
  canCommitDiscard: false,
  isProcessing: false,
};

describe('StagingStrip', () => {
  test('renders incoming and outgoing lane slots with configured counts', () => {
    renderWithProviders(
      <StagingStrip {...defaultProps} incomingSlotCount={2} outgoingSlotCount={4} />
    );

    expect(screen.getAllByTestId(/staging-incoming-slot-/)).toHaveLength(2);
    expect(screen.getAllByTestId(/staging-outgoing-slot-/)).toHaveLength(4);
  });

  test('renders incoming hidden tile with flip affordance when tile.hidden is true', () => {
    renderWithProviders(
      <StagingStrip
        {...defaultProps}
        blindIncoming={true}
        incomingTiles={[{ id: 'incoming-1', tile: 5, hidden: true }]}
        incomingSlotCount={1}
      />
    );

    // StagingStrip sets ariaLabel='Flip staged incoming tile' when hidden=true.
    // This asserts the strip's own label logic rather than Tile's CSS internals.
    expect(screen.getByRole('button', { name: /flip staged incoming tile/i })).toBeInTheDocument();
  });

  test('fires onFlipIncoming when hidden incoming tile is clicked', async () => {
    const onFlipIncoming = vi.fn();
    const { user } = renderWithProviders(
      <StagingStrip
        {...defaultProps}
        onFlipIncoming={onFlipIncoming}
        incomingTiles={[{ id: 'incoming-1', tile: 5, hidden: true }]}
        incomingSlotCount={1}
      />
    );

    await user.click(screen.getByTestId('staging-incoming-tile-incoming-1'));

    expect(onFlipIncoming).toHaveBeenCalledWith('incoming-1');
  });

  test('fires onAbsorbIncoming when revealed incoming tile is clicked', async () => {
    const onAbsorbIncoming = vi.fn();
    const { user } = renderWithProviders(
      <StagingStrip
        {...defaultProps}
        onAbsorbIncoming={onAbsorbIncoming}
        incomingTiles={[{ id: 'incoming-1', tile: 5, hidden: false }]}
        incomingSlotCount={1}
      />
    );

    await user.click(screen.getByTestId('staging-incoming-tile-incoming-1'));

    expect(onAbsorbIncoming).toHaveBeenCalledWith('incoming-1');
  });

  test('fires onRemoveOutgoing when outgoing tile is clicked', async () => {
    const onRemoveOutgoing = vi.fn();
    const { user } = renderWithProviders(
      <StagingStrip
        {...defaultProps}
        onRemoveOutgoing={onRemoveOutgoing}
        outgoingTiles={[{ id: 'outgoing-1', tile: 7 }]}
        outgoingSlotCount={1}
      />
    );

    await user.click(screen.getByTestId('staging-outgoing-tile-outgoing-1'));

    expect(onRemoveOutgoing).toHaveBeenCalledWith('outgoing-1');
  });

  test('commit button disabled state follows canCommit flags and isProcessing', () => {
    const { rerender } = renderWithProviders(
      <StagingStrip
        {...defaultProps}
        canCommitPass={true}
        canCommitCall={true}
        canCommitDiscard={true}
      />
    );

    expect(screen.getByTestId('staging-pass-button')).toBeEnabled();
    expect(screen.getByTestId('staging-call-button')).toBeEnabled();
    expect(screen.getByTestId('staging-discard-button')).toBeEnabled();

    rerender(
      <StagingStrip
        {...defaultProps}
        canCommitPass={true}
        canCommitCall={true}
        canCommitDiscard={true}
        isProcessing={true}
      />
    );

    expect(screen.getByTestId('staging-pass-button')).toBeDisabled();
    expect(screen.getByTestId('staging-call-button')).toBeDisabled();
    expect(screen.getByTestId('staging-discard-button')).toBeDisabled();
  });
});
