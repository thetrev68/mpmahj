import { renderHook } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { useCountdown } from './useCountdown';

describe('useCountdown', () => {
  test('returns null when no deadline is provided', () => {
    const { result } = renderHook(() => useCountdown({ deadlineMs: null }));
    expect(result.current).toBeNull();
  });

  test('returns zero and triggers onExpire once for an already-expired deadline', () => {
    const onExpire = vi.fn();
    const expiredDeadline = Date.now() - 1000;

    const { result, rerender } = renderHook(() =>
      useCountdown({ deadlineMs: expiredDeadline, intervalMs: 500, onExpire })
    );

    expect(result.current).toBe(0);
    expect(onExpire).toHaveBeenCalledTimes(1);

    rerender();
    expect(result.current).toBe(0);
    expect(onExpire).toHaveBeenCalledTimes(1);
  });
});
