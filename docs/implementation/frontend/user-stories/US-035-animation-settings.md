# US-035: Animation Settings

## Story

**As a** player
**I want** to control animation behavior locally
**So that** gameplay matches my performance and accessibility needs

## Acceptance Criteria

### AC-1: Local-Only Preferences

**Given** I open animation settings
**When** I change any setting
**Then** the change is applied locally without contacting the backend
**And** settings are persisted in local storage

### AC-2: Speed Control

**Given** the animation settings panel is visible
**When** I choose a speed preset (off, fast, normal, slow)
**Then** the speed applies to all animation timings
**And** "off" disables animations entirely

### AC-3: Per-Animation Toggles

**Given** the animation settings panel is visible
**When** I toggle a specific animation type
**Then** that animation is enabled or disabled independently

### AC-4: Reduced Motion Respect

**Given** the system preference is `prefers-reduced-motion`
**When** the app loads
**Then** reduced-motion is respected by default
**And** the user may override it in settings

### AC-5: Persistence Across Sessions

**Given** I set animation preferences
**When** I reload the app
**Then** the same preferences are restored

## Backend Integration

- **Outbound**: None
- **Inbound**: None

## Component References

- `AnimationSettings` panel
- `useAnimationSettings` hook

## Testing Strategy

- Verify settings persist to local storage.
- Verify speed and toggles affect animation timings.
- Verify reduced-motion defaults are respected.
