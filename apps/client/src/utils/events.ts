import type { AnalysisEvent } from '@/types/bindings/generated/AnalysisEvent';
import type { Event } from '@/types/bindings/generated/Event';
import type { PrivateEvent } from '@/types/bindings/generated/PrivateEvent';
import type { PublicEvent } from '@/types/bindings/generated/PublicEvent';

export type NormalizedEvent =
  | { kind: 'Public'; event: PublicEvent }
  | { kind: 'Private'; event: PrivateEvent }
  | { kind: 'Analysis'; event: AnalysisEvent };

export const normalizeEvent = (event: Event): NormalizedEvent => {
  if ('Public' in event) return { kind: 'Public', event: event.Public };
  if ('Private' in event) return { kind: 'Private', event: event.Private };
  if ('Analysis' in event) return { kind: 'Analysis', event: event.Analysis };
  // Fallback to maintain type safety if new variants are added server-side.
  return { kind: 'Public', event: event as unknown as PublicEvent };
};

export const getEventVariantName = (event: PublicEvent | PrivateEvent | AnalysisEvent): string => {
  if (typeof event === 'string') return event;
  return Object.keys(event)[0] ?? 'Unknown';
};
