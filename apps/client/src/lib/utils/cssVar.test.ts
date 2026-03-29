import { describe, it, expect, vi, afterEach } from 'vitest';
import { getCssVarPx } from './cssVar';

function mockComputedStyle(getPropertyValue: (name: string) => string): CSSStyleDeclaration {
  return { getPropertyValue } as unknown as CSSStyleDeclaration;
}

describe('getCssVarPx', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the parsed pixel value when the CSS var is defined', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue(
      mockComputedStyle((name: string) => (name === '--tile-w-md' ? '63px' : ''))
    );

    expect(getCssVarPx('--tile-w-md', 0)).toBe(63);
  });

  it('returns the fallback when the CSS var is empty', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue(mockComputedStyle(() => ''));

    expect(getCssVarPx('--missing-var', 42)).toBe(42);
  });

  it('returns the fallback when the value is not a number', () => {
    vi.spyOn(window, 'getComputedStyle').mockReturnValue(mockComputedStyle(() => 'auto'));

    expect(getCssVarPx('--some-var', 100)).toBe(100);
  });
});
