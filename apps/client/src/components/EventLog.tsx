import { useEffect, useRef } from 'react';
import { useUIStore } from '@/store/uiStore';
import './EventLog.css';

export function EventLog() {
  const eventLog = useUIStore((state) => state.eventLog);
  const clearEventLog = useUIStore((state) => state.clearEventLog);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new events
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [eventLog.length]);

  return (
    <div className="event-log">
      <div className="event-log-header">
        <h2>Event Log</h2>
        {eventLog.length > 0 && (
          <button onClick={clearEventLog} className="clear-log-btn">
            Clear
          </button>
        )}
      </div>

      <div className="event-log-scroll" ref={scrollRef}>
        {eventLog.length === 0 ? (
          <p className="no-events">No events yet</p>
        ) : (
          <div className="event-list">
            {eventLog.map((event) => {
              const time = new Date(event.timestamp).toLocaleTimeString('en-US', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              });

              return (
                <div key={event.id} className={`event-item event-${event.category}`}>
                  <span className="event-time">{time}</span>
                  <span className="event-message">{event.message}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
