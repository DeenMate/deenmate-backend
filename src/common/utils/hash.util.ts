import { createHash } from "crypto";

/**
 * Generate a location key for prayer times based on latitude and longitude
 * Uses 3-decimal precision to group nearby locations
 */
export function generateLocationKey(lat: number, lng: number): string {
  // Round to 3 decimal places (approximately 111 meters precision)
  const roundedLat = Math.round(lat * 1000) / 1000;
  const roundedLng = Math.round(lng * 1000) / 1000;

  // Create a hash of the rounded coordinates
  const hash = createHash("md5")
    .update(`${roundedLat},${roundedLng}`)
    .digest("hex");

  return `loc_${hash.substring(0, 8)}`;
}

/**
 * Generate a hash for any string input
 */
export function generateHash(input: string, algorithm: string = "md5"): string {
  return createHash(algorithm).update(input).digest("hex");
}

/**
 * Generate a cache key for API requests
 */
export function generateCacheKey(
  prefix: string,
  params: Record<string, any>,
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}:${params[key]}`)
    .join("|");

  return `${prefix}:${generateHash(sortedParams)}`;
}

/**
 * Generate a unique identifier for sync jobs
 */
export function generateSyncJobId(
  jobName: string,
  resource: string,
  timestamp: Date,
): string {
  const timeStr = timestamp.toISOString().replace(/[:.]/g, "-");
  return `${jobName}_${resource}_${timeStr}`;
}
