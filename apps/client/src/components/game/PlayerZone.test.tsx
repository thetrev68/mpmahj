import { describe, expect, test } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { PlayerZone } from './PlayerZone';

describe('PlayerZone', () => {
  test('renders with the default data-testid and a board-local wrapper without gradient overlay', () => {
    renderWithProviders(
      <PlayerZone
        staging={<div>staging</div>}
        rack={<div>rack</div>}
        actions={<div>actions</div>}
      />
    );

    const zone = screen.getByTestId('player-zone');
    expect(zone).toBeInTheDocument();
    expect(zone).toHaveClass('relative', 'w-full');
    expect(zone).not.toHaveClass('fixed');
    expect(zone.getAttribute('style')).toBeNull();
  });

  test('renders staging content in the upper row staging slot', () => {
    renderWithProviders(
      <PlayerZone
        staging={<div data-testid="staging-content">staging</div>}
        rack={<div>rack</div>}
        actions={<div>actions</div>}
      />
    );

    expect(
      within(screen.getByTestId('player-zone-staging-slot')).getByTestId('staging-content')
    ).toBeInTheDocument();
  });

  test('renders rack content in the lower row', () => {
    renderWithProviders(
      <PlayerZone
        staging={<div>staging</div>}
        rack={<div data-testid="rack-content">rack</div>}
        actions={<div>actions</div>}
      />
    );

    expect(
      within(screen.getByTestId('player-zone-rack-slot')).getByTestId('rack-content')
    ).toBeInTheDocument();
  });

  test('renders actions content beside the staging slot', () => {
    renderWithProviders(
      <PlayerZone
        staging={<div>staging</div>}
        rack={<div>rack</div>}
        actions={<div data-testid="actions-content">actions</div>}
      />
    );

    const layout = screen.getByTestId('player-zone-layout');
    expect(
      within(screen.getByTestId('player-zone-actions-slot')).getByTestId('actions-content')
    ).toBeInTheDocument();
    expect(layout).toContainElement(screen.getByTestId('player-zone-upper-row'));
    expect(layout).toContainElement(screen.getByTestId('player-zone-actions-column'));
  });

  test('uses a full-width inner wrapper for the widened staging layout', () => {
    renderWithProviders(
      <PlayerZone
        staging={<div>staging</div>}
        rack={<div>rack</div>}
        actions={<div>actions</div>}
      />
    );

    const innerWrapper = screen.getByTestId('player-zone-layout');
    expect(innerWrapper).toHaveClass('max-w-full');
    expect(innerWrapper).not.toHaveClass('max-w-[920px]');
  });

  test('uses the shared grid contract instead of absolute right offsets', () => {
    renderWithProviders(
      <PlayerZone
        staging={<div>staging</div>}
        rack={<div>rack</div>}
        actions={<div>actions</div>}
      />
    );

    expect(screen.getByTestId('player-zone-layout')).toHaveClass(
      'grid',
      'lg:grid-cols-[minmax(0,1fr)_280px]',
      'lg:items-end'
    );
    expect(screen.getByTestId('player-zone-actions-column')).toHaveClass(
      'flex',
      'justify-end',
      'self-stretch'
    );
    expect(screen.getByTestId('player-zone-actions-slot')).toHaveClass(
      'flex-col',
      'items-stretch',
      'justify-start',
      'py-2'
    );
    expect(screen.getByTestId('player-zone-actions-slot')).not.toHaveClass(
      'lg:absolute',
      'lg:right-[108px]'
    );
  });

  test('uses a custom data-testid when provided', () => {
    renderWithProviders(
      <PlayerZone
        staging={<div>staging</div>}
        rack={<div>rack</div>}
        actions={<div>actions</div>}
        data-testid="custom-zone"
      />
    );

    expect(screen.getByTestId('custom-zone')).toBeInTheDocument();
  });
});
