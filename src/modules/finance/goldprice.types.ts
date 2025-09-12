export enum MetalType {
  Gold = "Gold",
  Silver = "Silver",
}

export enum PriceChangeDirection {
  Up = "Up",
  Down = "Down",
  Unchanged = "Unchanged",
}

export interface ParsedPriceItem {
  metal: MetalType;
  category: string; // e.g., 22K, 21K, 18K, Traditional, Silver
  unit: string; // e.g., Vori, Gram
  price: number; // normalized numeric price (BDT)
}

export interface LatestPriceDto {
  metal: MetalType;
  category: string;
  unit: string;
  price: number;
  currency: string;
  change: PriceChangeDirection | null;
  fetchedAt: string;
  source: string;
}

export interface HistoryQueryDto {
  from?: string; // ISO date
  to?: string; // ISO date
  metal?: MetalType;
  category?: string;
  unit?: string;
}
