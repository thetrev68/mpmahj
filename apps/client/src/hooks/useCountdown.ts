import { useEffect, useMemo, useRef, useState } from 'react';

interface UseCountdownOptions {
  deadlineMs: number | null;
  intervalMs?: number;
  onExpire?: () => void;
}

export function useCountdown({
  deadlineMs,
  intervalMs = 500,
  onExpire,
}: UseCountdownOptions): number | null {
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const hasExpiredRef = useRef(false);

  const safeIntervalMs = useMemo(() => Math.max(1, intervalMs), [intervalMs]);

  useEffect(() => {
    hasExpiredRef.current = false;

    const updateRemaining = () => {
      if (deadlineMs === null) {
        setRemainingSeconds(null);
        return;
      }

      const remainingMs = Math.max(0, deadlineMs - Date.now());
      setRemainingSeconds(Math.ceil(remainingMs / 1000));

      if (remainingMs === 0 && !hasExpiredRef.current) {
        hasExpiredRef.current = true;
        onExpire?.();
      }
    };

    updateRemaining();
    if (deadlineMs === null) return;

    const timer = window.setInterval(updateRemaining, safeIntervalMs);
    return () => window.clearInterval(timer);
  }, [deadlineMs, onExpire, safeIntervalMs]);

  return remainingSeconds;
}
