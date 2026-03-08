/**
 * Application-wide constants for game rules, UI timing, and protocol values.
 *
 * Keep domain-specific constants in their own modules:
 *  - Tile indices      → src/lib/utils/tileUtils.ts (TILE_INDICES)
 *  - Meld sizes        → src/lib/game-logic/callIntentCalculator.ts (MELD_SIZES)
 *  - Animation speeds  → src/hooks/useAnimationSettings.ts (SPEED_MULTIPLIERS)
 *  - Reconnect delays  → src/hooks/gameSocketTransport.ts (RECONNECT_*)
 *  - House rule presets → src/components/game/HouseRulesDefaults.ts
 */

// === Game Rules ===

/** Number of tiles each player must pass in a standard Charleston pass. */
export const CHARLESTON_PASS_COUNT = 3;

// === Timer UI Thresholds ===

/** Call window countdown turns red (warning) at or below this many seconds. */
export const CALL_WINDOW_WARNING_SECONDS = 2;

/** Charleston phase countdown turns red (warning) at or below this many seconds. */
export const CHARLESTON_TIMER_WARNING_SECONDS = 10;

// === UI Timing ===

/** Debounce window for game action buttons to prevent accidental double-clicks. */
export const ACTION_BUTTON_DEBOUNCE_MS = 500;

/** How long the "Leaving game…" / "Forfeiting…" overlay is shown before the callback fires. */
export const LEAVE_FORFEIT_OVERLAY_DURATION_MS = 1_500;

/** Delay before auto-clearing tile selection once the maximum count is reached. */
export const TILE_SELECTION_AUTO_CLEAR_DELAY_MS = 300;

// === Auto-Draw Timing ===

/** Maximum number of DrawTile retry attempts before the draw is marked as failed. */
export const AUTO_DRAW_MAX_RETRIES = 3;

/** Initial delay before sending the first DrawTile command on turn start. */
export const AUTO_DRAW_INITIAL_DELAY_MS = 500;

/** Interval between consecutive DrawTile retry attempts. */
export const AUTO_DRAW_RETRY_INTERVAL_MS = 5_000;

// === WebSocket ===

/**
 * Interval at which the client responds to server Ping heartbeats.
 * The server sends Ping every 30 s and times out after 60 s of silence,
 * so 25 s keeps the connection well within the deadline.
 */
export const WS_HEARTBEAT_INTERVAL_MS = 25_000;
