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
  canRevealBlind: false,
  incomingFromSeat: null,
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
  test('uses a board-local wrapper instead of viewport-fixed positioning', () => {
    renderWithProviders(<StagingStrip {...defaultProps} />);

    const strip = screen.getByTestId('staging-strip');
    expect(strip).toHaveClass('relative');
    expect(strip).not.toHaveClass('fixed');
  });

  test('keeps the desktop staging lane on one row without wrapping', () => {
    renderWithProviders(<StagingStrip {...defaultProps} />);

    const slotRow = screen.getByTestId('staging-strip').firstElementChild;
    expect(slotRow).toHaveClass('flex-nowrap');
    expect(slotRow).not.toHaveClass('flex-wrap');
  });

  test('renders incoming and outgoing lane slots with configured counts', () => {
    renderWithProviders(
      <StagingStrip
        {...defaultProps}
        incomingTiles={[
          { id: 'incoming-1', tile: 5 },
          { id: 'incoming-2', tile: 6 },
        ]}
        incomingSlotCount={2}
        outgoingSlotCount={4}
      />
    );

    expect(screen.getAllByTestId(/staging-incoming-slot-/)).toHaveLength(2);
    expect(screen.getAllByTestId(/staging-outgoing-slot-/)).toHaveLength(4);
  });

  test('keeps all six staging outlines visible when no incoming tiles are present', () => {
    renderWithProviders(
      <StagingStrip
        {...defaultProps}
        incomingSlotCount={3}
        outgoingSlotCount={3}
        outgoingTiles={[{ id: 'outgoing-1', tile: 7 }]}
      />
    );

    expect(screen.getAllByTestId(/staging-incoming-slot-/)).toHaveLength(3);
    expect(screen.getAllByTestId(/staging-outgoing-slot-/)).toHaveLength(3);
  });

  test('renders outgoing slots before empty incoming placeholders so the first staged tile starts at the first visible slot', () => {
    renderWithProviders(
      <StagingStrip
        {...defaultProps}
        incomingSlotCount={3}
        outgoingSlotCount={3}
        outgoingTiles={[{ id: 'outgoing-1', tile: 7 }]}
      />
    );

    expect(
      screen
        .getByTestId('staging-outgoing-slot-0')
        .querySelector('[data-testid="staging-outgoing-tile-outgoing-1"]')
    ).not.toBeNull();
    expect(
      screen.getByTestId('staging-strip').firstElementChild?.firstElementChild
    ).toHaveAttribute('data-testid', 'staging-outgoing-slot-0');
  });

  test('renders hidden blind incoming tile face-down with BLIND badge', () => {
    renderWithProviders(
      <StagingStrip
        {...defaultProps}
        blindIncoming={true}
        incomingTiles={[{ id: 'incoming-1', tile: 5, hidden: true }]}
        incomingSlotCount={1}
      />
    );

    expect(screen.getByTestId('staging-incoming-tile-incoming-1')).toHaveClass('tile-face-down');
    expect(screen.getByTestId('staging-incoming-badge-incoming-1')).toHaveTextContent('BLIND');
    expect(
      screen.getByRole('button', {
        name: /blind staged incoming tile unavailable until you stage a rack tile/i,
      })
    ).toBeInTheDocument();
  });

  test('does nothing when hidden blind incoming tile is clicked before reveal is allowed', async () => {
    const onAbsorbIncoming = vi.fn();
    const { user } = renderWithProviders(
      <StagingStrip
        {...defaultProps}
        blindIncoming={true}
        onAbsorbIncoming={onAbsorbIncoming}
        incomingTiles={[{ id: 'incoming-1', tile: 5, hidden: true }]}
        incomingSlotCount={1}
      />
    );

    await user.click(screen.getByTestId('staging-incoming-tile-incoming-1'));

    expect(onAbsorbIncoming).not.toHaveBeenCalled();
  });

  test('fires onAbsorbIncoming when hidden blind incoming tile is clicked after reveal is allowed', async () => {
    const onAbsorbIncoming = vi.fn();
    const { user } = renderWithProviders(
      <StagingStrip
        {...defaultProps}
        blindIncoming={true}
        canRevealBlind={true}
        onAbsorbIncoming={onAbsorbIncoming}
        incomingTiles={[{ id: 'incoming-1', tile: 5, hidden: true }]}
        incomingSlotCount={1}
      />
    );

    await user.click(screen.getByTestId('staging-incoming-tile-incoming-1'));

    expect(onAbsorbIncoming).toHaveBeenCalledWith('incoming-1');
  });

  test('keeps blind incoming tiles face-down on hover', async () => {
    const { user } = renderWithProviders(
      <StagingStrip
        {...defaultProps}
        blindIncoming={true}
        incomingTiles={[{ id: 'incoming-1', tile: 5, hidden: true }]}
        incomingSlotCount={1}
      />
    );

    const tile = screen.getByTestId('staging-incoming-tile-incoming-1');
    await user.hover(tile);

    expect(tile).toHaveClass('tile-face-down');
    expect(screen.getByTestId('staging-incoming-badge-incoming-1')).toHaveTextContent('BLIND');
  });

  test('renders non-blind incoming tiles face-up without blind controls', async () => {
    const onAbsorbIncoming = vi.fn();
    const { user } = renderWithProviders(
      <StagingStrip
        {...defaultProps}
        blindIncoming={false}
        onAbsorbIncoming={onAbsorbIncoming}
        incomingTiles={[{ id: 'incoming-1', tile: 5, hidden: true }]}
        incomingSlotCount={1}
      />
    );

    const tile = screen.getByTestId('staging-incoming-tile-incoming-1');
    expect(tile).not.toHaveClass('tile-face-down');
    expect(tile).toHaveAttribute('role', 'button');
    expect(screen.queryByTestId('staging-incoming-badge-incoming-1')).not.toBeInTheDocument();

    await user.click(tile);

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

  test('renders outgoing staging tile without selected glow state', () => {
    renderWithProviders(
      <StagingStrip
        {...defaultProps}
        outgoingTiles={[{ id: 'outgoing-1', tile: 7 }]}
        outgoingSlotCount={1}
      />
    );

    const tile = screen.getByTestId('staging-outgoing-tile-outgoing-1');
    expect(tile).toHaveClass('tile-default');
    expect(tile).not.toHaveClass('tile-selected');
  });

  test('fills outgoing slots from index 0 left-to-right', () => {
    renderWithProviders(
      <StagingStrip
        {...defaultProps}
        outgoingSlotCount={3}
        outgoingTiles={[{ id: 'outgoing-1', tile: 7 }]}
      />
    );

    expect(
      screen
        .getByTestId('staging-outgoing-slot-0')
        .querySelector('[data-testid^="staging-outgoing-tile-"]')
    ).not.toBeNull();
    expect(
      screen
        .getByTestId('staging-outgoing-slot-1')
        .querySelector('[data-testid^="staging-outgoing-tile-"]')
    ).toBeNull();
    expect(
      screen
        .getByTestId('staging-outgoing-slot-2')
        .querySelector('[data-testid^="staging-outgoing-tile-"]')
    ).toBeNull();
  });

  test('compacts remaining outgoing tiles leftward after deselection', () => {
    const { rerender } = renderWithProviders(
      <StagingStrip
        {...defaultProps}
        outgoingSlotCount={3}
        outgoingTiles={[
          { id: 'outgoing-1', tile: 7 },
          { id: 'outgoing-2', tile: 8 },
        ]}
      />
    );

    rerender(
      <StagingStrip
        {...defaultProps}
        outgoingSlotCount={3}
        outgoingTiles={[{ id: 'outgoing-2', tile: 8 }]}
      />
    );

    expect(
      screen
        .getByTestId('staging-outgoing-slot-0')
        .querySelector('[data-testid="staging-outgoing-tile-outgoing-2"]')
    ).not.toBeNull();
    expect(
      screen
        .getByTestId('staging-outgoing-slot-1')
        .querySelector('[data-testid^="staging-outgoing-tile-"]')
    ).toBeNull();
    expect(
      screen
        .getByTestId('staging-outgoing-slot-2')
        .querySelector('[data-testid^="staging-outgoing-tile-"]')
    ).toBeNull();
  });

  test('T-6: PASS button reflects the canCommitPass prop', () => {
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
        canCommitPass={false}
        canCommitCall={true}
        canCommitDiscard={true}
      />
    );

    expect(screen.getByTestId('staging-pass-button')).toBeDisabled();
    expect(screen.getByTestId('staging-call-button')).toBeEnabled();
    expect(screen.getByTestId('staging-discard-button')).toBeEnabled();
  });

  test('processing state disables all commit actions', () => {
    renderWithProviders(
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

  test('can hide staging action buttons and show claim candidate feedback', () => {
    renderWithProviders(
      <StagingStrip
        {...defaultProps}
        showActionButtons={false}
        claimCandidateState="valid"
        claimCandidateLabel="Pung ready"
        claimCandidateDetail="Press Proceed to call pung."
      />
    );

    expect(screen.queryByTestId('staging-pass-button')).not.toBeInTheDocument();
    expect(screen.getByTestId('staging-claim-candidate')).toBeInTheDocument();
    expect(screen.getByTestId('staging-claim-candidate-label')).toHaveTextContent('Pung ready');
    expect(screen.getByTestId('staging-claim-candidate-detail')).toHaveTextContent(
      'Press Proceed to call pung.'
    );
  });

  test('T-1: incoming tile with incomingFromSeat gets tile-enter-from-east on wrapper', () => {
    renderWithProviders(
      <StagingStrip
        {...defaultProps}
        incomingTiles={[{ id: 'inc-1', tile: 5 }]}
        incomingSlotCount={1}
        incomingFromSeat="East"
      />
    );

    expect(screen.getByTestId('staging-incoming-tile-wrapper-inc-1')).toHaveClass(
      'tile-enter-from-east'
    );
  });

  test('T-2: incoming tile with incomingFromSeat=null gets no seat class on wrapper', () => {
    renderWithProviders(
      <StagingStrip
        {...defaultProps}
        incomingTiles={[{ id: 'inc-1', tile: 5 }]}
        incomingSlotCount={1}
        incomingFromSeat={null}
      />
    );

    const wrapper = screen.getByTestId('staging-incoming-tile-wrapper-inc-1');
    expect(wrapper).not.toHaveClass('tile-enter-from-east');
    expect(wrapper).not.toHaveClass('tile-enter-from-south');
    expect(wrapper).not.toHaveClass('tile-enter-from-west');
    expect(wrapper).not.toHaveClass('tile-enter-from-north');
  });

  test('T-3: blind incoming tile receives wrapper class when seat is provided', () => {
    renderWithProviders(
      <StagingStrip
        {...defaultProps}
        blindIncoming={true}
        incomingTiles={[{ id: 'inc-1', tile: 5, hidden: true }]}
        incomingSlotCount={1}
        incomingFromSeat="North"
      />
    );

    expect(screen.getByTestId('staging-incoming-tile-wrapper-inc-1')).toHaveClass(
      'tile-enter-from-north'
    );
  });

  test('T-3b: revealed blind incoming tile also receives wrapper class', () => {
    renderWithProviders(
      <StagingStrip
        {...defaultProps}
        blindIncoming={true}
        incomingTiles={[{ id: 'inc-1', tile: 5, hidden: false }]}
        incomingSlotCount={1}
        incomingFromSeat="West"
      />
    );

    expect(screen.getByTestId('staging-incoming-tile-wrapper-inc-1')).toHaveClass(
      'tile-enter-from-west'
    );
  });

  test('AC-3b: entry class is not re-applied when same tile stays in slot and incomingFromSeat fires again', () => {
    const { rerender } = renderWithProviders(
      <StagingStrip
        {...defaultProps}
        incomingTiles={[{ id: 'inc-1', tile: 5 }]}
        incomingSlotCount={1}
        incomingFromSeat="East"
      />
    );

    // Entry class applied on initial fill
    expect(screen.getByTestId('staging-incoming-tile-wrapper-inc-1')).toHaveClass(
      'tile-enter-from-east'
    );

    // incomingFromSeat auto-clears
    rerender(
      <StagingStrip
        {...defaultProps}
        incomingTiles={[{ id: 'inc-1', tile: 5 }]}
        incomingSlotCount={1}
        incomingFromSeat={null}
      />
    );

    expect(screen.getByTestId('staging-incoming-tile-wrapper-inc-1')).not.toHaveClass(
      'tile-enter-from-east'
    );

    // incomingFromSeat fires again while the same tile is still in the slot
    rerender(
      <StagingStrip
        {...defaultProps}
        incomingTiles={[{ id: 'inc-1', tile: 5 }]}
        incomingSlotCount={1}
        incomingFromSeat="East"
      />
    );

    // Must NOT re-apply — AC-3: only on initial slot fill transition
    expect(screen.getByTestId('staging-incoming-tile-wrapper-inc-1')).not.toHaveClass(
      'tile-enter-from-east'
    );
  });

  test('AC-3: wrapper loses seat class when incomingFromSeat clears', () => {
    const { rerender } = renderWithProviders(
      <StagingStrip
        {...defaultProps}
        incomingTiles={[{ id: 'inc-1', tile: 5 }]}
        incomingSlotCount={1}
        incomingFromSeat="East"
      />
    );

    expect(screen.getByTestId('staging-incoming-tile-wrapper-inc-1')).toHaveClass(
      'tile-enter-from-east'
    );

    rerender(
      <StagingStrip
        {...defaultProps}
        incomingTiles={[{ id: 'inc-1', tile: 5 }]}
        incomingSlotCount={1}
        incomingFromSeat={null}
      />
    );

    const wrapper = screen.getByTestId('staging-incoming-tile-wrapper-inc-1');
    expect(wrapper).not.toHaveClass('tile-enter-from-east');
    expect(wrapper).not.toHaveClass('tile-enter-from-south');
    expect(wrapper).not.toHaveClass('tile-enter-from-west');
    expect(wrapper).not.toHaveClass('tile-enter-from-north');
  });
});
