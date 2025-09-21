export interface RateLimitRule {
  id?: number;
  endpoint: string;
  method?: string;
  limitCount: number;
  windowSeconds: number;
  enabled: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateRateLimitRuleDto {
  endpoint: string;
  method?: string;
  limitCount: number;
  windowSeconds: number;
  enabled?: boolean;
}

export interface UpdateRateLimitRuleDto {
  method?: string;
  limitCount?: number;
  windowSeconds?: number;
  enabled?: boolean;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter?: number;
}

export interface RateLimitStatus {
  limit: number;
  remaining: number;
  resetTime: number;
  windowSeconds: number;
}
