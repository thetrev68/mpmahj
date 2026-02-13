import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ConnectionStatusProps {
  isReconnecting: boolean;
  reconnectAttempt: number;
  canManualRetry: boolean;
  onRetryNow: () => void;
  showReconnectedToast: boolean;
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  isReconnecting,
  reconnectAttempt,
  canManualRetry,
  onRetryNow,
  showReconnectedToast,
}) => {
  return (
    <>
      {isReconnecting && (
        <Card
          className="fixed left-1/2 top-4 z-[70] flex -translate-x-1/2 items-center gap-3 border-yellow-600 bg-yellow-100 px-4 py-3 text-yellow-950 shadow-lg"
          role="status"
          aria-live="assertive"
          data-testid="connection-status-banner"
        >
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-yellow-800 border-t-transparent"
            aria-hidden="true"
          />
          <div className="flex items-center gap-2">
            {/* sr-only text matches the spec's required announcement: "Connection lost. Reconnecting." */}
            <span className="sr-only">Connection lost. Reconnecting.</span>
            <span className="font-medium" aria-hidden="true">
              Reconnecting...
            </span>
            <Badge variant="outline" data-testid="reconnect-attempt-badge">
              attempt {reconnectAttempt}
            </Badge>
          </div>
          {canManualRetry && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRetryNow}
              data-testid="retry-now-button"
              className="border-yellow-800 bg-yellow-200 text-yellow-950 hover:bg-yellow-300"
            >
              Retry Now
            </Button>
          )}
        </Card>
      )}

      {showReconnectedToast && (
        <Card
          className="fixed bottom-6 right-6 z-[70] border-green-700 bg-green-100 px-4 py-3 text-green-950 shadow-lg"
          role="status"
          aria-live="polite"
          data-testid="reconnected-toast"
        >
          Reconnected
        </Card>
      )}
    </>
  );
};

ConnectionStatus.displayName = 'ConnectionStatus';
