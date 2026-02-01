# 12. Component Design Specification

This document provides detailed specifications for all React components in the American Mahjong client, including props, state, behavior, and implementation guidelines.

## 12.0 Tile Model Update (2026-01-04)

Tile is now represented as `Tile` (u8) in the shared bindings. Components should treat tiles as numeric ids and use helper utilities to map to labels and assets. See `docs/architecture/frontend/15-tile-rendering-and-assets.md` for the definitive mapping and asset naming.

## 12.1 Component Architecture Principles

### 12.1.1 Design Philosophy

1. **Single Responsibility** - Each component has one clear purpose
2. **Composition over Inheritance** - Build complex UIs from simple components
3. **Presentational vs Container** - Separate UI from business logic
4. **Props Down, Events Up** - Unidirectional data flow
5. **Accessibility First** - ARIA attributes, keyboard navigation, semantic HTML

### 12.1.2 Component Categories

```text
components/
├── game/           # Game-specific components (Table, Tile, Hand)
├── ui/             # Reusable UI primitives (Button, Card, Modal)
├── layout/         # Page layouts and containers
└── features/       # Feature-specific composites (Charleston, CallWindow)
```text

### 12.1.3 TypeScript Conventions

```typescript
// Props interface naming: {ComponentName}Props
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

// Use functional components with explicit return type
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  onClick,
  children,
}) => {
  // Implementation
};
```text

---

## 12.2 Core UI Components (`components/ui/`)

### 12.2.1 Button

**Purpose**: Primary interactive element for user actions.

**Props**:

```typescript
interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  children: React.ReactNode;
  className?: string;
}
```text

**Implementation Details**:

```typescript
export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  onClick,
  type = 'button',
  children,
  className,
}) => {
  const baseClasses = 'btn';
  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    danger: 'btn-danger',
    ghost: 'btn-ghost',
    outline: 'btn-outline',
  };
  const sizeClasses = {
    sm: 'btn-sm',
    md: 'btn-md',
    lg: 'btn-lg',
  };

  const classes = cn(
    baseClasses,
    variantClasses[variant],
    sizeClasses[size],
    {
      'btn-full': fullWidth,
      'btn-loading': loading,
      'opacity-50 cursor-not-allowed': disabled,
    },
    className
  );

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      aria-busy={loading}
    >
      {loading && <Spinner size="sm" />}
      {!loading && icon && iconPosition === 'left' && icon}
      <span>{children}</span>
      {!loading && icon && iconPosition === 'right' && icon}
    </button>
  );
};
```text

**CSS** (Tailwind):

```css
.btn {
  @apply inline-flex items-center justify-center gap-2 rounded-md font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2;
}

.btn-primary {
  @apply bg-primary text-white hover:bg-primary-hover focus:ring-primary;
}

.btn-secondary {
  @apply border border-primary text-primary hover:bg-primary-light focus:ring-primary;
}

.btn-danger {
  @apply bg-error text-white hover:bg-red-600 focus:ring-error;
}

.btn-ghost {
  @apply text-text-secondary hover:bg-surface focus:ring-gray-300;
}

.btn-outline {
  @apply border border-border text-text-primary hover:bg-surface-hover focus:ring-gray-300;
}

.btn-sm {
  @apply px-3 py-1.5 text-sm;
}

.btn-md {
  @apply px-4 py-2 text-base;
}

.btn-lg {
  @apply px-6 py-3 text-lg;
}

.btn-full {
  @apply w-full;
}

.btn-loading {
  @apply cursor-wait;
}
```text

**Usage Examples**:

```tsx
<Button onClick={handleDiscard}>Discard</Button>
<Button variant="secondary" size="sm">Cancel</Button>
<Button variant="danger" icon={<TrashIcon />}>Delete Game</Button>
<Button loading={isSubmitting}>Confirm Pass</Button>
```text

---

### 12.2.2 Card

**Purpose**: Elevated container for grouping related content.

**Props**:

```typescript
interface CardProps {
  variant?: 'default' | 'elevated' | 'outlined' | 'flat';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
  children: React.ReactNode;
}
```text

**Implementation**:

```typescript
export const Card: React.FC<CardProps> = ({
  variant = 'default',
  padding = 'md',
  className,
  children,
}) => {
  const variantClasses = {
    default: 'bg-background-elevated shadow-md',
    elevated: 'bg-background-elevated shadow-lg',
    outlined: 'border border-border bg-background',
    flat: 'bg-surface',
  };

  const paddingClasses = {
    none: '',
    sm: 'p-3',
    md: 'p-4',
    lg: 'p-6',
  };

  const classes = cn(
    'rounded-lg',
    variantClasses[variant],
    paddingClasses[padding],
    className
  );

  return <div className={classes}>{children}</div>;
};
```text

---

### 12.2.3 Modal

**Purpose**: Focus user attention on a specific task or information.

**Props**:

```typescript
interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  closeOnBackdropClick?: boolean;
  closeOnEscape?: boolean;
  showCloseButton?: boolean;
  children: React.ReactNode;
}
```text

**Implementation**:

```typescript
export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  size = 'md',
  closeOnBackdropClick = true,
  closeOnEscape = true,
  showCloseButton = true,
  children,
}) => {
  // Escape key handler
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, closeOnEscape, onClose]);

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = 'unset';
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    full: 'max-w-full',
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={closeOnBackdropClick ? onClose : undefined}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        />

        {/* Modal Content */}
        <motion.div
          className={cn(
            'relative z-10 w-full bg-background rounded-xl shadow-2xl',
            sizeClasses[size],
            'mx-4 my-8 max-h-[90vh] overflow-y-auto'
          )}
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? 'modal-title' : undefined}
        >
          {/* Header */}
          {(title || showCloseButton) && (
            <div className="flex items-center justify-between p-6 border-b border-border">
              {title && (
                <h2 id="modal-title" className="text-2xl font-semibold">
                  {title}
                </h2>
              )}
              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="text-text-secondary hover:text-text-primary transition-colors"
                  aria-label="Close modal"
                >
                  <XIcon className="w-6 h-6" />
                </button>
              )}
            </div>
          )}

          {/* Body */}
          <div className="p-6">{children}</div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
```text

---

### 12.2.4 Toast / Notification

**Purpose**: Provide temporary feedback messages.

**Props**:

```typescript
interface ToastProps {
  id: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  message: string;
  duration?: number; // milliseconds
  onClose: (id: string) => void;
}
```text

**Implementation**:

```typescript
export const Toast: React.FC<ToastProps> = ({
  id,
  type = 'info',
  message,
  duration = 5000,
  onClose,
}) => {
  useEffect(() => {
    const timer = setTimeout(() => onClose(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const typeStyles = {
    info: 'bg-info text-white',
    success: 'bg-success text-white',
    warning: 'bg-warning text-white',
    error: 'bg-error text-white',
  };

  const icons = {
    info: <InfoIcon />,
    success: <CheckCircleIcon />,
    warning: <AlertTriangleIcon />,
    error: <XCircleIcon />,
  };

  return (
    <motion.div
      className={cn(
        'flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg',
        typeStyles[type]
      )}
      initial={{ opacity: 0, y: -50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.2 }}
      role="alert"
    >
      {icons[type]}
      <span className="flex-1">{message}</span>
      <button
        onClick={() => onClose(id)}
        className="hover:opacity-80"
        aria-label="Close notification"
      >
        <XIcon className="w-5 h-5" />
      </button>
    </motion.div>
  );
};

// Toast Container (renders all toasts)
export const ToastContainer: React.FC = () => {
  const toasts = useUIStore((state) => state.toasts);
  const removeToast = useUIStore((state) => state.removeToast);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <Toast key={toast.id} {...toast} onClose={removeToast} />
        ))}
      </AnimatePresence>
    </div>
  );
};
```text

---

## 12.3 Game Components (`components/game/`)

### 12.3.1 Tile

**Purpose**: Visual representation of a single mahjong tile.

**Props**:

```typescript
interface TileProps {
  tile: Tile; // Tile id (u8 0-36)
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  orientation?: 'vertical' | 'horizontal';
  interactive?: boolean;
  selected?: boolean;
  highlighted?: boolean;
  disabled?: boolean;
  hidden?: boolean; // Show back face
  onClick?: (tile: Tile) => void;
  onDragStart?: (tile: Tile) => void;
  onDragEnd?: () => void;
  className?: string;
}
```text

Use `tileLabel` and `tileAssetPath` from `apps/client/src/utils/tile.ts` for display text and asset mapping.

**Implementation**:

```typescript
export const Tile: React.FC<TileProps> = ({
  tile,
  size = 'md',
  orientation = 'vertical',
  interactive = false,
  selected = false,
  highlighted = false,
  disabled = false,
  hidden = false,
  onClick,
  onDragStart,
  onDragEnd,
  className,
}) => {
  const sizeClasses = {
    xs: 'w-8 h-10',
    sm: 'w-10 h-12',
    md: 'w-12 h-16', // Default mobile
    lg: 'w-16 h-20', // Desktop
    xl: 'w-20 h-24',
  };

  const handleClick = () => {
    if (interactive && !disabled && onClick) {
      onClick(tile);
    }
  };

  const label = tileLabel(tile); // "1 Bam", "East Wind", etc.

  return (
    <motion.div
      className={cn(
        'tile relative rounded-sm overflow-hidden cursor-pointer select-none',
        sizeClasses[size],
        {
          'tile-interactive': interactive,
          'tile-selected': selected,
          'tile-highlighted': highlighted,
          'tile-disabled': disabled,
          'tile-horizontal': orientation === 'horizontal',
        },
        className
      )}
      onClick={handleClick}
      drag={interactive && onDragStart ? true : false}
      dragElastic={0.1}
      onDragStart={() => onDragStart?.(tile)}
      onDragEnd={onDragEnd}
      whileHover={interactive && !disabled ? { scale: 1.05 } : {}}
      whileTap={interactive && !disabled ? { scale: 0.98 } : {}}
      animate={{
        y: selected ? -8 : 0,
        boxShadow: selected
          ? '0 4px 8px rgba(0,0,0,0.2)'
          : '0 1px 3px rgba(0,0,0,0.1)',
      }}
      transition={{ duration: 0.2 }}
      role={interactive ? 'button' : undefined}
      aria-label={label}
      aria-pressed={selected}
      tabIndex={interactive ? 0 : -1}
    >
      {hidden ? (
        <TileBack size={size} />
      ) : (
        <TileFace tile={tile} size={size} />
      )}

      {/* Selection indicator */}
      {selected && (
        <div className="absolute inset-0 border-2 border-primary rounded-sm pointer-events-none" />
      )}

      {/* Highlight indicator */}
      {highlighted && (
        <motion.div
          className="absolute inset-0 border-2 border-accent rounded-sm pointer-events-none"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}
    </motion.div>
  );
};

// Helper: Render tile face (SVG or image)
const TileFace: React.FC<{ tile: Tile; size: string }> = ({ tile, size }) => {
  const imagePath = tileAssetPath(tile); // e.g., "/assets/tiles/Mahjong_1m.svg"

  return (
    <div className="w-full h-full border border-gray-300 flex items-center justify-center">
      {/* SVG tiles have their own cream background (#f5f0eb) */}
      <img
        src={imagePath}
        alt={tileLabel(tile)}
        className="w-full h-full object-contain"
      />
    </div>
  );
};

// Helper: Render tile back
const TileBack: React.FC<{ size: string }> = ({ size }) => {
  return (
    <div className="w-full h-full bg-gradient-to-br from-blue-600 to-blue-800 border border-gray-400 flex items-center justify-center">
      <div className="text-white text-xs font-bold opacity-50">MAH</div>
    </div>
  );
};
```text

**CSS**:

```css
.tile {
  @apply shadow-sm transition-all;
}

.tile-interactive {
  @apply hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2;
}

.tile-disabled {
  @apply opacity-50 cursor-not-allowed grayscale;
}

.tile-horizontal {
  @apply transform rotate-90;
}
```text

---

### 12.3.2 Hand

**Purpose**: Display player's hand of tiles.

**Props**:

```typescript
interface HandProps {
  tiles: Tile[];
  selectedTiles?: Set<string>; // tileKey(tile, index)
  highlightedTiles?: Set<string>;
  onTileClick?: (tile: Tile, index: number) => void;
  sortable?: boolean;
  maxSelection?: number; // For Charleston (e.g., 3)
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}
```text

Use `tileKey`/`parseTileKey` from `apps/client/src/utils/tileKey.ts` to keep keys stable when duplicates exist.

**Implementation**:

```typescript
export const Hand: React.FC<HandProps> = ({
  tiles,
  selectedTiles = new Set(),
  highlightedTiles = new Set(),
  onTileClick,
  sortable = false,
  maxSelection,
  size = 'md',
  className,
}) => {
  const handleTileClick = (tile: Tile, index: number) => {
    if (maxSelection && selectedTiles.size >= maxSelection && !selectedTiles.has(getTileId(tile, index))) {
      // Already at max selection, can't select more
      return;
    }
    onTileClick?.(tile, index);
  };

  return (
    <div className={cn('hand flex gap-1 overflow-x-auto', className)}>
      {tiles.map((tile, index) => {
        const tileId = getTileId(tile, index);
        return (
          <motion.div
            key={tileId}
            layout // Framer Motion auto-animate on sort
            layoutId={tileId}
            transition={{ duration: 0.3 }}
          >
            <Tile
              tile={tile}
              size={size}
              interactive
              selected={selectedTiles.has(tileId)}
              highlighted={highlightedTiles.has(tileId)}
              onClick={() => handleTileClick(tile, index)}
            />
          </motion.div>
        );
      })}
    </div>
  );
};

// Helper: Generate unique tile key
const getTileId = (tile: Tile, index: number): string => {
  return tileKey(tile, index);
};
```text

---

### 12.3.3 ExposedMeld

**Purpose**: Display a revealed Pung, Kong, or Quint.

**Props**:

```typescript
interface ExposedMeldProps {
  meld: Meld; // { type: 'Pung' | 'Kong' | 'Quint', tiles: Tile[] }
  size?: 'xs' | 'sm' | 'md' | 'lg';
  orientation?: 'horizontal' | 'vertical';
  className?: string;
}
```text

**Implementation**:

```typescript
export const ExposedMeld: React.FC<ExposedMeldProps> = ({
  meld,
  size = 'sm',
  orientation = 'horizontal',
  className,
}) => {
  return (
    <div
      className={cn(
        'exposed-meld flex gap-0.5 bg-surface p-2 rounded-md',
        orientation === 'vertical' ? 'flex-col' : 'flex-row',
        className
      )}
    >
      {/* Label */}
      <div className="text-xs text-text-secondary font-medium mb-1">
        {meld.type}
      </div>

      {/* Tiles */}
      <div className={cn('flex gap-0.5', orientation === 'vertical' ? 'flex-col' : 'flex-row')}>
        {meld.tiles.map((tile, idx) => (
          <Tile
            key={idx}
            tile={tile}
            size={size}
            orientation={orientation === 'vertical' ? 'horizontal' : 'vertical'}
          />
        ))}
      </div>
    </div>
  );
};
```text

---

### 12.3.4 DiscardPile

**Purpose**: Display all discarded tiles in chronological order.

**Props**:

```typescript
interface DiscardPileProps {
  discards: Tile[];
  size?: 'xs' | 'sm' | 'md';
  maxVisible?: number; // Show only last N discards
  className?: string;
}
```text

**Implementation**:

```typescript
export const DiscardPile: React.FC<DiscardPileProps> = ({
  discards,
  size = 'sm',
  maxVisible = 12,
  className,
}) => {
  const visibleDiscards = discards.slice(-maxVisible);

  return (
    <div className={cn('discard-pile', className)}>
      <div className="text-xs text-text-secondary mb-2">
        Discards ({discards.length})
      </div>
      <div className="grid grid-cols-4 gap-1">
        {visibleDiscards.map((tile, idx) => (
          <motion.div
            key={idx}
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <Tile tile={tile} size={size} />
          </motion.div>
        ))}
      </div>
    </div>
  );
};
```text

---

### 12.3.5 PlayerArea

**Purpose**: Display opponent's visible information.

**Props**:

```typescript
interface PlayerAreaProps {
  player: PlayerPublic; // { name, seat, tileCount, exposedMelds, isActive }
  position: 'north' | 'east' | 'south' | 'west';
  isCurrentTurn?: boolean;
  className?: string;
}
```text

**Implementation**:

```typescript
export const PlayerArea: React.FC<PlayerAreaProps> = ({
  player,
  position,
  isCurrentTurn = false,
  className,
}) => {
  const isYou = position === 'south';

  return (
    <div
      className={cn(
        'player-area p-3 rounded-lg transition-colors',
        isCurrentTurn ? 'bg-my-turn' : 'bg-surface',
        className
      )}
    >
      {/* Player Info */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className={cn('w-2 h-2 rounded-full', isCurrentTurn ? 'bg-accent animate-pulse' : 'bg-gray-400')} />
          <span className="font-medium">{player.name}</span>
          <span className="text-xs text-text-secondary">({player.seat})</span>
        </div>
        <div className="text-sm text-text-secondary">
          {player.tileCount} tiles
        </div>
      </div>

      {/* Concealed Tiles (Hidden for opponents) */}
      {!isYou && (
        <div className="flex gap-0.5 mb-2">
          {Array.from({ length: player.tileCount }).map((_, idx) => (
            <Tile key={idx} tile={0} size="xs" hidden />
          ))}
        </div>
      )}

      {/* Exposed Melds */}
      {player.exposedMelds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {player.exposedMelds.map((meld, idx) => (
            <ExposedMeld key={idx} meld={meld} size="xs" />
          ))}
        </div>
      )}
    </div>
  );
};
```text

---

### 12.3.6 Table

**Purpose**: 4-player game layout with rotation.

**Props**:

```typescript
interface TableProps {
  players: Record<Seat, PlayerPublic>; // All 4 players
  mySeat: Seat;
  currentTurn: Seat;
  discards: Tile[];
  wallRemaining: number;
  children?: React.ReactNode; // For modals/overlays
}
```text

**Implementation**:

```typescript
export const Table: React.FC<TableProps> = ({
  players,
  mySeat,
  currentTurn,
  discards,
  wallRemaining,
  children,
}) => {
  // Calculate visual positions relative to player
  const getVisualPosition = (seat: Seat): 'north' | 'east' | 'south' | 'west' => {
    const seatOrder: Seat[] = ['East', 'South', 'West', 'North'];
    const myIndex = seatOrder.indexOf(mySeat);
    const targetIndex = seatOrder.indexOf(seat);
    const diff = (targetIndex - myIndex + 4) % 4;

    const positions = ['south', 'west', 'north', 'east'];
    return positions[diff] as 'north' | 'east' | 'south' | 'west';
  };

  const northPlayer = Object.values(players).find(
    (p) => getVisualPosition(p.seat) === 'north'
  );
  const eastPlayer = Object.values(players).find(
    (p) => getVisualPosition(p.seat) === 'east'
  );
  const southPlayer = Object.values(players).find(
    (p) => getVisualPosition(p.seat) === 'south'
  );
  const westPlayer = Object.values(players).find(
    (p) => getVisualPosition(p.seat) === 'west'
  );

  return (
    <div className="table-container relative w-full h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-surface border-b border-border">
        <div className="text-sm">Turn: {currentTurn}</div>
        <div className="text-sm">Wall: {wallRemaining}</div>
      </div>

      {/* Main Table Area */}
      <div className="flex-1 grid grid-cols-[1fr_3fr_1fr] grid-rows-[1fr_2fr_1fr] gap-4 p-4">
        {/* North Player (Top Center) */}
        <div className="col-start-2 row-start-1 flex justify-center">
          {northPlayer && (
            <PlayerArea
              player={northPlayer}
              position="north"
              isCurrentTurn={northPlayer.seat === currentTurn}
            />
          )}
        </div>

        {/* West Player (Left Middle) */}
        <div className="col-start-1 row-start-2 flex items-center">
          {westPlayer && (
            <PlayerArea
              player={westPlayer}
              position="west"
              isCurrentTurn={westPlayer.seat === currentTurn}
            />
          )}
        </div>

        {/* Center: Discard Pile */}
        <div className="col-start-2 row-start-2 flex items-center justify-center">
          <DiscardPile discards={discards} />
        </div>

        {/* East Player (Right Middle) */}
        <div className="col-start-3 row-start-2 flex items-center">
          {eastPlayer && (
            <PlayerArea
              player={eastPlayer}
              position="east"
              isCurrentTurn={eastPlayer.seat === currentTurn}
            />
          )}
        </div>

        {/* South Player (You - Bottom) */}
        <div className="col-start-2 row-start-3 flex flex-col gap-4">
          {southPlayer && (
            <>
              {/* Exposed Melds */}
              {southPlayer.exposedMelds.length > 0 && (
                <div className="flex gap-2 justify-center">
                  {southPlayer.exposedMelds.map((meld, idx) => (
                    <ExposedMeld key={idx} meld={meld} />
                  ))}
                </div>
              )}

              {/* Player Info */}
              <div className="flex items-center justify-center gap-2">
                <div className={cn('w-3 h-3 rounded-full', southPlayer.seat === currentTurn ? 'bg-accent animate-pulse' : 'bg-gray-400')} />
                <span className="font-semibold">{southPlayer.name} (You)</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Overlays (CallWindow, Charleston, etc.) */}
      {children}
    </div>
  );
};
```text

---

## 12.4 Feature Components (`components/features/`)

### 12.4.1 CharlestonInterface

**Purpose**: UI for selecting and passing tiles during Charleston.

**Props**:

```typescript
interface CharlestonInterfaceProps {
  hand: Tile[];
  stage: CharlestonStage; // 'FirstRight' | 'FirstAcross' | 'FirstLeft' | etc.
  selectedTiles: Set<string>;
  onTileToggle: (tile: Tile, index: number) => void;
  onConfirm: () => void;
  onCancel: () => void;
  playersReady: number;
  totalPlayers: number;
}
```text

**Implementation**:

```typescript
export const CharlestonInterface: React.FC<CharlestonInterfaceProps> = ({
  hand,
  stage,
  selectedTiles,
  onTileToggle,
  onConfirm,
  onCancel,
  playersReady,
  totalPlayers,
}) => {
  const direction = getPassDirection(stage); // "Right", "Across", "Left"
  const canConfirm = selectedTiles.size === 3;

  return (
    <div className="charleston-interface bg-charleston p-6 rounded-lg">
      {/* Header */}
      <div className="text-center mb-4">
        <h2 className="text-2xl font-bold">Charleston: {stage}</h2>
        <p className="text-text-secondary">
          Select 3 tiles to pass {direction} →
        </p>
      </div>

      {/* Hand */}
      <Hand
        tiles={hand}
        selectedTiles={selectedTiles}
        onTileClick={onTileToggle}
        maxSelection={3}
        size="lg"
        className="mb-4"
      />

      {/* Selected Preview */}
      <div className="mb-4">
        <div className="text-sm font-medium mb-2">
          Selected ({selectedTiles.size}/3):
        </div>
        <div className="flex gap-2 min-h-[5rem] bg-background p-3 rounded-md">
          {Array.from(selectedTiles).map((tileId) => {
            const parsed = parseTileKey(tileId);
            if (!parsed) return null;
            const tile = hand[parsed.index];
            return <Tile key={tileId} tile={tile} size="md" />;
          })}
        </div>
      </div>

      {/* Player Status */}
      <div className="mb-4 p-3 bg-background rounded-md">
        <div className="text-sm">
          Players Ready: {playersReady}/{totalPlayers}
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
          <div
            className="bg-accent h-2 rounded-full transition-all"
            style={{ width: `${(playersReady / totalPlayers) * 100}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="primary"
          fullWidth
          disabled={!canConfirm}
          onClick={onConfirm}
        >
          Confirm Pass {direction}
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
};
```text

---

### 12.4.2 CallWindow

**Purpose**: Modal for calling a discarded tile.

**Props**:

```typescript
interface CallWindowProps {
  isOpen: boolean;
  discardedTile: Tile;
  discardedBy: Seat;
  timeRemaining: number; // seconds
  availableCalls: ('Pung' | 'Kong' | 'Mahjong')[]; // What can you call?
  onCall: (callType: 'Pung' | 'Kong' | 'Mahjong') => void;
  onPass: () => void;
}
```text

**Implementation**:

```typescript
export const CallWindow: React.FC<CallWindowProps> = ({
  isOpen,
  discardedTile,
  discardedBy,
  timeRemaining,
  availableCalls,
  onCall,
  onPass,
}) => {
  const progressPercent = (timeRemaining / 10) * 100; // Assume 10s window

  return (
    <Modal isOpen={isOpen} onClose={onPass} size="sm" closeOnBackdropClick={false}>
      <div className="text-center">
        {/* Title */}
        <h3 className="text-xl font-bold mb-4">Call Window</h3>

        {/* Discarded Tile */}
        <div className="mb-4">
          <p className="text-sm text-text-secondary mb-2">
            {discardedBy} discarded:
          </p>
          <div className="flex justify-center">
            <Tile tile={discardedTile} size="xl" />
          </div>
        </div>

        {/* Countdown */}
        <div className="mb-6">
          <div className="text-2xl font-bold mb-2">{timeRemaining}s</div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <motion.div
              className="bg-error h-2 rounded-full"
              initial={{ width: '100%' }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.1, ease: 'linear' }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {availableCalls.includes('Mahjong') && (
            <Button
              variant="primary"
              fullWidth
              onClick={() => onCall('Mahjong')}
            >
              Mahjong! (Win)
            </Button>
          )}
          {availableCalls.includes('Kong') && (
            <Button
              variant="primary"
              fullWidth
              onClick={() => onCall('Kong')}
            >
              Kong (4 of a kind)
            </Button>
          )}
          {availableCalls.includes('Pung') && (
            <Button
              variant="primary"
              fullWidth
              onClick={() => onCall('Pung')}
            >
              Pung (3 of a kind)
            </Button>
          )}
          <Button variant="outline" fullWidth onClick={onPass}>
            Pass
          </Button>
        </div>
      </div>
    </Modal>
  );
};
```text

---

### 12.4.3 CardViewer (NMJL Pattern Card)

**Purpose**: Display and filter the official NMJL card.

**Props**:

```typescript
interface CardViewerProps {
  isOpen: boolean;
  onClose: () => void;
  patterns: Pattern[]; // All patterns from card
  hand?: Tile[]; // Optional: Highlight matching patterns
}
```text

**Implementation** (Simplified):

```typescript
export const CardViewer: React.FC<CardViewerProps> = ({
  isOpen,
  onClose,
  patterns,
  hand,
}) => {
  const [activeSection, setActiveSection] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const sections = ['All', '2468', 'Quints', 'Singles', 'Winds-Dragons', 'Consecutive'];

  const filteredPatterns = patterns.filter((p) => {
    const matchesSection = activeSection === 'All' || p.section === activeSection;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSection && matchesSearch;
  });

  const matchingPatterns = hand
    ? filteredPatterns.filter((p) => patternMatchesHand(p, hand))
    : [];

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" title="2025 NMJL Card">
      {/* Filter Tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        {sections.map((section) => (
          <button
            key={section}
            onClick={() => setActiveSection(section)}
            className={cn(
              'px-4 py-2 rounded-md font-medium whitespace-nowrap transition-colors',
              activeSection === section
                ? 'bg-primary text-white'
                : 'bg-surface text-text-secondary hover:bg-surface-hover'
            )}
          >
            {section}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search patterns..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="w-full px-4 py-2 border border-border rounded-md mb-4 focus:outline-none focus:ring-2 focus:ring-primary"
      />

      {/* Patterns */}
      <div className="space-y-3 max-h-[60vh] overflow-y-auto">
        {filteredPatterns.map((pattern, idx) => {
          const isMatching = matchingPatterns.includes(pattern);
          return (
            <div
              key={idx}
              className={cn(
                'p-4 rounded-lg border transition-colors',
                isMatching
                  ? 'border-accent bg-accent/10'
                  : 'border-border bg-surface'
              )}
            >
              <div className="flex items-start justify-between mb-2">
                <div>
                  <h4 className="font-semibold">
                    {pattern.name}
                    {isMatching && <span className="ml-2 text-accent">⭐</span>}
                  </h4>
                  <p className="text-sm text-text-secondary">{pattern.section}</p>
                </div>
                <div className="text-sm font-bold text-primary">
                  {pattern.score} pts
                </div>
              </div>

              {/* Tile Visualization */}
              <div className="flex gap-1 flex-wrap">
                {pattern.tiles.map((tile, tIdx) => (
                  <Tile key={tIdx} tile={tile} size="sm" />
                ))}
              </div>

              {/* Description */}
              {pattern.description && (
                <p className="text-xs text-text-secondary mt-2">
                  {pattern.description}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
};
```text

---

## 12.5 Layout Components (`components/layout/`)

### 12.5.1 GameLayout

**Purpose**: Container for the main game screen.

**Props**:

```typescript
interface GameLayoutProps {
  children: React.ReactNode;
}
```text

**Implementation**:

```typescript
export const GameLayout: React.FC<GameLayoutProps> = ({ children }) => {
  return (
    <div className="game-layout min-h-screen bg-background-alt">
      {children}
      <ToastContainer />
    </div>
  );
};
```text

---

### 12.5.2 LobbyLayout

**Purpose**: Container for lobby/room selection screen.

**Implementation**:

```typescript
export const LobbyLayout: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  return (
    <div className="lobby-layout min-h-screen bg-background">
      <header className="p-6 border-b border-border">
        <h1 className="text-3xl font-display font-bold">American Mahjong</h1>
      </header>
      <main className="container mx-auto p-6">{children}</main>
    </div>
  );
};
```text

---

## 12.6 Component Testing Strategy

### 12.6.1 Unit Tests (Vitest + Testing Library)

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('renders children correctly', () => {
    render(<Button>Click Me</Button>);
    expect(screen.getByText('Click Me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click Me</Button>);
    fireEvent.click(screen.getByText('Click Me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('disables button when disabled prop is true', () => {
    render(<Button disabled>Click Me</Button>);
    expect(screen.getByText('Click Me')).toBeDisabled();
  });

  it('shows loading state', () => {
    render(<Button loading>Click Me</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
  });
});
```text

### 12.6.2 Integration Tests

```typescript
describe('Hand Component', () => {
  it('allows selecting up to max tiles', () => {
    const handleTileClick = vi.fn();
    const tiles = [
      0, // 1 Bam
      1, // 2 Bam
      2, // 3 Bam
      3, // 4 Bam
    ];

    render(
      <Hand
        tiles={tiles}
        onTileClick={handleTileClick}
        maxSelection={3}
        selectedTiles={new Set()}
      />
    );

    // Select 3 tiles
    fireEvent.click(screen.getAllByRole('button')[0]);
    fireEvent.click(screen.getAllByRole('button')[1]);
    fireEvent.click(screen.getAllByRole('button')[2]);

    expect(handleTileClick).toHaveBeenCalledTimes(3);
  });
});
```text

---

## 12.7 Performance Optimization

### 12.7.1 Memoization

```typescript
import { memo } from 'react';

export const Tile = memo<TileProps>(
  ({ tile, size, selected, onClick }) => {
    // Component implementation
  },
  (prevProps, nextProps) => {
    // Custom comparison: Only re-render if these change
    return (
      prevProps.tile === nextProps.tile &&
      prevProps.size === nextProps.size &&
      prevProps.selected === nextProps.selected
    );
  }
);
```text

### 12.7.2 Virtualization (For Large Lists)

```typescript
import { useVirtualizer } from '@tanstack/react-virtual';

export const PatternList: React.FC<{ patterns: Pattern[] }> = ({ patterns }) => {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: patterns.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 100, // Estimated item height
  });

  return (
    <div ref={parentRef} className="h-[400px] overflow-auto">
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((item) => (
          <div
            key={item.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${item.size}px`,
              transform: `translateY(${item.start}px)`,
            }}
          >
            <PatternCard pattern={patterns[item.index]} />
          </div>
        ))}
      </div>
    </div>
  );
};
```text

---

## 12.8 Accessibility Checklist

- ✅ All interactive elements have `role` attributes
- ✅ Keyboard navigation supported (Tab, Enter, Escape)
- ✅ Focus visible on all interactive elements
- ✅ ARIA labels for screen readers
- ✅ Color contrast meets WCAG AA standards
- ✅ Live regions for dynamic content (turn changes, events)
- ✅ No reliance on color alone (use icons + text)

---

## 12.9 Related Documentation

- [Frontend Architecture](10-frontend-architecture.md) - State management, network layer
- [UI/UX Design](11-ui-ux-design.md) - Visual design system, color palette
- [State Machine Design](../04-state-machine-design.md) - Game phases and flow

---

**Last Updated**: 2026-01-04
