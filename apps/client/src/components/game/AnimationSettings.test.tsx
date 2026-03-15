import { describe, expect, test } from 'vitest';
import { renderWithProviders, screen } from '@/test/test-utils';
import { AnimationSettings } from './AnimationSettings';

describe('AnimationSettings', () => {
  test('renders read-only animation policy status', () => {
    renderWithProviders(<AnimationSettings />);

    expect(screen.getByText('Animations')).toBeInTheDocument();
    expect(screen.getByTestId('animation-policy-status')).toHaveTextContent(
      'Animations are on at normal speed'
    );
  });

  test('shows reduced-motion status when system preference is detected', () => {
    renderWithProviders(<AnimationSettings prefersReducedMotion />);

    expect(screen.getByTestId('animation-policy-status')).toHaveTextContent(
      'Animations are off because reduced motion is enabled'
    );
  });

  test('does not render speed selector or per-animation toggles', () => {
    renderWithProviders(<AnimationSettings />);

    expect(screen.queryByTestId('animation-speed-select')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Tile movement')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Win celebration')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Respect reduced motion preference')).not.toBeInTheDocument();
  });

  test('uses theme-aware card and status text classes', () => {
    renderWithProviders(<AnimationSettings />);

    expect(screen.getByTestId('animation-settings-card')).not.toHaveClass(
      'border-slate-700',
      'bg-slate-950/80',
      'text-slate-100'
    );
    expect(screen.getByTestId('animation-policy-status')).toHaveClass('text-muted-foreground');
    expect(screen.getByTestId('animation-policy-status')).not.toHaveClass('text-slate-300');
  });
});
