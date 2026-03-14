import type { Seat } from '@/types/bindings/generated/Seat';
import type { Tile } from '@/types/bindings/generated/Tile';

export interface ExchangeOpportunity {
  targetSeat: Seat;
  meldIndex: number;
  tilePosition: number;
  representedTile: Tile;
}

export type ExchangeableJokersBySeat = Record<Seat, Record<number, number[]>>;
