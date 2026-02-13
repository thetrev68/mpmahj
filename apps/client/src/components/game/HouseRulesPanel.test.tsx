import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { HouseRulesPanel } from './HouseRulesPanel';
import { DEFAULT_HOUSE_RULES } from './HouseRulesDefaults';

describe('HouseRulesPanel', () => {
  it('shows default server settings label when rules are missing in read-only mode', () => {
    render(<HouseRulesPanel rules={null} onChange={vi.fn()} readOnly />);

    expect(screen.getByText(/house rules: default server settings/i)).toBeInTheDocument();
  });

  it('renders read-only rule values when rules are provided', () => {
    render(<HouseRulesPanel rules={DEFAULT_HOUSE_RULES} onChange={vi.fn()} readOnly />);

    expect(screen.getByText(/card year: 2025/i)).toBeInTheDocument();
    expect(screen.getByText(/analysis: enabled/i)).toBeInTheDocument();
  });

  it('calls onChange when toggling editable rules', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<HouseRulesPanel rules={DEFAULT_HOUSE_RULES} onChange={onChange} showPresets />);

    await user.click(screen.getByLabelText(/allow blank exchange/i));

    expect(onChange).toHaveBeenCalled();
    expect(onChange).toHaveBeenCalledWith({
      ...DEFAULT_HOUSE_RULES,
      ruleset: {
        ...DEFAULT_HOUSE_RULES.ruleset,
        blank_exchange_enabled: true,
      },
    });
  });
});
