import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import {
  ApiRequestLog,
  ApiEndpointStat,
  ClientIpStat,
  ApiMonitoringFilters,
  IpStatsFilters,
  ApiRequestLogFilters,
  PaginatedApiLogs,
  ApiAnalytics,
  TopEndpoint,
  ErrorRate,
  RequestTrend,
} from './interfaces/api-monitoring.interface';

@Injectable()
export class ApiMonitoringService {
  private readonly logger = new Logger(ApiMonitoringService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logRequest(logData: ApiRequestLog): Promise<void> {
    try {
      await this.prisma.apiRequestLog.create({
        data: {
          endpoint: logData.endpoint,
          method: logData.method,
          statusCode: logData.statusCode,
          latencyMs: logData.latencyMs,
          requestIp: logData.requestIp,
          userAgent: logData.userAgent,
          userId: logData.userId,
          metadata: logData.metadata,
        },
      });

      // Update endpoint stats
      await this.updateEndpointStats(
        logData.endpoint,
        logData.method,
        logData.statusCode,
        logData.latencyMs,
      );

      // Update client IP stats
      await this.updateClientIpStats(logData.requestIp, logData.statusCode);
    } catch (error) {
      this.logger.error('Error logging API request:', error);
    }
  }

  async updateEndpointStats(
    endpoint: string,
    method: string,
    statusCode: number,
    latency: number,
  ): Promise<void> {
    try {
      const isError = statusCode >= 400;
      
      await this.prisma.apiEndpointStat.upsert({
        where: { endpoint },
        update: {
          requestCount: { increment: 1 },
          errorCount: isError ? { increment: 1 } : undefined,
          avgLatencyMs: {
            // Calculate running average
            set: await this.calculateAverageLatency(endpoint, latency),
          },
          lastUpdated: new Date(),
        },
        create: {
          endpoint,
          method,
          requestCount: 1,
          errorCount: isError ? 1 : 0,
          avgLatencyMs: latency,
          lastUpdated: new Date(),
        },
      });
    } catch (error) {
      this.logger.error('Error updating endpoint stats:', error);
    }
  }

  private async calculateAverageLatency(endpoint: string, newLatency: number): Promise<number> {
    try {
      const existing = await this.prisma.apiEndpointStat.findUnique({
        where: { endpoint },
        select: { avgLatencyMs: true, requestCount: true },
      });

      if (!existing) {
        return newLatency;
      }

      const totalRequests = existing.requestCount + 1;
      const currentTotal = existing.avgLatencyMs * existing.requestCount;
      return (currentTotal + newLatency) / totalRequests;
    } catch (error) {
      this.logger.error('Error calculating average latency:', error);
      return newLatency;
    }
  }

  private async updateClientIpStats(ipAddress: string, statusCode: number): Promise<void> {
    try {
      const isError = statusCode >= 400;
      
      await this.prisma.clientIpStat.upsert({
        where: { ipAddress },
        update: {
          requestCount: { increment: 1 },
          errorCount: isError ? { increment: 1 } : undefined,
          lastRequest: new Date(),
        },
        create: {
          ipAddress,
          requestCount: 1,
          errorCount: isError ? 1 : 0,
          lastRequest: new Date(),
          blocked: false,
        },
      });
    } catch (error) {
      this.logger.error('Error updating client IP stats:', error);
    }
  }

  async getEndpointStats(filters?: ApiMonitoringFilters): Promise<ApiEndpointStat[]> {
    try {
      const where: any = {};

      if (filters?.endpoint) {
        where.endpoint = { contains: filters.endpoint };
      }

      if (filters?.method) {
        where.method = filters.method;
      }

      return await this.prisma.apiEndpointStat.findMany({
        where,
        orderBy: { requestCount: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      });
    } catch (error) {
      this.logger.error('Error getting endpoint stats:', error);
      return [];
    }
  }

  async getClientIpStats(filters?: IpStatsFilters): Promise<ClientIpStat[]> {
    try {
      const where: any = {};

      if (filters?.blocked !== undefined) {
        where.blocked = filters.blocked;
      }

      return await this.prisma.clientIpStat.findMany({
        where,
        orderBy: { requestCount: 'desc' },
        take: filters?.limit || 50,
        skip: filters?.offset || 0,
      });
    } catch (error) {
      this.logger.error('Error getting client IP stats:', error);
      return [];
    }
  }

  async getApiRequestLogs(filters?: ApiRequestLogFilters): Promise<PaginatedApiLogs> {
    try {
      const where: any = {};

      if (filters?.startDate && filters?.endDate) {
        where.timestamp = {
          gte: new Date(filters.startDate),
          lte: new Date(filters.endDate),
        };
      }

      if (filters?.endpoint) {
        where.endpoint = { contains: filters.endpoint };
      }

      if (filters?.method) {
        where.method = filters.method;
      }

      if (filters?.statusCode) {
        where.statusCode = filters.statusCode;
      }

      if (filters?.requestIp) {
        where.requestIp = filters.requestIp;
      }

      const limit = filters?.limit || 50;
      const offset = filters?.offset || 0;

      const [logs, total] = await Promise.all([
        this.prisma.apiRequestLog.findMany({
          where,
          orderBy: { timestamp: 'desc' },
          take: limit,
          skip: offset,
        }),
        this.prisma.apiRequestLog.count({ where }),
      ]);

      return {
        logs,
        total,
        page: Math.floor(offset / limit) + 1,
        limit,
        totalPages: Math.ceil(total / limit),
      };
    } catch (error) {
      this.logger.error('Error getting API request logs:', error);
      return {
        logs: [],
        total: 0,
        page: 1,
        limit: 50,
        totalPages: 0,
      };
    }
  }

  async getApiAnalytics(timeRange: string = '24h'): Promise<ApiAnalytics> {
    try {
      const now = new Date();
      let startDate: Date;

      switch (timeRange) {
        case '1h':
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const [totalRequests, totalErrors, avgLatency, topEndpoints, errorRates, requestTrends] =
        await Promise.all([
          this.getTotalRequests(startDate),
          this.getTotalErrors(startDate),
          this.getAverageLatency(startDate),
          this.getTopEndpoints(10),
          this.getErrorRates(timeRange),
          this.getRequestTrends(startDate),
        ]);

      const errorRate = totalRequests > 0 ? (totalErrors / totalRequests) * 100 : 0;

      return {
        totalRequests,
        totalErrors,
        avgLatency,
        errorRate,
        topEndpoints,
        errorRates,
        requestTrends,
      };
    } catch (error) {
      this.logger.error('Error getting API analytics:', error);
      return {
        totalRequests: 0,
        totalErrors: 0,
        avgLatency: 0,
        errorRate: 0,
        topEndpoints: [],
        errorRates: [],
        requestTrends: [],
      };
    }
  }

  async getTopEndpoints(limit: number = 10): Promise<TopEndpoint[]> {
    try {
      const endpoints = await this.prisma.apiEndpointStat.findMany({
        orderBy: { requestCount: 'desc' },
        take: limit,
      });

      return endpoints.map((endpoint) => ({
        endpoint: endpoint.endpoint,
        method: endpoint.method,
        requestCount: endpoint.requestCount,
        errorCount: endpoint.errorCount,
        avgLatency: endpoint.avgLatencyMs,
        errorRate: endpoint.requestCount > 0 ? (endpoint.errorCount / endpoint.requestCount) * 100 : 0,
      }));
    } catch (error) {
      this.logger.error('Error getting top endpoints:', error);
      return [];
    }
  }

  async getErrorRates(timeRange: string = '24h'): Promise<ErrorRate[]> {
    try {
      const now = new Date();
      let startDate: Date;

      switch (timeRange) {
        case '1h':
          startDate = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      }

      const errorStats = await this.prisma.apiRequestLog.groupBy({
        by: ['statusCode'],
        where: {
          timestamp: { gte: startDate },
          statusCode: { gte: 400 },
        },
        _count: { statusCode: true },
      });

      const totalErrors = errorStats.reduce((sum, stat) => sum + stat._count.statusCode, 0);

      return errorStats.map((stat) => ({
        statusCode: stat.statusCode,
        count: stat._count.statusCode,
        percentage: totalErrors > 0 ? (stat._count.statusCode / totalErrors) * 100 : 0,
      }));
    } catch (error) {
      this.logger.error('Error getting error rates:', error);
      return [];
    }
  }

  private async getTotalRequests(startDate: Date): Promise<number> {
    return await this.prisma.apiRequestLog.count({
      where: { timestamp: { gte: startDate } },
    });
  }

  private async getTotalErrors(startDate: Date): Promise<number> {
    return await this.prisma.apiRequestLog.count({
      where: {
        timestamp: { gte: startDate },
        statusCode: { gte: 400 },
      },
    });
  }

  private async getAverageLatency(startDate: Date): Promise<number> {
    const result = await this.prisma.apiRequestLog.aggregate({
      where: { timestamp: { gte: startDate } },
      _avg: { latencyMs: true },
    });

    return result._avg.latencyMs || 0;
  }

  private async getRequestTrends(startDate: Date): Promise<RequestTrend[]> {
    // This is a simplified implementation
    // In a real scenario, you might want to use raw SQL for better performance
    const trends: RequestTrend[] = [];
    const now = new Date();
    const daysDiff = Math.ceil((now.getTime() - startDate.getTime()) / (24 * 60 * 60 * 1000));

    for (let i = 0; i < daysDiff; i++) {
      const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const nextDate = new Date(date.getTime() + 24 * 60 * 60 * 1000);

      const [requests, errors, avgLatency] = await Promise.all([
        this.prisma.apiRequestLog.count({
          where: {
            timestamp: { gte: date, lt: nextDate },
          },
        }),
        this.prisma.apiRequestLog.count({
          where: {
            timestamp: { gte: date, lt: nextDate },
            statusCode: { gte: 400 },
          },
        }),
        this.prisma.apiRequestLog.aggregate({
          where: {
            timestamp: { gte: date, lt: nextDate },
          },
          _avg: { latencyMs: true },
        }),
      ]);

      trends.push({
        date: date.toISOString().split('T')[0],
        requests,
        errors,
        avgLatency: avgLatency._avg.latencyMs || 0,
      });
    }

    return trends;
  }
}
