import type { HouseRules } from '@/types/bindings/generated/HouseRules';

export const DEFAULT_HOUSE_RULES: HouseRules = {
  ruleset: {
    card_year: 2025,
    timer_mode: 'Visible',
    blank_exchange_enabled: false,
    call_window_seconds: 10,
    charleston_timer_seconds: 60,
  },
  analysis_enabled: true,
  concealed_bonus_enabled: false,
  dealer_bonus_enabled: false,
};

const BEGINNER_HOUSE_RULES: HouseRules = {
  ...DEFAULT_HOUSE_RULES,
  ruleset: {
    ...DEFAULT_HOUSE_RULES.ruleset,
    call_window_seconds: 15,
    charleston_timer_seconds: 120,
  },
};

const ADVANCED_HOUSE_RULES: HouseRules = {
  ...DEFAULT_HOUSE_RULES,
  ruleset: {
    ...DEFAULT_HOUSE_RULES.ruleset,
    blank_exchange_enabled: true,
    call_window_seconds: 5,
    charleston_timer_seconds: 45,
  },
  analysis_enabled: false,
  concealed_bonus_enabled: true,
  dealer_bonus_enabled: true,
};

export const HOUSE_RULE_PRESETS = {
  StandardNMJL: DEFAULT_HOUSE_RULES,
  Beginner: BEGINNER_HOUSE_RULES,
  Advanced: ADVANCED_HOUSE_RULES,
} as const;
