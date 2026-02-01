# 11. UI/UX Design Specification

This document defines the visual design, layout, interaction patterns, and user experience for the American Mahjong client.

## 11.1 Design Philosophy

### Core Principles

1. **Clarity Over Decoration** - Game state should be immediately visible
2. **Responsive First** - Design for mobile, enhance for desktop
3. **Accessibility by Default** - Keyboard navigation, screen readers, high contrast
4. **Minimal Cognitive Load** - Reduce decisions during gameplay
5. **Progressive Disclosure** - Show information when relevant

### Design Goals

- **Approachable**: New players can understand the interface quickly
- **Efficient**: Experienced players can play rapidly without friction
- **Delightful**: Smooth animations and satisfying interactions
- **Trustworthy**: Visual feedback confirms every action

---

## 11.2 Visual Design System

### 11.2.1 Color Palette

#### Brand Colors

```css
--color-primary: #2563eb; /* Blue-600 - Primary actions */
--color-primary-hover: #1d4ed8; /* Blue-700 */
--color-primary-light: #dbeafe; /* Blue-50 - Backgrounds */

--color-secondary: #7c3aed; /* Violet-600 - Secondary actions */
--color-secondary-hover: #6d28d9; /* Violet-700 */

--color-accent: #059669; /* Emerald-600 - Success/highlights */
--color-accent-hover: #047857; /* Emerald-700 */
```text

#### Tile Suit Colors

```css
/* Differentiate suits for quick recognition */
--color-bam: #10b981; /* Green-500 - Bamboo */
--color-crak: #ef4444; /* Red-500 - Character */
--color-dot: #3b82f6; /* Blue-500 - Dot/Circle */
--color-wind: #6b7280; /* Gray-500 - Winds */
--color-dragon-green: #10b981; /* Green-500 - Green Dragon (matches Bam) */
--color-dragon-red: #ef4444; /* Red-500 - Red Dragon (matches Crak) */
--color-dragon-white: #3b82f6; /* Blue-500 - White/Soap Dragon (matches Dot) */
--color-flower: #ec4899; /* Pink-500 - Flowers */
--color-joker: #a855f7; /* Purple-500 - Jokers */
```text

#### Semantic Colors

```css
--color-background: #ffffff; /* White */
--color-background-alt: #f9fafb; /* Gray-50 */
--color-background-elevated: #ffffff; /* White with shadow */

--color-surface: #f3f4f6; /* Gray-100 - Cards, panels */
--color-surface-hover: #e5e7eb; /* Gray-200 */

--color-border: #d1d5db; /* Gray-300 */
--color-border-focus: #2563eb; /* Blue-600 */

--color-text-primary: #111827; /* Gray-900 */
--color-text-secondary: #6b7280; /* Gray-500 */
--color-text-disabled: #9ca3af; /* Gray-400 */

--color-success: #10b981; /* Green-500 */
--color-warning: #f59e0b; /* Amber-500 */
--color-error: #ef4444; /* Red-500 */
--color-info: #3b82f6; /* Blue-500 */
```text

#### Game State Colors

```css
--color-my-turn: #dcfce7; /* Green-100 - Your turn highlight */
--color-opponent-turn: #fef3c7; /* Amber-100 - Opponent turn */
--color-charleston: #ddd6fe; /* Violet-100 - Charleston phase */
--color-call-window: #fecaca; /* Red-100 - Call window active */
--color-win: #fef9c3; /* Yellow-100 - Win highlight */
```text

### 11.2.2 Typography

#### Font Stack

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;
--font-display: 'Poppins', 'Inter', sans-serif; /* Headings */
```text

#### Type Scale

```css
--text-xs: 0.75rem; /* 12px - Tiny labels */
--text-sm: 0.875rem; /* 14px - Body small, captions */
--text-base: 1rem; /* 16px - Body text */
--text-lg: 1.125rem; /* 18px - Emphasized text */
--text-xl: 1.25rem; /* 20px - Subheadings */
--text-2xl: 1.5rem; /* 24px - Headings */
--text-3xl: 1.875rem; /* 30px - Large headings */
--text-4xl: 2.25rem; /* 36px - Display text */
```text

#### Font Weights

```css
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```text

### 11.2.3 Spacing System

#### Base Unit: 4px (0.25rem)

```css
--space-0: 0;
--space-1: 0.25rem; /* 4px */
--space-2: 0.5rem; /* 8px */
--space-3: 0.75rem; /* 12px */
--space-4: 1rem; /* 16px */
--space-5: 1.25rem; /* 20px */
--space-6: 1.5rem; /* 24px */
--space-8: 2rem; /* 32px */
--space-10: 2.5rem; /* 40px */
--space-12: 3rem; /* 48px */
--space-16: 4rem; /* 64px */
--space-20: 5rem; /* 80px */
--space-24: 6rem; /* 96px */
```text

### 11.2.4 Border Radius

```css
--radius-sm: 0.125rem; /* 2px - Subtle */
--radius-md: 0.375rem; /* 6px - Default */
--radius-lg: 0.5rem; /* 8px - Cards */
--radius-xl: 0.75rem; /* 12px - Modals */
--radius-2xl: 1rem; /* 16px - Large containers */
--radius-full: 9999px; /* Fully rounded */
```text

### 11.2.5 Shadows

```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
--shadow-2xl: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
```text

### 11.2.6 Tile Dimensions

#### Responsive Tile Sizing

```css
/* Mobile (default) */
--tile-width: 3rem; /* 48px */
--tile-height: 4rem; /* 64px */
--tile-gap: 0.25rem; /* 4px */

/* Tablet (md: 768px+) */
@media (min-width: 768px) {
  --tile-width: 3.5rem; /* 56px */
  --tile-height: 4.5rem; /* 72px */
  --tile-gap: 0.375rem; /* 6px */
}

/* Desktop (lg: 1024px+) */
@media (min-width: 1024px) {
  --tile-width: 4rem; /* 64px */
  --tile-height: 5rem; /* 80px */
  --tile-gap: 0.5rem; /* 8px */
}

/* Large Desktop (xl: 1280px+) */
@media (min-width: 1280px) {
  --tile-width: 4.5rem; /* 72px */
  --tile-height: 5.5rem; /* 88px */
  --tile-gap: 0.5rem; /* 8px */
}
```text

---

## 11.3 Screen Layouts

### 11.3.1 Lobby Screen

**Purpose**: Join or create a game room.

```text
┌──────────────────────────────────────────────┐
│ Header: Logo | Settings                      │
├──────────────────────────────────────────────┤
│                                              │
│         American Mahjong                     │
│         [New Game]  [Join Game]              │
│                                              │
│  ┌────────────────────────────────────┐     │
│  │ Available Rooms:                   │     │
│  │ • Room 123 (3/4 players)           │     │
│  │ • Room 456 (2/4 players)           │     │
│  └────────────────────────────────────┘     │
│                                              │
│  Recent Games | Statistics | Learn           │
│                                              │
└──────────────────────────────────────────────┘
```text

**Components**:

- Header (logo, settings icon)
- Hero section (title, CTA buttons)
- Room list (scrollable, filterable)
- Footer navigation (tabs)

### 11.3.2 Game Screen (Desktop Layout)

**Purpose**: Main game interface during play.

```text
┌──────────────────────────────────────────────────────────────┐
│ Header: Room Info | Turn Indicator | Wall: 88 | [Menu]       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                    ┌─────────────────┐                       │
│                    │  NORTH PLAYER   │                       │
│                    │  ████████████   │ (concealed: 13)      │
│                    │  ┌─┐┌─┐┌─┐     │ (exposed melds)      │
│                    └─────────────────┘                       │
│                                                              │
│  ┌───────────┐     ┌─────────────┐      ┌──────────────┐   │
│  │   WEST    │     │             │      │    EAST      │   │
│  │  ████████ │     │   DISCARD   │      │  ████████    │   │
│  │  ┌─┐┌─┐  │     │    PILE     │      │  ┌─┐┌─┐     │   │
│  └───────────┘     │   [5D][3B]  │      └──────────────┘   │
│                    │   [JO][2C]  │                          │
│                    └─────────────┘                          │
│                                                              │
│                    ┌─────────────────┐                       │
│                    │  SOUTH (YOU)    │                       │
│                    │ ┌─┐┌─┐┌─┐┌─┐┌─┐│                       │
│                    │ │1B│2B│3B│4B│5B││ (your hand)          │
│                    │ └─┘└─┘└─┘└─┘└─┘│                       │
│                    │ ┌───────┐       │                       │
│                    │ │ PUNG  │       │ (exposed melds)      │
│                    │ │[6C][6C][6C]   │                       │
│                    │ └───────┘       │                       │
│                    └─────────────────┘                       │
│                                                              │
│  [Discard] [Call] [Pass] [Sort] [Card]                      │
├──────────────────────────────────────────────────────────────┤
│ Footer: Phase: Playing | Turn: East | Actions: Discarding   │
└──────────────────────────────────────────────────────────────┘
```text

**Key Features**:

- **4-player layout**: North (top), East (right), South (bottom/you), West (left)
- **Rotation**: Your position always at bottom
- **Discard pile**: Center, chronological order
- **Action bar**: Context-sensitive buttons
- **Status bar**: Current phase, turn, wall count

### 11.3.3 Game Screen (Mobile Layout - Portrait)

```text
┌──────────────────────┐
│ [≡] | Turn: E | 88   │
├──────────────────────┤
│                      │
│   ┌────────────┐     │
│   │ ACROSS (N) │     │
│   │ ████████   │     │
│   └────────────┘     │
│                      │
│  ┌──────────────┐    │
│  │ LEFT    RIGHT│    │
│  │ (W)      (E) │    │
│  │ ████     ████│    │
│  └──────────────┘    │
│                      │
│  ┌──────────────┐    │
│  │  DISCARDS    │    │
│  │ [5D][3B]     │    │
│  └──────────────┘    │
│                      │
├──────────────────────┤
│  YOUR HAND (YOU)     │
│ ┌─┐┌─┐┌─┐┌─┐┌─┐     │
│ │1B│2B│3B│4B│5B│...  │
│ └─┘└─┘└─┘└─┘└─┘     │
│                      │
│ [Discard] [Call]     │
└──────────────────────┘
```text

**Mobile Adaptations**:

- **Vertical layout**: Stack players vertically
- **Compact tiles**: Smaller tile size
- **Swipeable hand**: Horizontal scroll for tiles
- **Bottom sheet actions**: Modal for actions
- **Hamburger menu**: Collapsed settings

### 11.3.4 Charleston Phase Screen

**Purpose**: Select and pass tiles during Charleston.

```text
┌──────────────────────────────────────────────┐
│ Charleston: First Right Pass                 │
├──────────────────────────────────────────────┤
│                                              │
│  Select 3 tiles to pass right →             │
│                                              │
│  Your Hand:                                  │
│  ┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐┌─┐  │
│  │1B│2B│3B│4C│5C│6D│7D│8D│9D│E │S │W │JO│  │
│  └─┘└─┘└─┘└─┘└─┘└─┘└─┘└─┘└─┘└─┘└─┘└─┘└─┘  │
│                                              │
│  Selected (3):                               │
│  ┌─┐┌─┐┌─┐                                  │
│  │9D│E │S │                                  │
│  └─┘└─┘└─┘                                  │
│                                              │
│  Pass Direction: RIGHT →                    │
│  ┌─────────────────────────────────┐        │
│  │ Players Ready: 3/4              │        │
│  │ Waiting for: West               │        │
│  └─────────────────────────────────┘        │
│                                              │
│  [Confirm Pass] [Cancel Selection]          │
│                                              │
└──────────────────────────────────────────────┘
```text

**Features**:

- **Selection indicator**: Highlight selected tiles
- **Count badge**: Show "3/3" when ready
- **Direction arrow**: Visual indicator of pass direction
- **Player status**: Who's ready to pass
- **Confirmation**: Prevent accidental passes

### 11.3.5 Call Window Overlay

**Purpose**: Prompt to call or pass a discarded tile.

```text
┌──────────────────────────────────────────────┐
│                Game Board                    │
│  (Background dimmed 50%)                     │
│                                              │
│         ┌────────────────────────┐           │
│         │  CALL WINDOW (8s)      │           │
│         ├────────────────────────┤           │
│         │  East discarded:       │           │
│         │      ┌─────┐            │           │
│         │      │ 7 BAM│           │           │
│         │      └─────┘            │           │
│         │                        │           │
│         │  Do you want to call?  │           │
│         │                        │           │
│         │  [Pung] [Kong] [Pass]  │           │
│         └────────────────────────┘           │
│                                              │
│  Countdown timer: ████████░░ (8s)            │
│                                              │
└──────────────────────────────────────────────┘
```text

**Features**:

- **Modal overlay**: Dim background, focus attention
- **Tile preview**: Large display of discarded tile
- **Countdown timer**: Visual progress bar
- **Action buttons**: Clear call type options
- **Auto-close**: Dismiss on timeout or selection

### 11.3.6 Card Viewer (NMJL Pattern Card)

**Purpose**: Display the official NMJL card patterns.

```text
┌──────────────────────────────────────────────┐
│ 2025 NMJL Card                    [Close ×] │
├──────────────────────────────────────────────┤
│ [All] [2468] [Quints] [Singles] [Winds]     │ (Filter tabs)
├──────────────────────────────────────────────┤
│                                              │
│  2468 (20 points)                            │
│  ┌────────────────────────────────────┐     │
│  │ 2222 4444 6666 88                  │     │
│  │ (Any suit, same suit)              │     │
│  └────────────────────────────────────┘     │
│                                              │
│  2468 (25 points) ⭐                         │
│  ┌────────────────────────────────────┐     │
│  │ 222 444 666 88                     │     │
│  │ (Any 3 suits)                      │     │
│  └────────────────────────────────────┘     │
│  ⭐ = Matches 5+ tiles in your hand         │
│                                              │
│  (Scroll for more patterns...)              │
│                                              │
└──────────────────────────────────────────────┘
```text

**Features**:

- **Filter by section**: Tabs for each card section
- **Pattern highlight**: Star patterns matching your hand
- **Tile representation**: Visual tile display
- **Score display**: Show point values
- **Searchable**: Quick filter by keyword

---

## 11.4 Component Specifications

### 11.4.1 Tile Component

**Visual States**:

1. **Default**: Normal appearance
2. **Hover**: Slight lift effect (scale 1.05)
3. **Selected**: Raised position (translateY -8px), border highlight
4. **Disabled**: Grayscale, opacity 0.5
5. **Hidden**: Back face showing (for opponent tiles)
6. **Highlighted**: Glowing border (during hints/matches)

**Variants**:

- **Size**: `xs`, `sm`, `md`, `lg`, `xl`
- **Interactive**: `true` (clickable), `false` (display only)
- **Orientation**: `vertical` (normal), `horizontal` (in exposed melds)

**Accessibility**:

- `role="button"` when interactive
- `aria-label="1 Bamboo"` for screen readers
- Keyboard focusable with visible focus ring

### 11.4.2 Button Component

**Variants**:

```typescript
variant: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
size: 'sm' | 'md' | 'lg';
state: 'idle' | 'loading' | 'disabled';
```text

**Visual Examples**:

- **Primary**: Solid blue, white text, for main actions (Discard, Confirm)
- **Secondary**: Outline blue, blue text, for alternative actions (Sort, Cancel)
- **Danger**: Solid red, white text, for destructive actions (Leave Game)
- **Ghost**: Transparent, gray text, for subtle actions (Close)
- **Outline**: Border only, for secondary emphasis

### 11.4.3 Card (Container) Component

**Purpose**: Elevated surface for grouping related content.

**Variants**:

- **Default**: White background, subtle shadow
- **Elevated**: Larger shadow, higher z-index
- **Outlined**: Border instead of shadow
- **Flat**: No shadow, just background color

### 11.4.4 Hand Component

**Layout**:

- **Desktop**: Horizontal row, all tiles visible
- **Mobile**: Horizontal scroll, tiles compressed

**Features**:

- **Sorting**: Visual animation when tiles reorder
- **Grouping**: Automatically group by suit (optional)
- **Selection**: Multi-select for Charleston

### 11.4.5 Player Area Component

**Displays**:

- Player name
- Seat position (East, South, West, North)
- Tile count (concealed)
- Exposed melds (visible to all)
- Status indicator (active turn, ready, disconnected)

**Orientation**:

- **Across from you** (North): Tiles face down, horizontal layout
- **Left/Right** (West/East): Tiles face down, vertical layout
- **You** (South): Tiles face up, full detail

---

## 11.5 Interaction Patterns

### 11.5.1 Tile Selection

**Desktop**:

- **Click**: Select/deselect tile
- **Shift+Click**: Range select (Charleston)
- **Drag**: Reorder within hand (optional)

**Mobile**:

- **Tap**: Select/deselect tile
- **Long press**: Show tile details/menu
- **Drag**: Reorder within hand

### 11.5.2 Discard Flow

1. User selects tile from hand (tile raises up)
2. "Discard" button becomes enabled
3. User clicks "Discard"
4. Tile animates from hand to discard pile (500ms)
5. Call window opens for other players
6. Turn advances when window closes

### 11.5.3 Call Flow

1. Discard event triggers call window modal
2. Timer counts down (10 seconds default)
3. User clicks "Pung", "Kong", or "Pass"
4. If multiple players call, server resolves priority
5. Winner's meld animates to exposed area
6. Turn changes to calling player

### 11.5.4 Charleston Flow

1. Phase indicator shows "Charleston: First Right"
2. User selects exactly 3 tiles (highlight selected)
3. "Confirm Pass" button enables when 3 selected
4. User confirms
5. Tiles animate right/across/left based on direction
6. Wait for all players (progress indicator)
7. Received tiles animate in from direction
8. Repeat for each Charleston stage

---

## 11.6 Animation Specifications

### 11.6.1 Timing Functions

```css
--ease-default: cubic-bezier(0.4, 0, 0.2, 1); /* Smooth default */
--ease-in: cubic-bezier(0.4, 0, 1, 1); /* Accelerate */
--ease-out: cubic-bezier(0, 0, 0.2, 1); /* Decelerate */
--ease-in-out: cubic-bezier(0.4, 0, 0.2, 1); /* Both */
--ease-bounce: cubic-bezier(0.68, -0.55, 0.265, 1.55); /* Bounce */
--ease-spring: cubic-bezier(0.175, 0.885, 0.32, 1.275); /* Spring */
```text

### 11.6.2 Animation Durations

```css
--duration-instant: 100ms; /* Immediate feedback */
--duration-fast: 200ms; /* Quick transitions */
--duration-normal: 300ms; /* Default animations */
--duration-slow: 500ms; /* Deliberate motion */
--duration-slower: 800ms; /* Special sequences */
```text

### 11.6.3 Specific Animations

#### Tile Discard

- **Duration**: 500ms
- **Easing**: `ease-out`
- **Path**: Curved arc from hand to discard pile
- **Effect**: Slight rotation (5deg), scale down (0.9x)

#### Charleston Pass

- **Duration**: 1000ms
- **Easing**: `ease-in-out`
- **Path**: Linear slide in direction (right/across/left)
- **Effect**: Fade out midway, fade in at destination

#### Call Window Open

- **Duration**: 200ms
- **Easing**: `ease-out`
- **Effect**: Scale from 0.95 to 1, fade in, backdrop blur

#### Meld Exposure

- **Duration**: 400ms
- **Easing**: `ease-spring`
- **Path**: From hand position to exposed area
- **Effect**: Stagger each tile (50ms delay)

#### Win Declaration

- **Duration**: 2000ms (multi-stage)
- **Stages**:
  1. Pause (200ms)
  2. Winning hand highlights (300ms)
  3. Confetti effect (1500ms)
  4. Score display (fade in, 300ms)

---

## 11.7 Responsive Breakpoints

```css
/* Mobile First */
/* Default styles for mobile (320px+) */

/* Small devices (landscape phones, 576px+) */
@media (min-width: 576px) { ... }

/* Medium devices (tablets, 768px+) */
@media (min-width: 768px) {
  /* Switch to 2-column layouts */
  /* Increase tile size */
  /* Show sidebar */
}

/* Large devices (desktops, 1024px+) */
@media (min-width: 1024px) {
  /* 4-player layout side-by-side */
  /* Full tile size */
  /* Persistent card viewer */
}

/* Extra large devices (large desktops, 1280px+) */
@media (min-width: 1280px) {
  /* Maximum tile size */
  /* Additional panels */
}
```text

---

## 11.8 Accessibility

### 11.8.1 Keyboard Navigation

**Global Shortcuts**:

- `1-9`: Select tile by position
- `Space`: Discard selected tile
- `C`: Call tile (during call window)
- `P`: Pass (during call window)
- `S`: Sort hand
- `Tab`: Navigate between interactive elements
- `Esc`: Close modals, deselect tiles
- `?`: Show keyboard shortcuts help

### 11.8.2 Screen Reader Support

**Live Regions**:

```html
<div aria-live="polite" aria-atomic="true">Turn changed to East. East is drawing.</div>

<div aria-live="assertive" aria-atomic="true">Call window opened. 8 seconds to decide.</div>
```text

**ARIA Labels**:

- All interactive elements have descriptive labels
- Tile components announce suit and rank
- Game state changes announced to screen readers

### 11.8.3 Visual Accessibility

**Color Contrast**:

- Minimum 4.5:1 for normal text (WCAG AA)
- Minimum 3:1 for large text
- Don't rely solely on color (use icons + text)

**Focus Indicators**:

- Visible focus ring (2px solid blue, 2px offset)
- Never `outline: none` without alternative

**Text Scaling**:

- Use `rem` units for all font sizes
- Test at 200% browser zoom
- Ensure no horizontal scrolling at 200%

---

## 11.9 Dark Mode (Future)

**Strategy**: Design for light mode first, add dark mode later.

**Dark Palette** (when implemented):

```css
--color-background-dark: #111827; /* Gray-900 */
--color-surface-dark: #1f2937; /* Gray-800 */
--color-text-primary-dark: #f9fafb; /* Gray-50 */
--color-text-secondary-dark: #9ca3af; /* Gray-400 */
```text

**Implementation**:

- Use CSS custom properties for all colors
- `prefers-color-scheme: dark` media query
- Toggle in settings to override system preference

---

## 11.10 Performance Budget

**Targets**:

- **First Contentful Paint**: < 1.5s
- **Time to Interactive**: < 3s
- **Bundle Size**: < 200KB (gzipped)
- **Animation FPS**: 60fps (16.67ms/frame)

**Strategies**:

- Lazy load screens (code splitting)
- Preload critical assets (tile images)
- Optimize images (WebP with fallback)
- Minimize re-renders (memo, selectors)

---

## 11.11 Related Documentation

- [Frontend Architecture](10-frontend-architecture.md) - Technical implementation
- [State Machine Design](04-state-machine-design.md) - Game phases and flow
- [PLANNING.md](../../PLANNING.md) - User stories and features

---

**Last Updated**: 2026-01-04
