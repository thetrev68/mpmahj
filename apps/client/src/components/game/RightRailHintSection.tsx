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
}: RightRailHintSectionProps) {
  const hintsDisabled = !hintSettings.useHints;
  const showRequestAction = !hintsDisabled && !isHistoricalView && canRequestHint;

  let body = null;

  if (hintsDisabled) {
    body = (
      <p className="text-sm text-slate-400" data-testid="hints-off-notice">
        Hints are off.
      </p>
    );
  } else if (hintPending) {
    body = (
      <div
        className="flex h-full flex-col justify-center gap-3 rounded-lg border border-slate-700 bg-slate-900/60 p-4"
        data-testid="hint-loading-inline"
        role="status"
        aria-live="polite"
      >
        <p className="text-sm text-slate-200">Analyzing...</p>
        <Button
          type="button"
          variant="link"
          className="h-auto justify-start p-0 text-slate-300"
          onClick={cancelHintRequest}
          data-testid="cancel-hint-request-button"
        >
          Cancel
        </Button>
      </div>
    );
  } else if (hintError) {
    body = (
      <div className="flex h-full flex-col gap-3 rounded-lg border border-red-500/40 bg-red-950/30 p-4">
        <p className="text-sm text-red-200" data-testid="hint-error-inline" role="alert">
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
        className="w-full"
        onClick={openHintRequestDialog}
        data-testid="get-hint-button"
      >
        Get Hint
      </Button>
    );
  } else if (isHistoricalView) {
    body = <p className="text-sm text-slate-400">Hints are unavailable in historical view.</p>;
  }

  return (
    <section
      className="flex h-full flex-col gap-3 overflow-hidden"
      data-testid="right-rail-hint-section"
      aria-label="AI hint section"
    >
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-200">AI Hint</h2>
      </div>
      <div className="min-h-0 flex-1">{body}</div>
    </section>
  );
}
