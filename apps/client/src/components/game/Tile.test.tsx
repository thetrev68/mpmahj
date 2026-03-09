import { describe, expect, test, vi } from 'vitest';
import { act, renderWithProviders, screen } from '@/test/test-utils';
import type { Tile as TileType } from '@/types/bindings';

// Mock the TileImage component since it doesn't exist yet
vi.mock('./TileImage', () => ({
  TileImage: ({ tile, testId }: { tile: TileType; testId?: string }) => (
    <div data-testid={testId || `tile-image-${tile}`}>Tile {tile}</div>
  ),
}));

// Import Tile component - this will fail initially (RED phase of TDD)
import { Tile } from './Tile';

describe('Tile Component', () => {
  describe('Rendering - P0 Tests', () => {
    test('applies base tile class for face-up tiles', () => {
      renderWithProviders(<Tile tile={2} />);

      expect(screen.getByTestId('tile-2')).toHaveClass('tile');
    });

    test('renders tile with correct image based on tile index', () => {
      const tileIndex: TileType = 2; // 3 Bam
      renderWithProviders(<Tile tile={tileIndex} />);

      // Verify TileImage is rendered with correct tile index
      expect(screen.getByTestId(`tile-image-${tileIndex}`)).toBeInTheDocument();
    });

    test('renders different tile indices correctly', () => {
      const { rerender } = renderWithProviders(<Tile tile={0} />);
      expect(screen.getByTestId('tile-image-0')).toBeInTheDocument();

      // Test different tile types
      rerender(<Tile tile={9} />); // 1 Crack
      expect(screen.getByTestId('tile-image-9')).toBeInTheDocument();

      rerender(<Tile tile={27} />); // East Wind
      expect(screen.getByTestId('tile-image-27')).toBeInTheDocument();

      rerender(<Tile tile={42} />); // Joker
      expect(screen.getByTestId('tile-image-42')).toBeInTheDocument();
    });

    test('renders face-down tiles correctly', () => {
      renderWithProviders(<Tile tile={5} faceUp={false} />);

      // Face-down tiles should not show the tile image
      expect(screen.queryByTestId('tile-image-5')).not.toBeInTheDocument();

      // Should still render a tile container
      const tileElement = screen.getByTestId('tile-5');
      expect(tileElement).toBeInTheDocument();
      expect(tileElement).toHaveClass('tile-face-down');
    });

    test('does not render wall classes in tile markup', () => {
      const { container } = renderWithProviders(
        <div>
          <Tile tile={5} />
          <Tile tile={6} faceUp={false} />
        </div>
      );

      expect(container.querySelector('.wall-stack')).toBeNull();
      expect(container.querySelector('.wall-north')).toBeNull();
      expect(container.querySelector('.wall-south')).toBeNull();
      expect(container.querySelector('.wall-east')).toBeNull();
      expect(container.querySelector('.wall-west')).toBeNull();
    });

    test('defaults to face-up when faceUp prop is not provided', () => {
      renderWithProviders(<Tile tile={10} />);

      // Should show the tile image by default
      expect(screen.getByTestId('tile-image-10')).toBeInTheDocument();
    });
  });

  describe('States - P0 Tests', () => {
    test('renders default state correctly', () => {
      renderWithProviders(<Tile tile={3} state="default" />);

      const tileElement = screen.getByTestId('tile-3');
      expect(tileElement).toHaveClass('tile-default');
      expect(tileElement).not.toHaveClass('tile-selected');
      expect(tileElement).not.toHaveClass('tile-disabled');
    });

    test('applies selected state styling', () => {
      renderWithProviders(<Tile tile={7} state="selected" />);

      const tileElement = screen.getByTestId('tile-7');
      expect(tileElement).toHaveClass('tile-selected');

      // Selected tiles should be raised with gold border
      expect(tileElement).toHaveStyle({
        transform: 'translateY(-12px)',
      });
    });

    test('applies disabled state styling', () => {
      renderWithProviders(<Tile tile={35} state="disabled" />);

      const tileElement = screen.getByTestId('tile-35');
      expect(tileElement).toHaveClass('tile-disabled');

      // Disabled tiles should have reduced opacity and be grayed out
      const styles = window.getComputedStyle(tileElement);
      expect(styles.opacity).toBe('0.5');
      expect(styles.cursor).toBe('not-allowed');
    });

    test('applies highlighted state styling', () => {
      renderWithProviders(<Tile tile={12} state="highlighted" />);

      const tileElement = screen.getByTestId('tile-12');
      expect(tileElement).toHaveClass('tile-highlighted');

      // Highlighted tiles should have pulsing animation
      expect(tileElement).toHaveStyle({
        animation: 'pulse-border 1.5s infinite',
      });
    });

    test('applies dimmed state styling', () => {
      renderWithProviders(<Tile tile={20} state="dimmed" />);

      const tileElement = screen.getByTestId('tile-20');
      expect(tileElement).toHaveClass('tile-dimmed');

      // Dimmed tiles should be semi-transparent
      expect(tileElement).toHaveStyle({
        opacity: '0.6',
      });
    });

    test('defaults to default state when state prop is not provided', () => {
      renderWithProviders(<Tile tile={8} />);

      const tileElement = screen.getByTestId('tile-8');
      expect(tileElement).toHaveClass('tile-default');
    });
  });

  describe('Size Variants - P0 Tests', () => {
    test('applies small size variant', () => {
      renderWithProviders(<Tile tile={4} size="small" />);

      const tileElement = screen.getByTestId('tile-4');
      expect(tileElement).toHaveClass('tile-small');

      // Small tiles: 32px × 46px
      expect(tileElement).toHaveStyle({
        width: '32px',
        height: '46px',
      });
    });

    test('applies medium size variant (default)', () => {
      renderWithProviders(<Tile tile={6} size="medium" />);

      const tileElement = screen.getByTestId('tile-6');
      expect(tileElement).toHaveClass('tile-medium');

      // Medium tiles: 63px × 90px
      expect(tileElement).toHaveStyle({
        width: '63px',
        height: '90px',
      });
    });

    test('applies large size variant', () => {
      renderWithProviders(<Tile tile={11} size="large" />);

      const tileElement = screen.getByTestId('tile-11');
      expect(tileElement).toHaveClass('tile-large');

      // Large tiles: 80px × 114px
      expect(tileElement).toHaveStyle({
        width: '80px',
        height: '114px',
      });
    });

    test('defaults to medium size when size prop is not provided', () => {
      renderWithProviders(<Tile tile={15} />);

      const tileElement = screen.getByTestId('tile-15');
      expect(tileElement).toHaveClass('tile-medium');
    });
  });

  describe('Rotation - P0 Tests', () => {
    test('applies rotation for exposed melds', () => {
      renderWithProviders(<Tile tile={18} rotated />);

      const tileElement = screen.getByTestId('tile-18');
      expect(tileElement).toHaveClass('tile-rotated');

      // Rotated tiles should rotate 90° clockwise
      expect(tileElement).toHaveStyle({
        transform: 'rotate(90deg)',
      });
    });

    test('applies directional rotation when rotation prop is set', () => {
      renderWithProviders(<Tile tile={18} rotation="left" />);

      const tileElement = screen.getByTestId('tile-18');
      expect(tileElement).toHaveClass('tile-rotated');
      expect(tileElement).toHaveStyle({
        transform: 'rotate(-90deg)',
      });
    });

    test('does not rotate when rotated prop is false', () => {
      renderWithProviders(<Tile tile={22} rotated={false} />);

      const tileElement = screen.getByTestId('tile-22');
      expect(tileElement).not.toHaveClass('tile-rotated');
    });

    test('does not rotate by default', () => {
      renderWithProviders(<Tile tile={25} />);

      const tileElement = screen.getByTestId('tile-25');
      expect(tileElement).not.toHaveClass('tile-rotated');
    });
  });

  describe('Interaction - P0 Tests', () => {
    test('calls onClick when clicked and clickable', async () => {
      const handleClick = vi.fn();
      const { user } = renderWithProviders(<Tile tile={5} onClick={handleClick} />);

      const tileElement = screen.getByTestId('tile-5');
      await user.click(tileElement);

      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledWith(5);
    });

    test('does not trigger onClick when disabled', async () => {
      const handleClick = vi.fn();
      const { user } = renderWithProviders(
        <Tile tile={35} state="disabled" onClick={handleClick} />
      );

      const tileElement = screen.getByTestId('tile-35');
      await user.click(tileElement);

      // Disabled tiles should not respond to clicks
      expect(handleClick).not.toHaveBeenCalled();
    });

    test('does not trigger onClick when onClick is not provided', async () => {
      // This should not throw an error
      const { user } = renderWithProviders(<Tile tile={10} />);

      const tileElement = screen.getByTestId('tile-10');
      await expect(user.click(tileElement)).resolves.not.toThrow();
    });

    test('is clickable when onClick is provided', () => {
      const handleClick = vi.fn();
      renderWithProviders(<Tile tile={8} onClick={handleClick} />);

      const tileElement = screen.getByTestId('tile-8');

      // Should have button role when clickable
      expect(tileElement).toHaveAttribute('role', 'button');

      // Should have pointer cursor
      expect(tileElement).toHaveStyle({ cursor: 'pointer' });
    });

    test('calls onPlaySelectSound when click results in selection', async () => {
      const handleClick = vi.fn(() => true);
      const handlePlaySelectSound = vi.fn();
      const { user } = renderWithProviders(
        <Tile tile={5} onClick={handleClick} onPlaySelectSound={handlePlaySelectSound} />
      );

      const tileElement = screen.getByTestId('tile-5');
      await user.click(tileElement);

      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handlePlaySelectSound).toHaveBeenCalledTimes(1);
    });

    test('does not call onPlaySelectSound when disabled', async () => {
      const handleClick = vi.fn(() => true);
      const handlePlaySelectSound = vi.fn();
      const { user } = renderWithProviders(
        <Tile
          tile={35}
          state="disabled"
          onClick={handleClick}
          onPlaySelectSound={handlePlaySelectSound}
        />
      );

      const tileElement = screen.getByTestId('tile-35');
      await user.click(tileElement);

      expect(handleClick).not.toHaveBeenCalled();
      expect(handlePlaySelectSound).not.toHaveBeenCalled();
    });
    test('is not clickable when onClick is not provided', () => {
      renderWithProviders(<Tile tile={12} />);

      const tileElement = screen.getByTestId('tile-12');

      // Should not have button role when not clickable
      expect(tileElement).not.toHaveAttribute('role', 'button');
    });
  });

  describe('Hover Effects - P1 Tests', () => {
    test('shows lift and shadow on hover when clickable', async () => {
      const handleClick = vi.fn();
      const { user } = renderWithProviders(<Tile tile={7} onClick={handleClick} />);

      const tileElement = screen.getByTestId('tile-7');

      // Hover over the tile
      await user.hover(tileElement);

      // Should have hover class applied
      expect(tileElement).toHaveClass('tile-hover');

      // Hover state should lift tile 8px with enhanced shadow
      // Note: CSS transitions may require time to apply
      // This test validates the hover class is applied
    });

    test('does not show hover effect when disabled', async () => {
      const { user } = renderWithProviders(<Tile tile={15} state="disabled" onClick={vi.fn()} />);

      const tileElement = screen.getByTestId('tile-15');

      await user.hover(tileElement);

      // Disabled tiles should not show hover effects
      expect(tileElement).not.toHaveClass('tile-hover');
    });

    test('triggers onHover callback when hovered', async () => {
      const handleHover = vi.fn();
      const { user } = renderWithProviders(<Tile tile={20} onHover={handleHover} />);

      const tileElement = screen.getByTestId('tile-20');
      await user.hover(tileElement);

      expect(handleHover).toHaveBeenCalledWith(20);
    });

    test('removes hover class on mouseleave', async () => {
      const { user } = renderWithProviders(<Tile tile={21} onClick={vi.fn()} />);
      const tileElement = screen.getByTestId('tile-21');

      await user.hover(tileElement);
      expect(tileElement).toHaveClass('tile-hover');

      await user.unhover(tileElement);
      expect(tileElement).not.toHaveClass('tile-hover');
    });

    test('hover class is not sticky after click and pointer leaves', async () => {
      const { user } = renderWithProviders(<Tile tile={22} onClick={vi.fn()} />);
      const tileElement = screen.getByTestId('tile-22');

      await user.hover(tileElement);
      await user.click(tileElement);
      expect(tileElement).toHaveClass('tile-hover');

      await user.unhover(tileElement);
      expect(tileElement).not.toHaveClass('tile-hover');
    });
  });

  describe('Accessibility - P1 Tests', () => {
    test('has correct ARIA label for Bam tile', () => {
      renderWithProviders(<Tile tile={2} onClick={vi.fn()} />);

      const tileElement = screen.getByTestId('tile-2');

      // Tile 2 = 3 Bam
      expect(tileElement).toHaveAttribute('aria-label', expect.stringContaining('3 Bam'));
    });

    test('has correct ARIA label for Joker', () => {
      renderWithProviders(<Tile tile={42} onClick={vi.fn()} />);

      const tileElement = screen.getByTestId('tile-42');
      expect(tileElement).toHaveAttribute('aria-label', expect.stringContaining('Joker'));
    });

    test('has correct ARIA label for Dragon tile', () => {
      renderWithProviders(<Tile tile={32} onClick={vi.fn()} />);

      const tileElement = screen.getByTestId('tile-32');

      // Tile 32 = Red Dragon
      expect(tileElement).toHaveAttribute('aria-label', expect.stringContaining('Red Dragon'));
    });

    test('uses custom ARIA label when provided', () => {
      renderWithProviders(<Tile tile={5} ariaLabel="Custom Tile Label" onClick={vi.fn()} />);

      const tileElement = screen.getByTestId('tile-5');
      expect(tileElement).toHaveAttribute('aria-label', 'Custom Tile Label');
    });

    test('sets aria-pressed when selected', () => {
      renderWithProviders(<Tile tile={8} state="selected" onClick={vi.fn()} />);

      const tileElement = screen.getByTestId('tile-8');
      expect(tileElement).toHaveAttribute('aria-pressed', 'true');
    });

    test('does not set aria-pressed when not selected', () => {
      renderWithProviders(<Tile tile={10} state="default" onClick={vi.fn()} />);

      const tileElement = screen.getByTestId('tile-10');
      expect(tileElement).toHaveAttribute('aria-pressed', 'false');
    });

    test('sets aria-disabled when disabled', () => {
      renderWithProviders(<Tile tile={35} state="disabled" onClick={vi.fn()} />);

      const tileElement = screen.getByTestId('tile-35');
      expect(tileElement).toHaveAttribute('aria-disabled', 'true');
    });

    test('is keyboard focusable when clickable', () => {
      renderWithProviders(<Tile tile={15} onClick={vi.fn()} />);

      const tileElement = screen.getByTestId('tile-15');
      expect(tileElement).toHaveAttribute('tabindex', '0');
    });

    test('is not keyboard focusable when disabled', () => {
      renderWithProviders(<Tile tile={20} state="disabled" onClick={vi.fn()} />);

      const tileElement = screen.getByTestId('tile-20');

      // Disabled elements should not be focusable
      expect(tileElement).toHaveAttribute('tabindex', '-1');
    });

    test('is not keyboard focusable when not clickable', () => {
      renderWithProviders(<Tile tile={25} />);

      const tileElement = screen.getByTestId('tile-25');

      // Non-clickable tiles should not be focusable
      expect(tileElement).not.toHaveAttribute('tabindex', '0');
    });

    test('triggers click on Enter key press', async () => {
      const handleClick = vi.fn();
      const { user } = renderWithProviders(<Tile tile={12} onClick={handleClick} />);

      const tileElement = screen.getByTestId('tile-12');
      await act(async () => {
        tileElement.focus();
      });

      await user.keyboard('{Enter}');

      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledWith(12);
    });

    test('triggers click on Space key press', async () => {
      const handleClick = vi.fn();
      const { user } = renderWithProviders(<Tile tile={18} onClick={handleClick} />);

      const tileElement = screen.getByTestId('tile-18');
      await act(async () => {
        tileElement.focus();
      });

      await user.keyboard(' ');

      expect(handleClick).toHaveBeenCalledTimes(1);
      expect(handleClick).toHaveBeenCalledWith(18);
    });

    test('does not trigger click on other key presses', async () => {
      const handleClick = vi.fn();
      const { user } = renderWithProviders(<Tile tile={22} onClick={handleClick} />);

      const tileElement = screen.getByTestId('tile-22');
      await act(async () => {
        tileElement.focus();
      });

      await user.keyboard('a');
      await user.keyboard('{Escape}');

      expect(handleClick).not.toHaveBeenCalled();
    });

    test('shows visible focus ring when focused', async () => {
      const { user } = renderWithProviders(<Tile tile={14} onClick={vi.fn()} />);

      const tileElement = screen.getByTestId('tile-14');

      // Tab to focus the element
      await user.tab();

      // Should have focus
      expect(tileElement).toHaveFocus();

      // Should have focus-visible class or outline
      expect(tileElement).toHaveClass('tile-focus');
    });
  });

  describe('Animations - P2 Tests', () => {
    test('shows pulsing animation for newly drawn tile', () => {
      renderWithProviders(<Tile tile={10} state="highlighted" />);

      const tileElement = screen.getByTestId('tile-10');

      // Highlighted state includes pulsing animation
      expect(tileElement).toHaveStyle({
        animation: 'pulse-border 1.5s infinite',
      });
    });

    test('state changes animate smoothly', () => {
      const { rerender } = renderWithProviders(<Tile tile={16} state="default" />);

      const tileElement = screen.getByTestId('tile-16');

      // Should have transition property for smooth state changes
      const styles = window.getComputedStyle(tileElement);
      expect(styles.transition).toContain('all');
      expect(styles.transition).toContain('0.2s');

      // Change state
      rerender(<Tile tile={16} state="selected" />);

      // Transition should apply to the new state
      expect(tileElement).toHaveClass('tile-selected');
    });
  });

  describe('Edge Cases - P3 Tests', () => {
    test('handles invalid tile index gracefully', () => {
      // Tile index 99 is out of range (valid range: 0-43)
      renderWithProviders(<Tile tile={99 as TileType} />);

      const tileElement = screen.getByTestId('tile-99');
      expect(tileElement).toBeInTheDocument();

      // Should show error state or fallback
      expect(tileElement).toHaveClass('tile-error');
    });

    test('handles negative tile index gracefully', () => {
      renderWithProviders(<Tile tile={-1 as TileType} />);

      const tileElement = screen.getByTestId('tile--1');
      expect(tileElement).toBeInTheDocument();
      expect(tileElement).toHaveClass('tile-error');
    });

    test('handles rapid state changes', () => {
      const { rerender } = renderWithProviders(<Tile tile={20} state="default" />);

      // Rapidly change states
      rerender(<Tile tile={20} state="selected" />);
      rerender(<Tile tile={20} state="highlighted" />);
      rerender(<Tile tile={20} state="disabled" />);
      rerender(<Tile tile={20} state="default" />);

      const tileElement = screen.getByTestId('tile-20');
      expect(tileElement).toBeInTheDocument();
      expect(tileElement).toHaveClass('tile-default');
    });

    test('handles combined states (selected + rotated)', () => {
      renderWithProviders(<Tile tile={24} state="selected" rotated />);

      const tileElement = screen.getByTestId('tile-24');
      expect(tileElement).toHaveClass('tile-selected');
      expect(tileElement).toHaveClass('tile-rotated');

      // Transform should include both rotation and translation
      expect(tileElement).toHaveStyle({
        transform: 'translateY(-12px) rotate(90deg)',
      });
    });

    test('uses custom testId when provided', () => {
      renderWithProviders(<Tile tile={8} testId="custom-tile-id" />);

      expect(screen.getByTestId('custom-tile-id')).toBeInTheDocument();
      // Default testId should not be present
      expect(screen.queryByTestId('tile-8')).not.toBeInTheDocument();
    });

    test('handles undefined onClick gracefully', async () => {
      const { user } = renderWithProviders(<Tile tile={12} onClick={undefined} />);

      const tileElement = screen.getByTestId('tile-12');
      await expect(user.click(tileElement)).resolves.not.toThrow();
    });
  });

  describe('Performance - P2 Tests', () => {
    test('component is memoized to prevent unnecessary re-renders', () => {
      const { rerender } = renderWithProviders(<Tile tile={15} state="default" />);

      const tileElement = screen.getByTestId('tile-15');
      const firstRender = tileElement;

      // Re-render with same props
      rerender(<Tile tile={15} state="default" />);

      const secondRender = screen.getByTestId('tile-15');

      // Component should be the same instance (React.memo optimization)
      expect(firstRender).toBe(secondRender);
    });
  });

  describe('Integration - P1 Tests', () => {
    test('renders multiple tiles with different props simultaneously', () => {
      renderWithProviders(
        <div>
          <Tile tile={0} state="default" size="small" />
          <Tile tile={10} state="selected" size="medium" />
          <Tile tile={20} state="disabled" size="large" />
          <Tile tile={35} state="highlighted" rotated />
        </div>
      );

      expect(screen.getByTestId('tile-0')).toHaveClass('tile-small', 'tile-default');
      expect(screen.getByTestId('tile-10')).toHaveClass('tile-medium', 'tile-selected');
      expect(screen.getByTestId('tile-20')).toHaveClass('tile-large', 'tile-disabled');
      expect(screen.getByTestId('tile-35')).toHaveClass('tile-highlighted', 'tile-rotated');
    });

    test('works correctly with face-down and rotated together', () => {
      renderWithProviders(<Tile tile={18} faceUp={false} rotated />);

      const tileElement = screen.getByTestId('tile-18');

      // Should have both classes
      expect(tileElement).toHaveClass('tile-face-down', 'tile-rotated');

      // Face-down tile should not show image even when rotated
      expect(screen.queryByTestId('tile-image-18')).not.toBeInTheDocument();
    });
  });
});
