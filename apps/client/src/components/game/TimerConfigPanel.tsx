/**
 * @module TimerConfigPanel
 *
 * Room-level timer configuration: preset selection (Standard/Relaxed/Blitz/NoTimers)
 * or custom Charleston and call-window timers. Includes game duration estimate and
 * a read-only view for rule display.
 *
 * Integrates with {@link src/types/bindings/generated/Ruleset.ts} and updates
 * room settings via callback. "Blitz" mode shows a warning banner.
 *
 * @see {@link src/types/bindings/generated/Ruleset.ts} for Rust-generated Ruleset shape
 */

import { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Ruleset } from '@/types/bindings/generated/Ruleset';

/**
 * Timer configuration preset options.
 *
 * @typedef {('Standard' | 'Relaxed' | 'Blitz' | 'NoTimers' | 'Custom')} TimerPreset
 * - Standard: 60s Charleston, 10s call window
 * - Relaxed: 120s Charleston, 15s call window (for players needing extra time)
 * - Blitz: 30s Charleston, 5s call window (fast-paced)
 * - NoTimers: 60s Charleston, 10s call, but timer mode set to 'Hidden'
 * - Custom: User-defined values
 */
export type TimerPreset = 'Standard' | 'Relaxed' | 'Blitz' | 'NoTimers' | 'Custom';

const CHARLESTON_MIN_SECONDS = 30;
const CHARLESTON_MAX_SECONDS = 300;
const CALL_WINDOW_MIN_SECONDS = 5;
const CALL_WINDOW_MAX_SECONDS = 30;
// turn_timer is not yet in Ruleset bindings; use a fixed estimate per spec defaults (90s)
const BASE_TURN_SECONDS = 90;

/**
 * Preset timer values (Charleston and call-window seconds).
 * Used to populate the preset dropdown and detect current mode.
 *
 * @internal
 */
const PRESET_TIMERS: Record<
  Exclude<TimerPreset, 'Custom'>,
  { charleston: number; call: number }
> = {
  Standard: { charleston: 60, call: 10 },
  Relaxed: { charleston: 120, call: 15 },
  Blitz: { charleston: 30, call: 5 },
  NoTimers: { charleston: 60, call: 10 },
};

/**
 * Clamps a numeric value to a min/max range.
 *
 * @internal
 * @param {number} value - Value to clamp
 * @param {number} min - Minimum bound (inclusive)
 * @param {number} max - Maximum bound (inclusive)
 * @returns {number} Clamped value
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Detects which preset (if any) matches the current ruleset timer config.
 * Checks in order: NoTimers (timer_mode), Standard, Relaxed, Blitz; returns 'Custom' if no match.
 *
 * @internal
 * @param {Ruleset} ruleset - Room ruleset with timer settings
 * @returns {TimerPreset} Detected preset or 'Custom'
 */
function detectPreset(ruleset: Ruleset): TimerPreset {
  if (ruleset.timer_mode === 'Hidden') {
    return 'NoTimers';
  }

  if (
    ruleset.charleston_timer_seconds === PRESET_TIMERS.Standard.charleston &&
    ruleset.call_window_seconds === PRESET_TIMERS.Standard.call
  ) {
    return 'Standard';
  }

  if (
    ruleset.charleston_timer_seconds === PRESET_TIMERS.Relaxed.charleston &&
    ruleset.call_window_seconds === PRESET_TIMERS.Relaxed.call
  ) {
    return 'Relaxed';
  }

  if (
    ruleset.charleston_timer_seconds === PRESET_TIMERS.Blitz.charleston &&
    ruleset.call_window_seconds === PRESET_TIMERS.Blitz.call
  ) {
    return 'Blitz';
  }

  return 'Custom';
}

/**
 * Props for the TimerConfigPanel component.
 *
 * @interface TimerConfigPanelProps
 * @property {Ruleset} ruleset - Current room ruleset with timer config.
 *   @see {@link src/types/bindings/generated/Ruleset.ts}
 * @property {(ruleset: Ruleset) => void} onChange - Callback fired when user modifies timers.
 *   Called with updated ruleset (all fields preserved, only timer fields changed).
 * @property {boolean} [readOnly=false] - Display-only mode (no editable controls). Used when viewing
 *   completed games or spectating.
 * @property {boolean} [showPresets=true] - Show preset selector dropdown. Can be hidden for simple UIs.
 */
export interface TimerConfigPanelProps {
  ruleset: Ruleset;
  onChange: (ruleset: Ruleset) => void;
  readOnly?: boolean;
  showPresets?: boolean;
}

export function TimerConfigPanel({
  ruleset,
  onChange,
  readOnly = false,
  showPresets = true,
}: TimerConfigPanelProps) {
  const [preset, setPreset] = useState<TimerPreset>(() => detectPreset(ruleset));
  const noTimers = ruleset.timer_mode === 'Hidden';

  const estimate = useMemo(() => {
    if (noTimers) {
      return null;
    }

    const charlestonSeconds = ruleset.charleston_timer_seconds * 6;
    const minTurns = 30;
    const maxTurns = 50;
    // Estimate per-turn time: BASE_TURN_SECONDS (proxy for missing turn_timer binding) + call_window * 0.5
    const secondsPerTurn = BASE_TURN_SECONDS + ruleset.call_window_seconds * 0.5;
    const minMinutes = Math.ceil((charlestonSeconds + secondsPerTurn * minTurns) / 60);
    const maxMinutes = Math.ceil((charlestonSeconds + secondsPerTurn * maxTurns) / 60);
    return { minMinutes, maxMinutes };
  }, [noTimers, ruleset.call_window_seconds, ruleset.charleston_timer_seconds]);

  const applyPreset = (nextPreset: TimerPreset) => {
    setPreset(nextPreset);
    if (nextPreset === 'Custom') {
      return;
    }

    const timers = PRESET_TIMERS[nextPreset];
    onChange({
      ...ruleset,
      charleston_timer_seconds: timers.charleston,
      call_window_seconds: timers.call,
      timer_mode: nextPreset === 'NoTimers' ? 'Hidden' : 'Visible',
    });
  };

  const updateCharlestonTimer = (value: number) => {
    setPreset('Custom');
    onChange({
      ...ruleset,
      charleston_timer_seconds: value,
    });
  };

  const updateCallWindowTimer = (value: number) => {
    setPreset('Custom');
    onChange({
      ...ruleset,
      call_window_seconds: value,
    });
  };

  if (readOnly) {
    return (
      <section className="rounded-md border p-3" role="group" aria-label="Timer Settings">
        <h3 className="text-sm font-semibold">Timer Settings</h3>
        <p className="text-sm text-muted-foreground">
          Charleston: {noTimers ? 'No limit' : `${ruleset.charleston_timer_seconds}s`}
        </p>
        <p className="text-sm text-muted-foreground">
          Call window: {noTimers ? 'No limit' : `${ruleset.call_window_seconds}s`}
        </p>
      </section>
    );
  }

  return (
    <section className="grid gap-3 rounded-md border p-3" role="group" aria-label="Timer Settings">
      <h3 className="text-sm font-semibold">Timer Settings</h3>

      {showPresets && (
        <div className="grid gap-1">
          <Label htmlFor="timer-preset">Timer Presets</Label>
          <select
            id="timer-preset"
            aria-label="Timer Presets"
            className="h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm"
            value={preset}
            onChange={(event) => applyPreset(event.target.value as TimerPreset)}
          >
            <option value="Standard">Standard</option>
            <option value="Relaxed">Relaxed</option>
            <option value="Blitz">Blitz</option>
            <option value="NoTimers">No Timers</option>
            <option value="Custom">Custom</option>
          </select>
        </div>
      )}

      <div className="grid gap-1">
        <Label htmlFor="charleston-pass-timer">Charleston Pass Timer (per stage)</Label>
        <Input
          id="charleston-pass-timer"
          type="number"
          min={CHARLESTON_MIN_SECONDS}
          max={CHARLESTON_MAX_SECONDS}
          value={ruleset.charleston_timer_seconds}
          disabled={noTimers}
          onChange={(event) => updateCharlestonTimer(Number(event.target.value))}
          onBlur={(event) => {
            const value = Number(event.target.value);
            if (!Number.isNaN(value)) {
              updateCharlestonTimer(clamp(value, CHARLESTON_MIN_SECONDS, CHARLESTON_MAX_SECONDS));
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          Time allowed to select 3 tiles for each Charleston pass.
        </p>
      </div>

      <div className="grid gap-1">
        <Label htmlFor="call-window-timer">Call Window (after discard)</Label>
        <Input
          id="call-window-timer"
          type="number"
          min={CALL_WINDOW_MIN_SECONDS}
          max={CALL_WINDOW_MAX_SECONDS}
          value={ruleset.call_window_seconds}
          disabled={noTimers}
          onChange={(event) => updateCallWindowTimer(Number(event.target.value))}
          onBlur={(event) => {
            const value = Number(event.target.value);
            if (!Number.isNaN(value)) {
              updateCallWindowTimer(clamp(value, CALL_WINDOW_MIN_SECONDS, CALL_WINDOW_MAX_SECONDS));
            }
          }}
        />
        <p className="text-xs text-muted-foreground">
          Time allowed to call Pung/Kong after a discard.
        </p>
      </div>

      {preset === 'Blitz' && (
        <p className="rounded border border-yellow-400 bg-yellow-50 px-2 py-1 text-xs text-yellow-900">
          Blitz mode has very short timers. Ensure all players are experienced.
        </p>
      )}

      <div aria-live="polite" className="text-sm text-muted-foreground">
        {estimate ? (
          <p>
            Estimated game time: {estimate.minMinutes}-{estimate.maxMinutes} minutes
          </p>
        ) : (
          <p>No timers enabled. Game duration depends on player pace.</p>
        )}
      </div>
    </section>
  );
}
