import { describe, expect, test, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { StagingStrip, type StagingStripProps } from './StagingStrip';

const defaultProps: StagingStripProps = {
  incomingTiles: [],
  outgoingTiles: [],
  slotCount: 6,
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

  test('caps the strip to a computed 6-slot width and removes horizontal scrolling', () => {
    renderWithProviders(<StagingStrip {...defaultProps} />);

    const strip = screen.getByTestId('staging-strip');
    const viewport = screen.getByTestId('staging-slot-viewport');
    const row = screen.getByTestId('staging-slot-row');

    expect(strip).not.toHaveClass('w-fit');
    expect(strip).toHaveClass('overflow-visible');
    expect(strip.getAttribute('style')).toContain(
      '--staging-slot-width: 63px; --staging-slot-height: 90px; --staging-slot-gap: 8px; --staging-strip-padding: 16px; --staging-slot-count: 6;'
    );
    expect(strip).toHaveStyle({
      maxWidth:
        'calc(calc(6 * var(--staging-slot-width) + (6 - 1) * var(--staging-slot-gap)) + 2 * var(--staging-strip-padding))',
    });
    expect(viewport).toHaveClass('overflow-visible');
    expect(row.style.width).toBe(
      'calc(6 * var(--staging-slot-width) + (6 - 1) * var(--staging-slot-gap))'
    );
  });

  test('keeps the rightmost slot path free of clipping overflow classes', () => {
    renderWithProviders(
      <StagingStrip
        {...defaultProps}
        outgoingTiles={[
          { id: 'outgoing-1', tile: 7 },
          { id: 'outgoing-2', tile: 8 },
          { id: 'outgoing-3', tile: 9 },
          { id: 'outgoing-4', tile: 10 },
          { id: 'outgoing-5', tile: 11 },
          { id: 'outgoing-6', tile: 12 },
        ]}
      />
    );

    expect(screen.getByTestId('staging-strip')).not.toHaveClass('overflow-hidden');
    expect(screen.getByTestId('staging-slot-viewport')).not.toHaveClass(
      'overflow-hidden',
      'overflow-x-hidden',
      'overflow-x-clip'
    );
    expect(screen.getByTestId('staging-slot-5')).toHaveAttribute('data-slot-kind', 'outgoing');
  });

  test('always renders exactly 6 visible slots', () => {
    renderWithProviders(
      <StagingStrip
        {...defaultProps}
        incomingTiles={[{ id: 'incoming-1', tile: 5 }]}
        outgoingTiles={[{ id: 'outgoing-1', tile: 7 }]}
      />
    );

    expect(screen.getAllByTestId(/staging-slot-/)).toHaveLength(8);
    expect(screen.getAllByTestId(/staging-slot-\d$/)).toHaveLength(6);
  });

  test('keeps all 6 slot outlines visible when only one tile is staged', () => {
    renderWithProviders(
      <StagingStrip {...defaultProps} outgoingTiles={[{ id: 'outgoing-1', tile: 7 }]} />
    );

    expect(screen.getAllByTestId(/staging-slot-\d$/)).toHaveLength(6);
    expect(screen.getByTestId('staging-slot-0').getAttribute('data-slot-kind')).toBe('outgoing');
    expect(screen.getByTestId('staging-slot-5').getAttribute('data-slot-kind')).toBe('empty');
  });

  test('renders mixed incoming and outgoing tiles within the same 6-slot strip', () => {
    renderWithProviders(
      <StagingStrip
        {...defaultProps}
        incomingTiles={[
          { id: 'incoming-1', tile: 5 },
          { id: 'incoming-2', tile: 6 },
        ]}
        outgoingTiles={[
          { id: 'outgoing-1', tile: 7 },
          { id: 'outgoing-2', tile: 8 },
          { id: 'outgoing-3', tile: 9 },
          { id: 'outgoing-4', tile: 10 },
        ]}
      />
    );

    expect(screen.getByTestId('staging-slot-0')).toHaveAttribute('data-slot-kind', 'incoming');
    expect(screen.getByTestId('staging-slot-1')).toHaveAttribute('data-slot-kind', 'incoming');
    expect(screen.getByTestId('staging-slot-2')).toHaveAttribute('data-slot-kind', 'outgoing');
    expect(screen.getByTestId('staging-slot-5')).toHaveAttribute('data-slot-kind', 'outgoing');
  });

  test('renders outgoing tiles first when there are no incoming tiles so staging stays contiguous from slot 0', () => {
    renderWithProviders(
      <StagingStrip {...defaultProps} outgoingTiles={[{ id: 'outgoing-1', tile: 7 }]} />
    );

    expect(
      screen
        .getByTestId('staging-slot-0')
        .querySelector('[data-testid="staging-outgoing-tile-outgoing-1"]')
    ).not.toBeNull();
    expect(screen.getByTestId('staging-slot-row').firstElementChild).toHaveAttribute(
      'data-testid',
      'staging-slot-0'
    );
  });

  test('compacts remaining outgoing tiles leftward after deselection', () => {
    const { rerender } = renderWithProviders(
      <StagingStrip
        {...defaultProps}
        outgoingTiles={[
          { id: 'outgoing-1', tile: 7 },
          { id: 'outgoing-2', tile: 8 },
        ]}
      />
    );

    rerender(<StagingStrip {...defaultProps} outgoingTiles={[{ id: 'outgoing-2', tile: 8 }]} />);

    expect(
      screen
        .getByTestId('staging-slot-0')
        .querySelector('[data-testid="staging-outgoing-tile-outgoing-2"]')
    ).not.toBeNull();
    expect(
      screen.getByTestId('staging-slot-1').querySelector('[data-testid^="staging-outgoing-tile-"]')
    ).toBeNull();
  });

  test('renders hidden blind incoming tile face-down with BLIND badge', () => {
    renderWithProviders(
      <StagingStrip
        {...defaultProps}
        blindIncoming={true}
        incomingTiles={[{ id: 'incoming-1', tile: 5, hidden: true }]}
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
      />
    );

    await user.click(screen.getByTestId('staging-incoming-tile-incoming-1'));

    expect(onAbsorbIncoming).toHaveBeenCalledWith('incoming-1');
  });

  test('renders non-blind incoming tiles face-up without blind controls', async () => {
    const onAbsorbIncoming = vi.fn();
    const { user } = renderWithProviders(
      <StagingStrip
        {...defaultProps}
        blindIncoming={false}
        onAbsorbIncoming={onAbsorbIncoming}
        incomingTiles={[{ id: 'incoming-1', tile: 5, hidden: true }]}
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
      />
    );

    await user.click(screen.getByTestId('staging-outgoing-tile-outgoing-1'));

    expect(onRemoveOutgoing).toHaveBeenCalledWith('outgoing-1');
  });

  test('renders outgoing staging tile without selected glow state', () => {
    renderWithProviders(
      <StagingStrip {...defaultProps} outgoingTiles={[{ id: 'outgoing-1', tile: 7 }]} />
    );

    const tile = screen.getByTestId('staging-outgoing-tile-outgoing-1');
    expect(tile).toHaveClass('tile-default');
    expect(tile).not.toHaveClass('tile-selected');
  });

  test('does not render the removed strip-local claim candidate panel', () => {
    renderWithProviders(<StagingStrip {...defaultProps} showActionButtons={false} />);

    expect(screen.queryByTestId('staging-claim-candidate')).not.toBeInTheDocument();
    expect(screen.queryByTestId('staging-claim-candidate-label')).not.toBeInTheDocument();
    expect(screen.queryByTestId('staging-claim-candidate-detail')).not.toBeInTheDocument();
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

  test('T-1: incoming tile with incomingFromSeat gets tile-enter-from-east on wrapper', () => {
    renderWithProviders(
      <StagingStrip
        {...defaultProps}
        incomingTiles={[{ id: 'inc-1', tile: 5 }]}
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
        incomingFromSeat={null}
      />
    );

    expect(screen.getByTestId('staging-incoming-tile-wrapper-inc-1')).not.toHaveClass(
      'tile-enter-from-east'
    );

    rerender(
      <StagingStrip
        {...defaultProps}
        incomingTiles={[{ id: 'inc-1', tile: 5 }]}
        incomingFromSeat="East"
      />
    );

    expect(screen.getByTestId('staging-incoming-tile-wrapper-inc-1')).not.toHaveClass(
      'tile-enter-from-east'
    );
  });

  test('AC-3: wrapper loses seat class when incomingFromSeat clears', () => {
    const { rerender } = renderWithProviders(
      <StagingStrip
        {...defaultProps}
        incomingTiles={[{ id: 'inc-1', tile: 5 }]}
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
