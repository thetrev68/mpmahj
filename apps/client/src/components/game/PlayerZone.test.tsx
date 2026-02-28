import { describe, expect, test } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { PlayerZone } from './PlayerZone';

describe('PlayerZone', () => {
  test('renders with the default data-testid and fixed gradient wrapper', () => {
    renderWithProviders(
      <PlayerZone
        staging={<div>staging</div>}
        rack={<div>rack</div>}
        actions={<div>actions</div>}
      />
    );

    const zone = screen.getByTestId('player-zone');
    expect(zone).toBeInTheDocument();
    expect(zone).toHaveClass('fixed', 'bottom-0', 'left-0', 'right-0');
    expect(zone.getAttribute('style')).toContain('linear-gradient(to top');
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

    const upperRow = screen.getByTestId('player-zone-upper-row');
    expect(
      within(screen.getByTestId('player-zone-actions-slot')).getByTestId('actions-content')
    ).toBeInTheDocument();
    expect(upperRow).toContainElement(screen.getByTestId('player-zone-staging-slot'));
    expect(upperRow).toContainElement(screen.getByTestId('player-zone-actions-slot'));
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
