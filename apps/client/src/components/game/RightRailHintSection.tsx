import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { HintPanel } from './HintPanel';
import type { HintSettings } from '@/lib/hintSettings';
import type { HintData } from '@/types/bindings/generated/HintData';

export const RIGHT_RAIL_HINT_SLOT_ID = 'right-rail-hint-slot';

interface RightRailHintSectionProps {
  canRequestHint: boolean;
  currentHint: HintData | null;
  hintPending: boolean;
  hintError: string | null;
  hintSettings: HintSettings;
  isHistoricalView: boolean;
  openHintRequestDialog: () => void;
  cancelHintRequest: () => void;
  onNeedsExtraVerticalSpace?: (needsSpace: boolean) => void;
}

export function RightRailHintSection({
  canRequestHint,
  currentHint,
  hintPending,
  hintError,
  hintSettings,
  isHistoricalView,
  openHintRequestDialog,
  cancelHintRequest,
  onNeedsExtraVerticalSpace,
}: RightRailHintSectionProps) {
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const hintsDisabled = !hintSettings.useHints;
  const showRequestAction = !hintsDisabled && !isHistoricalView && canRequestHint;

  useEffect(() => {
    if (!onNeedsExtraVerticalSpace) {
      return;
    }

    const body = bodyRef.current;
    if (!body || currentHint === null || currentHint.best_patterns.length === 0) {
      onNeedsExtraVerticalSpace(false);
      return;
    }

    const updateSpacePressure = () => {
      onNeedsExtraVerticalSpace(body.scrollHeight > body.clientHeight + 1);
    };

    // Always take an initial measurement. The ResizeObserver below keeps the
    // value current as layout changes, but is not available in all environments.
    updateSpacePressure();

    if (typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver(() => updateSpacePressure());
    observer.observe(body);

    for (const child of Array.from(body.children)) {
      observer.observe(child);
    }

    return () => observer.disconnect();
  }, [currentHint, onNeedsExtraVerticalSpace]);

  let body = null;

  if (hintsDisabled) {
    body = (
      <p className="text-sm text-muted-foreground" data-testid="hints-off-notice">
        Hints are off.
      </p>
    );
  } else if (hintPending) {
    body = (
      <div
        className="flex h-full flex-col justify-center gap-3 rounded-lg border bg-card/80 p-4 text-card-foreground dark:bg-card/95"
        data-testid="hint-loading-inline"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm text-card-foreground">Analyzing...</p>
        <Button
          type="button"
          variant="link"
          className="h-auto justify-start p-0 text-muted-foreground hover:text-foreground"
          onClick={cancelHintRequest}
          data-testid="cancel-hint-request-button"
        >
          Cancel
        </Button>
      </div>
    );
  } else if (hintError) {
    body = (
      <div className="flex h-full flex-col gap-3 rounded-lg border border-destructive/50 bg-destructive/10 p-4">
        <p className="text-sm text-destructive" data-testid="hint-error-inline" role="alert">
          {hintError}
        </p>
        {showRequestAction && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={openHintRequestDialog}
            data-testid="retry-hint-button"
          >
            Retry
          </Button>
        )}
      </div>
    );
  } else if (currentHint) {
    body = (
      <div className="flex h-full flex-col gap-3">
        <HintPanel hint={currentHint} />
        {showRequestAction && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={openHintRequestDialog}
            data-testid="get-new-hint-button"
          >
            Get New Hint
          </Button>
        )}
      </div>
    );
  } else if (showRequestAction) {
    body = (
      <Button
        type="button"
        variant="outline"
        className="w-full bg-background/80 hover:bg-accent"
        onClick={openHintRequestDialog}
        data-testid="get-hint-button"
      >
        Get Hint
      </Button>
    );
  } else if (isHistoricalView) {
    body = (
      <p className="text-sm text-muted-foreground">Hints are unavailable in historical view.</p>
    );
  }

  return (
    <section
      className="flex h-full flex-col gap-3 overflow-hidden"
      data-testid="right-rail-hint-section"
      aria-label="AI hint section"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">AI Hint</h2>
      </div>
      <div ref={bodyRef} className="min-h-0 flex-1">
        {body}
      </div>
    </section>
  );
}
