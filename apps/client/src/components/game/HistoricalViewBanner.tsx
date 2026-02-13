import { Button } from '@/components/ui/button';

export interface HistoricalViewBannerProps {
  moveNumber: number;
  moveDescription: string;
  isGameOver: boolean;
  canResume: boolean;
  onReturnToPresent: () => void;
  onResumeFromHere: () => void;
}

export function HistoricalViewBanner({
  moveNumber,
  moveDescription,
  isGameOver,
  canResume,
  onReturnToPresent,
  onResumeFromHere,
}: HistoricalViewBannerProps) {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-30 border-b border-blue-300/40 bg-blue-900/95 px-4 py-3 text-white"
      role="banner"
      aria-label="Historical view mode"
      data-testid="historical-view-banner"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
        <p className="text-sm font-semibold">
          VIEWING HISTORY - Move #{moveNumber} (Read-Only): {moveDescription}
        </p>
        <div className="flex items-center gap-2">
          {canResume && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onResumeFromHere}
              data-testid="resume-from-here-button"
            >
              Resume from Here
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={onReturnToPresent}
            data-testid="return-to-present-button"
          >
            {isGameOver ? 'Return to Final State' : 'Return to Current'}
          </Button>
        </div>
      </div>
    </div>
  );
}
