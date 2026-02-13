import { useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import type { HouseRules } from '@/types/bindings/generated/HouseRules';
import { DEFAULT_HOUSE_RULES, HOUSE_RULE_PRESETS } from './HouseRulesDefaults';

export type HouseRulesPreset = 'StandardNMJL' | 'Beginner' | 'Advanced' | 'Custom';

const HOUSE_RULE_PRESET_LOOKUP: Record<
  Exclude<HouseRulesPreset, 'Custom'>,
  HouseRules
> = HOUSE_RULE_PRESETS;

function houseRulesEqual(a: HouseRules, b: HouseRules): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function detectPreset(rules: HouseRules): HouseRulesPreset {
  if (houseRulesEqual(rules, HOUSE_RULE_PRESET_LOOKUP.StandardNMJL)) {
    return 'StandardNMJL';
  }
  if (houseRulesEqual(rules, HOUSE_RULE_PRESET_LOOKUP.Beginner)) {
    return 'Beginner';
  }
  if (houseRulesEqual(rules, HOUSE_RULE_PRESET_LOOKUP.Advanced)) {
    return 'Advanced';
  }
  return 'Custom';
}

export interface HouseRulesPanelProps {
  rules?: HouseRules | null;
  onChange: (rules: HouseRules) => void;
  readOnly?: boolean;
  showPresets?: boolean;
}

export function HouseRulesPanel({
  rules = null,
  onChange,
  readOnly = false,
  showPresets = false,
}: HouseRulesPanelProps) {
  const [preset, setPreset] = useState<HouseRulesPreset>(() =>
    rules ? detectPreset(rules) : 'StandardNMJL'
  );

  if (readOnly) {
    return (
      <section className="rounded-md border p-3" role="group" aria-label="House Rules">
        <h3 className="text-sm font-semibold">House Rules</h3>
        {!rules && (
          <p className="text-sm text-muted-foreground">House rules: default server settings</p>
        )}
        {rules && (
          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            <p>Card year: {rules.ruleset.card_year}</p>
            <p>Blank exchange: {rules.ruleset.blank_exchange_enabled ? 'Enabled' : 'Disabled'}</p>
            <p>Analysis: {rules.analysis_enabled ? 'Enabled' : 'Disabled'}</p>
            <p>Concealed bonus: {rules.concealed_bonus_enabled ? 'Enabled' : 'Disabled'}</p>
            <p>Dealer bonus: {rules.dealer_bonus_enabled ? 'Enabled' : 'Disabled'}</p>
          </div>
        )}
      </section>
    );
  }

  const activeRules = rules ?? DEFAULT_HOUSE_RULES;

  const updateRules = (nextRules: HouseRules) => {
    setPreset(detectPreset(nextRules));
    onChange(nextRules);
  };

  return (
    <section className="grid gap-3 rounded-md border p-3" role="group" aria-label="House Rules">
      <h3 className="text-sm font-semibold">House Rules</h3>

      {showPresets && (
        <div className="grid gap-1">
          <Label htmlFor="house-rules-preset">Presets</Label>
          <select
            id="house-rules-preset"
            aria-label="House Rules Preset"
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={preset}
            onChange={(event) => {
              const nextPreset = event.target.value as HouseRulesPreset;
              setPreset(nextPreset);
              if (nextPreset !== 'Custom') {
                onChange(HOUSE_RULE_PRESET_LOOKUP[nextPreset]);
              }
            }}
          >
            <option value="StandardNMJL">Standard NMJL</option>
            <option value="Beginner">Beginner</option>
            <option value="Advanced">Advanced</option>
            <option value="Custom">Custom</option>
          </select>
        </div>
      )}

      <div className="flex items-center space-x-2">
        <Checkbox
          id="blank-exchange-enabled"
          checked={activeRules.ruleset.blank_exchange_enabled}
          onCheckedChange={(checked) =>
            updateRules({
              ...activeRules,
              ruleset: {
                ...activeRules.ruleset,
                blank_exchange_enabled: checked === true,
              },
            })
          }
        />
        <Label htmlFor="blank-exchange-enabled">Allow blank exchange</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="analysis-enabled"
          checked={activeRules.analysis_enabled}
          onCheckedChange={(checked) =>
            updateRules({
              ...activeRules,
              analysis_enabled: checked === true,
            })
          }
        />
        <Label htmlFor="analysis-enabled">Enable always-on analysis</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="concealed-bonus-enabled"
          checked={activeRules.concealed_bonus_enabled}
          onCheckedChange={(checked) =>
            updateRules({
              ...activeRules,
              concealed_bonus_enabled: checked === true,
            })
          }
        />
        <Label htmlFor="concealed-bonus-enabled">Enable concealed hand bonus</Label>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="dealer-bonus-enabled"
          checked={activeRules.dealer_bonus_enabled}
          onCheckedChange={(checked) =>
            updateRules({
              ...activeRules,
              dealer_bonus_enabled: checked === true,
            })
          }
        />
        <Label htmlFor="dealer-bonus-enabled">Enable dealer bonus</Label>
      </div>
    </section>
  );
}
