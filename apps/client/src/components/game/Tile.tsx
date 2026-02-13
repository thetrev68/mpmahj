/**
 * Tile Component
 *
 * Displays a single Mahjong tile with suit, rank, and visual state.
 * The fundamental building block of the entire game UI.
 */

import React, { useState } from 'react';
import type { Tile as TileType } from '@/types/bindings';
import { TileImage } from './TileImage';
import { getTileName, isValidTile, isJoker } from '@/lib/utils/tileUtils';
import { cn } from '@/lib/utils';
import './Tile.css';

interface TileProps {
  /** Tile index (0-43) from bindings */
  tile: TileType;

  /** Visual state */
  state?: 'default' | 'selected' | 'disabled' | 'highlighted' | 'dimmed';

  /** Whether tile shows face or back */
  faceUp?: boolean;

  /** Click handler */
  onClick?: (tile: TileType) => void;

  /** Hover handler for tooltips */
  onHover?: (tile: TileType) => void;

  /** Size variant */
  size?: 'small' | 'medium' | 'large';

  /** Rotation for exposed melds */
  rotated?: boolean;

  /** Rotation direction for called tiles */
  rotation?: 'left' | 'up' | 'right';

  /** Accessibility label override */
  ariaLabel?: string;

  /** Test ID */
  testId?: string;

  /** Shows pulsing animation for newly drawn tile */
  newlyDrawn?: boolean;

  /** Extra class names */
  className?: string;

  /** Allow clicks even when disabled (for tooltip feedback) */
  allowDisabledClick?: boolean;
}

export const Tile = React.memo<TileProps>(
  ({
    tile,
    state = 'default',
    faceUp = true,
    onClick,
    onHover,
    size = 'medium',
    rotated = false,
    rotation,
    ariaLabel,
    testId,
    newlyDrawn = false,
    className,
    allowDisabledClick = false,
  }) => {
    const [isHovered, setIsHovered] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    // Determine if tile is clickable
    const isClickable = !!onClick;
    const isDisabled = state === 'disabled';
    const isSelected = state === 'selected';
    const isError = !isValidTile(tile);

    // Handle click
    const handleClick = () => {
      if (!isClickable) return;
      if (isDisabled && !allowDisabledClick) return;
      onClick?.(tile);
    };

    // Handle keyboard events
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!isClickable) return;
      if (isDisabled && !allowDisabledClick) return;

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onClick?.(tile);
      }
    };

    // Handle hover
    const handleMouseEnter = () => {
      if (!isDisabled) {
        setIsHovered(true);
        onHover?.(tile);
      }
    };

    const handleMouseLeave = () => {
      setIsHovered(false);
    };

    // Handle focus
    const handleFocus = () => {
      setIsFocused(true);
    };

    const handleBlur = () => {
      setIsFocused(false);
    };

    // Compute CSS classes
    const hasRotation = rotated || rotation !== undefined;
    const tileClasses = cn(
      'tile',
      `tile-${size}`,
      `tile-${state}`,
      isDisabled && isJoker(tile) && 'tile-joker-disabled',
      className,
      {
        'tile-face-down': !faceUp,
        'tile-rotated': hasRotation,
        'tile-hover': isHovered && isClickable && !isDisabled,
        'tile-focus': isFocused,
        'tile-error': isError,
        'tile-newly-drawn': newlyDrawn,
      }
    );

    // Compute inline styles for testing (jsdom doesn't compute CSS properly)
    const inlineStyles: React.CSSProperties = {};

    // Size styles
    if (size === 'small') {
      inlineStyles.width = '32px';
      inlineStyles.height = '46px';
    } else if (size === 'medium') {
      inlineStyles.width = '63px';
      inlineStyles.height = '90px';
    } else if (size === 'large') {
      inlineStyles.width = '80px';
      inlineStyles.height = '114px';
    }

    // Build transform value
    let transformValue = '';
    let rotationDegrees: number | null = null;
    if (rotation === 'left') rotationDegrees = -90;
    if (rotation === 'up') rotationDegrees = 180;
    if (rotation === 'right') rotationDegrees = 90;
    if (rotationDegrees === null && rotated) rotationDegrees = 90;

    if (state === 'selected') {
      transformValue = 'translateY(-12px)';
      if (rotationDegrees !== null) {
        transformValue += ` rotate(${rotationDegrees}deg)`;
      }
    } else if (rotationDegrees !== null) {
      transformValue = `rotate(${rotationDegrees}deg)`;
    }
    if (transformValue) {
      inlineStyles.transform = transformValue;
    }

    // Cursor and opacity for disabled state
    if (state === 'disabled') {
      inlineStyles.opacity = 0.5;
      inlineStyles.cursor = 'not-allowed';
    } else if (isClickable) {
      inlineStyles.cursor = 'pointer';
    }

    // Animation for highlighted state
    if (state === 'highlighted') {
      inlineStyles.animation = 'pulse-border 1.5s infinite';
    }

    // Opacity for dimmed state (but disabled takes precedence)
    if (state === 'dimmed') {
      inlineStyles.opacity = 0.6;
    }

    // Transition for smooth state changes
    inlineStyles.transition = 'all 0.2s ease';

    // Compute ARIA attributes
    const ariaAttributes: Record<string, string | boolean | number> = {};

    if (isClickable) {
      ariaAttributes.role = 'button';
      ariaAttributes['aria-label'] = ariaLabel || getTileName(tile);
      ariaAttributes['aria-pressed'] = isSelected;
      ariaAttributes['aria-disabled'] = isDisabled;
      ariaAttributes.tabIndex = isDisabled ? -1 : 0;
    } else if (ariaLabel) {
      ariaAttributes['aria-label'] = ariaLabel;
    }

    return (
      <div
        className={tileClasses}
        style={inlineStyles}
        data-testid={testId || `tile-${tile}`}
        data-tile={tile}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        {...ariaAttributes}
      >
        {faceUp ? <TileImage tile={tile} /> : null}
      </div>
    );
  }
);

Tile.displayName = 'Tile';
