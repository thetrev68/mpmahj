import { beforeAll, describe, expect, test, vi } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { AnimationSettings } from './AnimationSettings';
import type { AnimationPreferences } from '@/hooks/useAnimationSettings';

const baseSettings: AnimationPreferences = {
  speed: 'normal',
  tile_movement: true,
  charleston_pass: true,
  meld_formation: true,
  dice_roll: true,
  win_celebration: true,
  respect_reduced_motion: true,
};

describe('AnimationSettings', () => {
  beforeAll(() => {
    if (!HTMLElement.prototype.hasPointerCapture) {
      Object.defineProperty(HTMLElement.prototype, 'hasPointerCapture', {
        value: () => false,
      });
    }
    if (!HTMLElement.prototype.setPointerCapture) {
      Object.defineProperty(HTMLElement.prototype, 'setPointerCapture', {
        value: () => {},
      });
    }
    if (!HTMLElement.prototype.releasePointerCapture) {
      Object.defineProperty(HTMLElement.prototype, 'releasePointerCapture', {
        value: () => {},
      });
    }
    if (!Element.prototype.scrollIntoView) {
      Object.defineProperty(Element.prototype, 'scrollIntoView', {
        value: () => {},
      });
    }
  });

  test('renders core controls', () => {
    renderWithProviders(<AnimationSettings settings={baseSettings} onChange={vi.fn()} />);

    expect(screen.getByText('Animations')).toBeInTheDocument();
    expect(screen.getByText('Animation Speed')).toBeInTheDocument();
    expect(screen.getByLabelText('Tile movement')).toBeInTheDocument();
    expect(screen.getByLabelText('Respect reduced motion preference')).toBeInTheDocument();
  });

  test('calls onChange when speed is changed', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <AnimationSettings settings={baseSettings} onChange={onChange} />
    );

    await user.click(screen.getByTestId('animation-speed-select'));
    await user.click(screen.getByText('Fast'));

    expect(onChange).toHaveBeenCalledWith({
      ...baseSettings,
      speed: 'fast',
    });
  });

  test('calls onChange when a toggle is changed', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <AnimationSettings settings={baseSettings} onChange={onChange} />
    );

    await user.click(screen.getByLabelText('Win celebration'));

    expect(onChange).toHaveBeenCalledWith({
      ...baseSettings,
      win_celebration: false,
    });
  });

  test('shows reduced motion banner when system preference is detected', () => {
    renderWithProviders(
      <AnimationSettings settings={baseSettings} onChange={vi.fn()} prefersReducedMotion />
    );

    expect(screen.getByTestId('reduced-motion-banner')).toBeInTheDocument();
  });
});
