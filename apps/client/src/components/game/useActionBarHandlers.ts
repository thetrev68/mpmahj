import { useCallback, useMemo, useState } from 'react';
import { ACTION_BUTTON_DEBOUNCE_MS } from '@/lib/constants';
import type { GameCommand } from '@/types/bindings/generated/GameCommand';

interface UseActionBarHandlersOptions {
  isProcessing: boolean;
  disabled: boolean;
  onCommand: (command: GameCommand) => void;
}

export function useActionBarHandlers({
  isProcessing,
  disabled,
  onCommand,
}: UseActionBarHandlersOptions) {
  const [localProcessing, setLocalProcessing] = useState(false);

  const isBusy = useMemo(() => localProcessing || isProcessing, [localProcessing, isProcessing]);

  const handleCommand = useCallback(
    (command: GameCommand) => {
      if (isBusy || disabled) return;

      setLocalProcessing(true);
      onCommand(command);
      setTimeout(() => setLocalProcessing(false), ACTION_BUTTON_DEBOUNCE_MS);
    },
    [disabled, isBusy, onCommand]
  );

  return {
    handleCommand,
    isBusy,
  };
}
