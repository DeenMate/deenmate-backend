/**
 * Utility functions for handling upstream API compatibility
 */

export interface UpstreamCompatibilityOptions {
  compat?: 'upstream' | 'native';
  includeSource?: boolean;
  includeMetadata?: boolean;
}

/**
 * Transform database entities to upstream-compatible format
 */
export function transformToUpstreamFormat<T>(
  data: T,
  options: UpstreamCompatibilityOptions = {}
): any {
  const { compat = 'upstream', includeSource = true, includeMetadata = true } = options;
  
  if (compat === 'native') {
    return data;
  }
  
  // For upstream compatibility, we need to transform the data structure
  // This is a placeholder - actual transformations will be implemented per endpoint
  let transformed = { ...data };
  
  if (includeSource) {
    transformed = {
      ...transformed,
      source: 'deenmate',
    };
  }
  
  if (includeMetadata) {
    transformed = {
      ...transformed,
      metadata: {
        transformed: true,
        timestamp: new Date().toISOString(),
      },
    };
  }
  
  return transformed;
}

/**
 * Check if response should be in upstream format
 */
export function shouldUseUpstreamFormat(compat?: string): boolean {
  return compat === 'upstream' || compat === undefined;
}

/**
 * Add DeenMate source header to response
 */
export function addSourceHeader(headers: Record<string, string> = {}): Record<string, string> {
  return {
    ...headers,
    'X-DeenMate-Source': 'live-sync',
    'X-DeenMate-Version': '1.0.0',
  };
}

/**
 * Transform error response to upstream-compatible format
 */
export function transformErrorToUpstreamFormat(
  error: any,
  compat?: string
): any {
  if (shouldUseUpstreamFormat(compat)) {
    return {
      code: error.status || 500,
      status: 'error',
      message: error.message || 'Internal server error',
      data: null,
    };
  }
  
  return {
    error: true,
    message: error.message || 'Internal server error',
    statusCode: error.status || 500,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Transform success response to upstream-compatible format
 */
export function transformSuccessToUpstreamFormat<T>(
  data: T,
  compat?: string,
  upstreamFormat?: any
): any {
  if (shouldUseUpstreamFormat(compat)) {
    // If we have the original upstream format, use it as a template
    if (upstreamFormat) {
      return {
        ...upstreamFormat,
        data: data,
        source: 'deenmate',
      };
    }
    
    // Default upstream-compatible format
    return {
      code: 200,
      status: 'OK',
      data: data,
      source: 'deenmate',
    };
  }
  
  return data;
}
