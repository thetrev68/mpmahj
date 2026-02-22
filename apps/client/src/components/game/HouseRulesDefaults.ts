/**
 * @module HouseRulesDefaults
 *
 * Default and preset house rule configurations for room setup.
 * Used by `src/components/game/HouseRulesPanel.tsx` and
 * `src/components/game/TimerConfigPanel.tsx`.
 *
 * @see `src/types/bindings/generated/HouseRules.ts` for Rust-generated types
 * @see `src/components/game/HouseRulesPanel.tsx` for UI integration
 */

import type { HouseRules } from '@/types/bindings/generated/HouseRules';

/**
 * Default house rules (Standard NMJL): 60s Charleston, 10s call window, no blank exchange.
 * Analysis enabled, no concealed/dealer bonuses.
 *
 * @type {HouseRules}
 * @see `src/types/bindings/generated/HouseRules.ts`
 */
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

/**
 * Beginner-friendly presets: 120s Charleston, 15s call window, relaxed timers.
 * Same bonuses as default (analysis only).
 *
 * @internal
 */
const BEGINNER_HOUSE_RULES: HouseRules = {
  ...DEFAULT_HOUSE_RULES,
  ruleset: {
    ...DEFAULT_HOUSE_RULES.ruleset,
    call_window_seconds: 15,
    charleston_timer_seconds: 120,
  },
};

/**
 * Advanced preset: strict timers (45s Charleston, 5s call), blank exchange enabled,
 * analysis disabled, concealed and dealer bonuses enabled.
 *
 * @internal
 */
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

/**
 * Lookup table for preset house rule configurations.
 * Used by `src/components/game/HouseRulesPanel.tsx` to populate dropdowns
 * and detect current preset when user modifies rules.
 *
 * @type {Object}
 * @property {HouseRules} StandardNMJL - Official NMJL rules (same as DEFAULT_HOUSE_RULES)
 * @property {HouseRules} Beginner - Relaxed timers for new players
 * @property {HouseRules} Advanced - Strict timers with all bonuses enabled
 */
export const HOUSE_RULE_PRESETS = {
  StandardNMJL: DEFAULT_HOUSE_RULES,
  Beginner: BEGINNER_HOUSE_RULES,
  Advanced: ADVANCED_HOUSE_RULES,
} as const;
