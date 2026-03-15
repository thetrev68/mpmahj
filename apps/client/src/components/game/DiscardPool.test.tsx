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
      'absolute',
      'top-1/4',
      'left-1/2',
      '-translate-x-1/2',
      'w-full',
      'max-w-[678px]',
      'grid',
      'grid-cols-[repeat(20,32px)]',
      'gap-0.5',
      'bg-black/15',
      'rounded-lg',
      'p-2'
    );
    expect(discardPool).not.toHaveClass('top-1/2', '-translate-y-1/2', 'h-[40%]', 'p-4');
  });

  it('does not apply rotation styles or classes to any discard tile wrapper', () => {
    renderWithProviders(<DiscardPool discards={buildDiscards(12)} />);

    for (const tile of screen.getAllByTestId(/^discard-pool-tile-/)) {
      expect(tile).not.toHaveAttribute('style');
      expect(tile.className).not.toMatch(/rotate/);
    }
  });

  it('preserves value-based highlighting for mostRecentTile matches', () => {
    renderWithProviders(<DiscardPool discards={buildDiscards(4, 9)} mostRecentTile={9} />);

    for (const tile of screen.getAllByTestId(/^discard-pool-tile-/)) {
      expect(tile).toHaveClass('ring-2', 'ring-yellow-400', 'rounded-sm');
    }
  });

  it('preserves value-based highlighting for callableTile matches', () => {
    renderWithProviders(<DiscardPool discards={buildDiscards(3, 11)} callableTile={11} />);

    for (const tile of screen.getAllByTestId(/^discard-pool-tile-/)) {
      expect(tile).toHaveClass('ring-2', 'ring-yellow-400', 'rounded-sm');
    }
  });

  it('does not highlight non-matching tiles and preserves sequential test ids', () => {
    renderWithProviders(
      <DiscardPool discards={buildDiscards(4)} mostRecentTile={33} callableTile={32} />
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
});
