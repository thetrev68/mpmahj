# PlayerAvatar Component Specification

## Component Type

Presentational Component

## Purpose

Displays player avatar with seat indicator, turn status, and connection state. Provides visual identity and status for each player at the game table.

## Related User Stories

- US-024: Observe Opponents (opponent avatars)
- US-020: Join Game Room (player list with avatars)
- US-021: Room Configuration (host indicator)
- US-025: Player Status Indicators (turn, connection, ready state)

## TypeScript Interface

```typescript
export interface PlayerAvatarProps {
  /** Player display name */
  name: string;

  /** Seat position */
  seat: 'East' | 'South' | 'West' | 'North';

  /** Avatar image URL or null for default */
  avatarUrl?: string | null;

  /** Player's current status */
  status?: 'active' | 'away' | 'disconnected' | 'ready' | 'waiting';

  /** Whether it's this player's turn */
  isTurn?: boolean;

  /** Whether this is the room host */
  isHost?: boolean;

  /** Whether this is the dealer */
  isDealer?: boolean;

  /** Whether this is the current user */
  isCurrentUser?: boolean;

  /** Whether this is a bot player */
  isBot?: boolean;

  /** Size variant */
  size?: 'small' | 'medium' | 'large';

  /** Show seat label */
  showSeat?: boolean;

  /** Show name label */
  showName?: boolean;

  /** Show status indicator dot */
  showStatus?: boolean;

  /** Click handler for player interaction */
  onClick?: () => void;

  /** Additional CSS classes */
  className?: string;
}
```text

## State Management

**Stateless** - All state managed by parent components.

## Visual Design

### Size Variants

- **small**: 32px diameter (compact room list, history)
- **medium**: 48px diameter (game table default)
- **large**: 64px diameter (player profile, lobby)

### Avatar Display

- **Image**: Circular crop of avatarUrl
- **Fallback**: First letter of name in colored circle
- **Bot indicator**: Robot icon overlay
- **Seat color**: Border color matches seat
  - East: Red (#ef4444)
  - South: Green (#10b981)
  - West: White (#ffffff with gray border)
  - North: Blue (#3b82f6)

### Status Indicators

#### Turn Indicator

- Glowing ring around avatar (pulsing animation)
- Color: `var(--color-my-turn)` for current user, `var(--color-opponent-turn)` for others
- Animation: 2s ease-in-out infinite pulse
- Thickness: 3px border

#### Dealer Indicator

- "D" badge in top-right corner
- Background: Gold (#fbbf24)
- Position: Overlays avatar at 2 o'clock
- Size: 16px circle (small), 20px (medium), 24px (large)

#### Host Indicator

- Crown icon in top-left corner
- Color: Gold (#fbbf24)
- Position: Overlays avatar at 10 o'clock
- Size: 16px (small), 18px (medium), 20px (large)

#### Connection Status Dot

- 8px circle in bottom-right corner
- Colors:
  - Active: Green (#10b981)
  - Away: Yellow (#fbbf24)
  - Disconnected: Red (#ef4444)
  - Ready: Blue (#3b82f6)
  - Waiting: Gray (#6b7280)

### Seat Labels

- Position: Below avatar
- Font: `var(--text-xs)` (small), `var(--text-sm)` (medium/large)
- Color: Matches seat border color
- Weight: `var(--font-semibold)`

### Name Labels

- Position: Below seat label (or below avatar if no seat)
- Font: `var(--text-xs)` (small), `var(--text-sm)` (medium/large)
- Color: `var(--color-text-primary)`
- Truncation: Max 12 characters with ellipsis

### Visual Effects

- Hover (if interactive): Scale 1.05, shadow elevation
- Turn pulse: 2s ease-in-out infinite (0.95 → 1.0 scale)
- Status change: 300ms fade transition
- Click: Scale 0.98, 100ms

## Accessibility

### ARIA Attributes

- `role="img"` for avatar container
- `aria-label`: "{name}, {seat}, {status description}"
  - Example: "Alice, East seat, dealer, your turn"
- `aria-labelledby`: Links to name and seat text elements
- `tabIndex={onClick ? 0 : -1}` for keyboard navigation when interactive
- `aria-pressed`: Not used (not a toggle)

### Keyboard Support (when interactive)

- `Tab`: Focus avatar
- `Enter` or `Space`: Trigger onClick
- Focus visible indicator: 2px outline

### Screen Reader Announcements

- On focus: Full player status
- On turn change: "Now {name}'s turn"
- On connection change: "{name} {status}"
- Dealer indicator: "dealer" in aria-label
- Host indicator: "room host" in aria-label

### Focus Management

- Interactive avatars receive focus
- Static avatars not in tab order
- Focus ring visible on keyboard navigation

## Dependencies

### External

- React
- `clsx` for conditional class names

### Internal

- `@/components/icons/CrownIcon` - Host indicator
- `@/components/icons/BotIcon` - Bot player indicator
- `@/styles/playerAvatar.module.css` - Component styles
- `@/utils/colors` - Seat color mapping

### Generated Types

- `@/types/bindings/generated/Seat.ts` - Seat enum

## Implementation Notes

### Performance Optimizations

1. **Memoization**: Wrap with `React.memo()` to prevent re-renders
2. **CSS animations**: Use GPU-accelerated transforms for pulse effect
3. **Image lazy loading**: Load avatars only when visible
4. **Fallback caching**: Cache generated fallback avatars

### Fallback Avatar Generation

```typescript
function generateFallbackAvatar(name: string, seat: Seat): string {
  const initial = name.charAt(0).toUpperCase();
  const color = getSeatColor(seat);

  // Generate SVG data URL with initial and background color
  return `data:image/svg+xml,<svg>...</svg>`;
}
```text

### Error Handling

- Invalid avatarUrl: Use fallback with name initial
- Missing name: Display "?" with gray background
- Invalid seat: Default to East (log warning)
- Image load failure: Gracefully fall back to initial

### Responsive Behavior

- Mobile: Default to 'small' size, hide name labels
- Tablet: 'medium' size, show compact labels
- Desktop: Full size with all indicators
- Touch targets: Minimum 44×44px when interactive

## Test Scenarios

### Unit Tests

```typescript
describe('PlayerAvatar', () => {
  it('renders player name correctly', () => {
    // name="Alice" should display "Alice"
  });

  it('renders seat label when shown', () => {
    // seat='East', showSeat=true should display "East"
  });

  it('displays avatar image when URL provided', () => {
    // avatarUrl should be used as image src
  });

  it('displays fallback initial when no avatar', () => {
    // name="Bob", avatarUrl=null should show "B"
  });

  it('applies seat border color', () => {
    // seat='South' should have green border
  });

  it('shows turn indicator when isTurn', () => {
    // isTurn=true should show pulsing ring
  });

  it('shows dealer badge when isDealer', () => {
    // isDealer=true should show "D" badge
  });

  it('shows host crown when isHost', () => {
    // isHost=true should show crown icon
  });

  it('shows bot indicator when isBot', () => {
    // isBot=true should show robot icon
  });

  it('displays correct status dot color', () => {
    // status='disconnected' should show red dot
  });

  it('calls onClick when clicked', () => {
    // Click should trigger handler
  });

  it('truncates long names', () => {
    // name="VeryLongPlayerName" should truncate with ellipsis
  });

  it('applies size class correctly', () => {
    // size='large' should apply 64px diameter
  });

  it('sets correct aria-label', () => {
    // Should include name, seat, and status
  });
});
```text

### Integration Tests

```typescript
describe('PlayerAvatar Integration', () => {
  it('updates turn indicator on state change', () => {
    // isTurn changes should update visual
  });

  it('handles avatar image load failure', () => {
    // Invalid URL should fall back gracefully
  });

  it('supports keyboard interaction when clickable', () => {
    // Tab focus, Enter activation
  });

  it('announces status changes to screen readers', () => {
    // Status updates should update aria-live region
  });
});
```text

### Visual Regression Tests

- All size variants with each seat color
- All status states (active, away, disconnected, ready)
- Turn indicator animation frames
- Dealer and host badge combinations
- Fallback avatar rendering
- Image avatar with all indicators

## Usage Examples

### Game Table Display

```tsx
import { PlayerAvatar } from '@/components/game/PlayerAvatar';

function GameTable({ players, currentSeat, dealerSeat }) {
  return (
    <div className="game-table">
      {players.map((player) => (
        <PlayerAvatar
          key={player.seat}
          name={player.name}
          seat={player.seat}
          avatarUrl={player.avatarUrl}
          status={player.connectionStatus}
          isTurn={currentSeat === player.seat}
          isDealer={dealerSeat === player.seat}
          isCurrentUser={player.isCurrentUser}
          isBot={player.isBot}
          size="medium"
          showSeat
          showName
          showStatus
        />
      ))}
    </div>
  );
}
```text

### Room Lobby Player List

```tsx
function PlayerList({ players, hostId }) {
  return (
    <div className="player-list">
      {players.map((player) => (
        <PlayerAvatar
          key={player.id}
          name={player.name}
          seat={player.seat}
          avatarUrl={player.avatarUrl}
          status={player.readyState ? 'ready' : 'waiting'}
          isHost={player.id === hostId}
          size="small"
          showName
          showStatus
        />
      ))}
    </div>
  );
}
```text

### Compact Display (History)

```tsx
function MoveHistoryEntry({ move }) {
  return (
    <div className="history-entry">
      <PlayerAvatar
        name={move.playerName}
        seat={move.seat}
        size="small"
        showSeat={false}
        showName={false}
      />
      <span>{move.action}</span>
    </div>
  );
}
```text

### Interactive Profile Click

```tsx
function PlayerCard({ player, onViewProfile }) {
  return (
    <PlayerAvatar
      name={player.name}
      seat={player.seat}
      avatarUrl={player.avatarUrl}
      size="large"
      showName
      showSeat
      onClick={() => onViewProfile(player.id)}
    />
  );
}
```text

## Style Guidelines

### CSS Module Structure

```css
.avatar-container {
  position: relative;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
}

.avatar {
  position: relative;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid transparent;
  transition: all 0.2s ease-out;
}

.avatar--small {
  width: 2rem;
  height: 2rem;
}
.avatar--medium {
  width: 3rem;
  height: 3rem;
}
.avatar--large {
  width: 4rem;
  height: 4rem;
}

/* Seat colors */
.avatar--east {
  border-color: #ef4444;
}
.avatar--south {
  border-color: #10b981;
}
.avatar--west {
  border-color: #6b7280;
}
.avatar--north {
  border-color: #3b82f6;
}

/* Turn indicator */
.avatar--turn {
  animation: pulse 2s ease-in-out infinite;
  box-shadow: 0 0 0 3px var(--color-my-turn);
}

@keyframes pulse {
  0%,
  100% {
    transform: scale(0.95);
    opacity: 0.8;
  }
  50% {
    transform: scale(1);
    opacity: 1;
  }
}

/* Badges */
.dealer-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  width: 20px;
  height: 20px;
  background: #fbbf24;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: bold;
  border: 2px solid white;
}

.status-dot {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  border: 2px solid white;
}

.status-dot--active {
  background: #10b981;
}
.status-dot--away {
  background: #fbbf24;
}
.status-dot--disconnected {
  background: #ef4444;
}
```text

## Future Enhancements

- [ ] Animated avatar borders for special events
- [ ] Custom avatar upload support
- [ ] Avatar selection modal
- [ ] Player statistics tooltip on hover
- [ ] Achievement badges overlay
- [ ] Voice chat indicator
- [ ] Emote animation overlay
- [ ] Theme-based avatar frames

## Notes

- Seat colors follow traditional mahjong seat conventions
- Turn indicator pulse should be subtle, not distracting
- Bot players distinguished by icon to prevent confusion
- Connection status critical for multiplayer experience
- Avatar images should be moderated/validated before upload
- Fallback initials ensure every player has recognizable avatar
