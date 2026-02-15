import { describe, expect, test } from 'vitest';
import { isTypingTarget } from './dom';

describe('isTypingTarget', () => {
  test('returns true for input and textarea', () => {
    expect(isTypingTarget(document.createElement('input'))).toBe(true);
    expect(isTypingTarget(document.createElement('textarea'))).toBe(true);
  });

  test('returns false for other elements and non-elements', () => {
    expect(isTypingTarget(document.createElement('div'))).toBe(false);
    expect(isTypingTarget(window)).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });
});
