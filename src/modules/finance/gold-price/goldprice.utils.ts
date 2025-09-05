import { PriceChangeDirection } from './goldprice.types';

export function detectChangeDirection(previous: number | null | undefined, current: number): PriceChangeDirection | null {
  if (previous == null) return null;
  if (current > previous) return PriceChangeDirection.Up;
  if (current < previous) return PriceChangeDirection.Down;
  return PriceChangeDirection.Unchanged;
}

export function normalizeBanglaNumberToFloat(input: string): number {
  // Replace Bangla numerals if present and remove non-digit/decimal separators
  const bnToEn: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9',
  };
  const cleaned = input
    .trim()
    .replace(/[০-৯]/g, (d) => bnToEn[d])
    .replace(/[,\s]/g, '')
    .replace(/[^0-9.]/g, '');
  const value = parseFloat(cleaned);
  if (Number.isNaN(value)) {
    throw new Error(`Failed to parse numeric value from: ${input}`);
  }
  return value;
}

export const GRAMS_PER_VORI = 11.664; // Bangladesh standard approximation

export function convertPriceBetweenUnits(price: number, fromUnit: string, toUnit: string): number {
  const f = fromUnit.toLowerCase();
  const t = toUnit.toLowerCase();
  if (f === t) return price;
  if (f === 'gram' && t === 'vori') return price * GRAMS_PER_VORI;
  if (f === 'vori' && t === 'gram') return price / GRAMS_PER_VORI;
  // Unknown units: return as-is
  return price;
}


