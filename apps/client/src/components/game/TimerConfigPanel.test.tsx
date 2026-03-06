import { useState } from 'react';
import { beforeAll, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TimerConfigPanel } from './TimerConfigPanel';
import type { Ruleset } from '@/types/bindings/generated/Ruleset';

function Harness({ initial }: { initial: Ruleset }) {
  const [ruleset, setRuleset] = useState(initial);
  return <TimerConfigPanel ruleset={ruleset} onChange={setRuleset} showPresets />;
}

const baseRuleset: Ruleset = {
  card_year: 2025,
  timer_mode: 'Visible',
  blank_exchange_enabled: false,
  call_window_seconds: 10,
  charleston_timer_seconds: 60,
};

describe('TimerConfigPanel', () => {
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

  it('renders timer settings defaults', () => {
    const onChange = vi.fn();
    render(<TimerConfigPanel ruleset={baseRuleset} onChange={onChange} showPresets />);

    expect(screen.getByRole('group', { name: /timer settings/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/charleston pass timer/i)).toHaveValue(60);
    expect(screen.getByLabelText(/call window/i)).toHaveValue(10);
    expect(screen.getByText(/estimated game time/i)).toBeInTheDocument();
  });

  it('applies relaxed preset values', async () => {
    const user = userEvent.setup();
    render(<Harness initial={baseRuleset} />);

    await user.click(screen.getByLabelText(/timer presets/i));
    await user.click(screen.getByRole('option', { name: 'Relaxed' }));

    expect(screen.getByLabelText(/charleston pass timer/i)).toHaveValue(120);
    expect(screen.getByLabelText(/call window/i)).toHaveValue(15);
  });

  it('switches preset to custom on manual edit', async () => {
    const user = userEvent.setup();
    render(<Harness initial={baseRuleset} />);

    const callWindowInput = screen.getByLabelText(/call window/i);
    await user.clear(callWindowInput);
    await user.type(callWindowInput, '12');

    expect(screen.getByLabelText(/timer presets/i)).toHaveTextContent('Custom');
    expect(callWindowInput).toHaveValue(12);
  });

  it('disables timer inputs for no timers preset', async () => {
    const user = userEvent.setup();
    render(<Harness initial={baseRuleset} />);

    await user.click(screen.getByLabelText(/timer presets/i));
    await user.click(screen.getByRole('option', { name: 'No Timers' }));

    expect(screen.getByLabelText(/charleston pass timer/i)).toBeDisabled();
    expect(screen.getByLabelText(/call window/i)).toBeDisabled();
    expect(screen.getByText(/no timers enabled/i)).toBeInTheDocument();
  });

  it('clamps out-of-range input values', async () => {
    const user = userEvent.setup();
    render(<Harness initial={baseRuleset} />);

    const charlestonInput = screen.getByLabelText(/charleston pass timer/i);
    await user.clear(charlestonInput);
    await user.type(charlestonInput, '999');
    await user.tab();

    expect(charlestonInput).toHaveValue(300);
  });
});
