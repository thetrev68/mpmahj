import { renderWithProviders, screen } from '@/test/test-utils';
import { describe, expect, it } from 'vitest';
import { DiscardPool } from './DiscardPool';

function buildDiscards(count: number, repeatedTile?: number) {
  return Array.from({ length: count }, (_, index) => ({
    tile: repeatedTile ?? index % 34,
    discardedBy: (['East', 'South', 'West', 'North'] as const)[index % 4],
    turn: index + 1,
  }));
}

describe('DiscardPool', () => {
  it('renders the discard pool container with no child tiles for an empty pile', () => {
    renderWithProviders(<DiscardPool discards={[]} />);

    const discardPool = screen.getByTestId('discard-pool');
    expect(discardPool).toBeInTheDocument();
    expect(discardPool).toHaveAttribute('aria-label', 'Discard pool: 0 tiles');
    expect(screen.queryAllByTestId(/^discard-pool-tile-/)).toHaveLength(0);
  });

  it('renders a single tile upright at the first grid position', () => {
    renderWithProviders(<DiscardPool discards={buildDiscards(1, 7)} />);

    const wrapper = screen.getByTestId('discard-pool-tile-0');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).not.toHaveAttribute('style');
    expect(wrapper.className).not.toMatch(/rotate/);
    expect(wrapper.querySelector('[data-tile="7"]')).toBeInTheDocument();
  });

  it('renders 20 tiles in one complete row with sequential test ids', () => {
    renderWithProviders(<DiscardPool discards={buildDiscards(20)} />);

    const tiles = screen.getAllByTestId(/^discard-pool-tile-/);
    expect(tiles).toHaveLength(20);
    expect(screen.getByTestId('discard-pool-tile-0')).toBeInTheDocument();
    expect(screen.getByTestId('discard-pool-tile-19')).toBeInTheDocument();
  });

  it('renders 21 tiles without placeholder cells and wraps into a second row', () => {
    renderWithProviders(<DiscardPool discards={buildDiscards(21)} />);

    const tiles = screen.getAllByTestId(/^discard-pool-tile-/);
    expect(tiles).toHaveLength(21);
    expect(screen.getByTestId('discard-pool-tile-20')).toBeInTheDocument();
    expect(screen.queryByTestId('discard-pool-tile-21')).not.toBeInTheDocument();
  });

  it('renders 99 tiles with no overflow or scroll class', () => {
    renderWithProviders(<DiscardPool discards={buildDiscards(99)} />);

    const discardPool = screen.getByTestId('discard-pool');
    expect(screen.getAllByTestId(/^discard-pool-tile-/)).toHaveLength(99);
    expect(discardPool).not.toHaveClass('overflow-auto');
    expect(discardPool.className).not.toMatch(/\boverflow-/);
  });

  it('uses the locked desktop grid and width contract', () => {
    renderWithProviders(<DiscardPool discards={buildDiscards(3)} />);

    const discardPool = screen.getByTestId('discard-pool');
    expect(discardPool).toHaveClass(
      'grid',
      'w-full',
      'max-w-[678px]',
      'grid-cols-[repeat(10,32px)]',
      'gap-0.5',
      'self-center',
      'justify-self-center',
      'rounded-lg',
      'bg-black/15',
      'p-2',
      'lg:grid-cols-[repeat(20,32px)]'
    );
    expect(discardPool).not.toHaveClass(
      'absolute',
      'top-1/4',
      'left-1/2',
      '-translate-x-1/2',
      'top-1/2',
      '-translate-y-1/2',
      'h-[40%]',
      'p-4'
    );
  });

  it('does not apply rotation styles or classes to any discard tile wrapper', () => {
    renderWithProviders(<DiscardPool discards={buildDiscards(12)} />);

    for (const tile of screen.getAllByTestId(/^discard-pool-tile-/)) {
      expect(tile).not.toHaveAttribute('style');
      expect(tile.className).not.toMatch(/rotate/);
    }
  });

  it('highlights only the matching most recent discard instance in chronological mode', () => {
    renderWithProviders(
      <DiscardPool
        discards={[
          { tile: 9, discardedBy: 'East', turn: 1 },
          { tile: 3, discardedBy: 'South', turn: 2 },
          { tile: 9, discardedBy: 'West', turn: 3 },
        ]}
        mostRecentDiscardTurn={3}
      />
    );

    expect(screen.getByTestId('discard-pool-tile-0')).not.toHaveClass('ring-2', 'ring-yellow-400');
    expect(screen.getByTestId('discard-pool-tile-1')).not.toHaveClass('ring-2', 'ring-yellow-400');
    expect(screen.getByTestId('discard-pool-tile-2')).toHaveClass(
      'ring-2',
      'ring-yellow-400',
      'rounded-sm'
    );
  });

  it('highlights only the matching callable discard instance in chronological mode', () => {
    renderWithProviders(
      <DiscardPool
        discards={[
          { tile: 11, discardedBy: 'East', turn: 1 },
          { tile: 11, discardedBy: 'South', turn: 2 },
          { tile: 6, discardedBy: 'West', turn: 3 },
        ]}
        callableDiscardTurn={2}
      />
    );

    expect(screen.getByTestId('discard-pool-tile-0')).not.toHaveClass('ring-2', 'ring-yellow-400');
    expect(screen.getByTestId('discard-pool-tile-1')).toHaveClass(
      'ring-2',
      'ring-yellow-400',
      'rounded-sm'
    );
    expect(screen.getByTestId('discard-pool-tile-2')).not.toHaveClass('ring-2', 'ring-yellow-400');
  });

  it('applies a single ring when callable and most recent target the same discard instance', () => {
    renderWithProviders(
      <DiscardPool
        discards={[
          { tile: 5, discardedBy: 'East', turn: 1 },
          { tile: 5, discardedBy: 'South', turn: 2 },
        ]}
        mostRecentDiscardTurn={2}
        callableDiscardTurn={2}
      />
    );

    expect(screen.getByTestId('discard-pool-tile-0')).not.toHaveClass('ring-2', 'ring-yellow-400');
    expect(screen.getByTestId('discard-pool-tile-1')).toHaveClass(
      'ring-2',
      'ring-yellow-400',
      'rounded-sm'
    );
    expect(screen.getByTestId('discard-pool-tile-1').className.match(/ring-2/g)).toHaveLength(1);
  });

  it('does not highlight non-matching tiles and preserves sequential test ids', () => {
    renderWithProviders(
      <DiscardPool
        discards={buildDiscards(4)}
        mostRecentDiscardTurn={33}
        callableDiscardTurn={32}
      />
    );

    expect(screen.getByTestId('discard-pool-tile-0')).not.toHaveClass('ring-2', 'ring-yellow-400');
    expect(screen.getByTestId('discard-pool-tile-1')).not.toHaveClass('ring-2', 'ring-yellow-400');
    expect(screen.getByTestId('discard-pool-tile-2')).toHaveAttribute(
      'data-testid',
      'discard-pool-tile-2'
    );
    expect(screen.getByTestId('discard-pool-tile-3')).toHaveAttribute(
      'data-testid',
      'discard-pool-tile-3'
    );
  });

  it('preserves chronological order when sortDiscards is false (AC-1, AC-4)', () => {
    const discards = [
      { tile: 18, discardedBy: 'East' as const, turn: 1 },
      { tile: 0, discardedBy: 'South' as const, turn: 2 },
      { tile: 9, discardedBy: 'West' as const, turn: 3 },
    ];

    renderWithProviders(<DiscardPool discards={discards} sortDiscards={false} />);

    const tiles = screen.getAllByTestId(/^discard-pool-tile-/);
    expect(tiles[0].querySelector('[data-tile="18"]')).toBeInTheDocument();
    expect(tiles[1].querySelector('[data-tile="0"]')).toBeInTheDocument();
    expect(tiles[2].querySelector('[data-tile="9"]')).toBeInTheDocument();
  });

  it('sorts tiles in canonical order when sortDiscards is true (AC-3)', () => {
    const discards = [
      { tile: 18, discardedBy: 'East' as const, turn: 1 },
      { tile: 0, discardedBy: 'South' as const, turn: 2 },
      { tile: 9, discardedBy: 'West' as const, turn: 3 },
    ];

    renderWithProviders(<DiscardPool discards={discards} sortDiscards={true} />);

    const tiles = screen.getAllByTestId(/^discard-pool-tile-/);
    expect(tiles[0].querySelector('[data-tile="0"]')).toBeInTheDocument();
    expect(tiles[1].querySelector('[data-tile="9"]')).toBeInTheDocument();
    expect(tiles[2].querySelector('[data-tile="18"]')).toBeInTheDocument();
  });

  it('preserves most recent highlight identity under sorted display with duplicates (AC-7, EC-4)', () => {
    const discards = [
      { tile: 9, discardedBy: 'East' as const, turn: 1 },
      { tile: 0, discardedBy: 'South' as const, turn: 2 },
      { tile: 9, discardedBy: 'West' as const, turn: 3 },
    ];

    renderWithProviders(
      <DiscardPool discards={discards} sortDiscards={true} mostRecentDiscardTurn={3} />
    );

    const tiles = screen.getAllByTestId(/^discard-pool-tile-/);
    expect(tiles[0]).not.toHaveClass('ring-2');
    expect(tiles[1]).not.toHaveClass('ring-2');
    expect(tiles[2]).toHaveClass('ring-2', 'ring-yellow-400', 'rounded-sm');
  });

  it('preserves callable highlight identity under sorted display with duplicates', () => {
    const discards = [
      { tile: 12, discardedBy: 'East' as const, turn: 1 },
      { tile: 4, discardedBy: 'South' as const, turn: 2 },
      { tile: 12, discardedBy: 'West' as const, turn: 3 },
    ];

    renderWithProviders(
      <DiscardPool discards={discards} sortDiscards={true} callableDiscardTurn={1} />
    );

    const tiles = screen.getAllByTestId(/^discard-pool-tile-/);
    expect(tiles[0]).not.toHaveClass('ring-2');
    expect(tiles[1]).toHaveClass('ring-2', 'ring-yellow-400', 'rounded-sm');
    expect(tiles[2]).not.toHaveClass('ring-2');
  });

  it('re-renders sorted presentation without losing discard-instance highlight identity', () => {
    const discards = [
      { tile: 18, discardedBy: 'East' as const, turn: 1 },
      { tile: 0, discardedBy: 'South' as const, turn: 2 },
      { tile: 18, discardedBy: 'West' as const, turn: 3 },
    ];

    const { rerender } = renderWithProviders(
      <DiscardPool discards={discards} sortDiscards={false} mostRecentDiscardTurn={3} />
    );

    expect(screen.getByTestId('discard-pool-tile-2')).toHaveClass('ring-2', 'ring-yellow-400');

    rerender(<DiscardPool discards={discards} sortDiscards={true} mostRecentDiscardTurn={3} />);

    const tiles = screen.getAllByTestId(/^discard-pool-tile-/);
    expect(tiles[0]).not.toHaveClass('ring-2');
    expect(tiles[1]).not.toHaveClass('ring-2');
    expect(tiles[2]).toHaveClass('ring-2', 'ring-yellow-400', 'rounded-sm');
  });

  it('empty pile behaves identically regardless of sortDiscards (EC-3)', () => {
    renderWithProviders(<DiscardPool discards={[]} sortDiscards={true} />);

    const pool = screen.getByTestId('discard-pool');
    expect(pool).toHaveAttribute('aria-label', 'Discard pool: 0 tiles');
    expect(screen.queryAllByTestId(/^discard-pool-tile-/)).toHaveLength(0);
  });
});
