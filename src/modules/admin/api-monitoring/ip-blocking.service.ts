import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  IpBlockingRule,
  BlockIpDto,
  TopBlockedIp,
  BlockingHistory,
  ClientIpStat,
} from './interfaces/ip-blocking.interface';

@Injectable()
export class IpBlockingService {
  private readonly logger = new Logger(IpBlockingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getIpBlockingRules(): Promise<IpBlockingRule[]> {
    try {
      return await this.prisma.ipBlockingRule.findMany({
        orderBy: { blockedAt: 'desc' },
      });
    } catch (error) {
      this.logger.error('Error getting IP blocking rules:', error);
      return [];
    }
  }

  async blockIp(
    ipAddress: string,
    reason: string,
    blockedBy: string,
    expiresAt?: Date,
  ): Promise<IpBlockingRule> {
    try {
      // Create or update IP blocking rule
      const blockingRule = await this.prisma.ipBlockingRule.upsert({
        where: { ipAddress },
        update: {
          reason,
          blockedBy,
          blockedAt: new Date(),
          expiresAt,
          enabled: true,
        },
        create: {
          ipAddress,
          reason,
          blockedBy,
          blockedAt: new Date(),
          expiresAt,
          enabled: true,
        },
      });

      // Update client IP stats
      await this.prisma.clientIpStat.upsert({
        where: { ipAddress },
        update: {
          blocked: true,
          blockReason: reason,
          blockedAt: new Date(),
        },
        create: {
          ipAddress,
          requestCount: 0,
          errorCount: 0,
          lastRequest: new Date(),
          blocked: true,
          blockReason: reason,
          blockedAt: new Date(),
        },
      });

      this.logger.log(`IP ${ipAddress} blocked by ${blockedBy}. Reason: ${reason}`);
      return blockingRule;
    } catch (error) {
      this.logger.error('Error blocking IP:', error);
      throw error;
    }
  }

  async unblockIp(ipAddress: string): Promise<void> {
    try {
      // Update IP blocking rule
      await this.prisma.ipBlockingRule.updateMany({
        where: { ipAddress },
        data: {
          enabled: false,
          unblockedAt: new Date(),
        },
      });

      // Update client IP stats
      await this.prisma.clientIpStat.updateMany({
        where: { ipAddress },
        data: {
          blocked: false,
          unblockedAt: new Date(),
        },
      });

      this.logger.log(`IP ${ipAddress} unblocked`);
    } catch (error) {
      this.logger.error('Error unblocking IP:', error);
      throw error;
    }
  }

  async isIpBlocked(ipAddress: string): Promise<boolean> {
    try {
      const rule = await this.prisma.ipBlockingRule.findFirst({
        where: {
          ipAddress,
          enabled: true,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } },
          ],
        },
      });

      return !!rule;
    } catch (error) {
      this.logger.error('Error checking if IP is blocked:', error);
      return false;
    }
  }

  async getIpStats(ipAddress: string): Promise<ClientIpStat | null> {
    try {
      return await this.prisma.clientIpStat.findUnique({
        where: { ipAddress },
      });
    } catch (error) {
      this.logger.error('Error getting IP stats:', error);
      return null;
    }
  }

  async getTopBlockedIps(limit: number = 10): Promise<TopBlockedIp[]> {
    try {
      const blockedIps = await this.prisma.clientIpStat.findMany({
        where: { blocked: true },
        orderBy: { requestCount: 'desc' },
        take: limit,
      });

      return blockedIps.map((ip) => ({
        ipAddress: ip.ipAddress,
        requestCount: ip.requestCount,
        errorCount: ip.errorCount,
        blockReason: ip.blockReason,
        blockedAt: ip.blockedAt,
        lastRequest: ip.lastRequest,
      }));
    } catch (error) {
      this.logger.error('Error getting top blocked IPs:', error);
      return [];
    }
  }

  async getBlockingHistory(ipAddress: string): Promise<BlockingHistory[]> {
    try {
      // This is a simplified implementation
      // In a real scenario, you might want to create a separate audit log table
      const rules = await this.prisma.ipBlockingRule.findMany({
        where: { ipAddress },
        orderBy: { blockedAt: 'desc' },
      });

      return rules.map((rule) => ({
        id: rule.id,
        action: rule.enabled ? 'blocked' : 'unblocked',
        reason: rule.reason,
        performedBy: rule.blockedBy,
        performedAt: rule.enabled ? rule.blockedAt : rule.unblockedAt || rule.blockedAt,
        metadata: {
          expiresAt: rule.expiresAt,
        },
      }));
    } catch (error) {
      this.logger.error('Error getting blocking history:', error);
      return [];
    }
  }

  async getBlockedIpsCount(): Promise<number> {
    try {
      return await this.prisma.ipBlockingRule.count({
        where: { enabled: true },
      });
    } catch (error) {
      this.logger.error('Error getting blocked IPs count:', error);
      return 0;
    }
  }

  async getRecentlyBlockedIps(limit: number = 10): Promise<IpBlockingRule[]> {
    try {
      return await this.prisma.ipBlockingRule.findMany({
        where: { enabled: true },
        orderBy: { blockedAt: 'desc' },
        take: limit,
      });
    } catch (error) {
      this.logger.error('Error getting recently blocked IPs:', error);
      return [];
    }
  }

  async cleanupExpiredBlocks(): Promise<number> {
    try {
      const result = await this.prisma.ipBlockingRule.updateMany({
        where: {
          enabled: true,
          expiresAt: { lt: new Date() },
        },
        data: {
          enabled: false,
          unblockedAt: new Date(),
        },
      });

      // Also update client IP stats
      await this.prisma.clientIpStat.updateMany({
        where: {
          blocked: true,
          blockedAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) }, // 24 hours ago
        },
        data: {
          blocked: false,
          unblockedAt: new Date(),
        },
      });

      this.logger.log(`Cleaned up ${result.count} expired IP blocks`);
      return result.count;
    } catch (error) {
      this.logger.error('Error cleaning up expired blocks:', error);
      return 0;
    }
  }
}
