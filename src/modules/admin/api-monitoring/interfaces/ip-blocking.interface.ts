export interface IpBlockingRule {
  id?: number;
  ipAddress: string;
  reason?: string;
  blockedBy: string;
  blockedAt?: Date;
  expiresAt?: Date;
  enabled: boolean;
}

export interface BlockIpDto {
  ipAddress: string;
  reason?: string;
  blockedBy: string;
  expiresAt?: Date;
}

export interface TopBlockedIp {
  ipAddress: string;
  requestCount: number;
  errorCount: number;
  blockReason?: string;
  blockedAt?: Date;
  lastRequest?: Date;
}

export interface BlockingHistory {
  id: number;
  action: 'blocked' | 'unblocked';
  reason?: string;
  performedBy: string;
  performedAt: Date;
  metadata?: any;
}

export interface ClientIpStat {
  id: number;
  ipAddress: string;
  requestCount: number;
  errorCount: number;
  lastRequest: Date;
  blocked: boolean;
  blockReason?: string;
  blockedAt?: Date;
  unblockedAt?: Date;
  geoIpInfo?: any;
}
