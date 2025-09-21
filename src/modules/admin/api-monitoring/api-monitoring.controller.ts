import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { ApiMonitoringService } from './api-monitoring.service';
import { RateLimitingService } from './rate-limiting.service';
import { IpBlockingService } from './ip-blocking.service';
import {
  ApiMonitoringFiltersDto,
  IpStatsFiltersDto,
  ApiRequestLogFiltersDto,
} from './dto/api-monitoring.dto';
import {
  CreateRateLimitRuleDto,
  UpdateRateLimitRuleDto,
} from './dto/rate-limiting.dto';
import { BlockIpDto } from './dto/ip-blocking.dto';

@Controller({ path: 'admin/monitoring/api', version: '4' })
@UseGuards(JwtAuthGuard)
export class ApiMonitoringController {
  private readonly logger = new Logger(ApiMonitoringController.name);

  constructor(
    private readonly apiMonitoringService: ApiMonitoringService,
    private readonly rateLimitingService: RateLimitingService,
    private readonly ipBlockingService: IpBlockingService,
  ) {}

  // API monitoring endpoints
  @Get('stats')
  async getEndpointStats(@Query() filters: ApiMonitoringFiltersDto) {
    try {
      const stats = await this.apiMonitoringService.getEndpointStats({
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        endpoint: filters.endpoint,
        method: filters.method,
        statusCode: filters.statusCode,
        limit: filters.limit,
        offset: filters.offset,
      });

      return {
        success: true,
        data: stats,
        message: 'Endpoint statistics retrieved successfully',
      };
    } catch (error) {
      this.logger.error('Error getting endpoint stats:', error);
      return {
        success: false,
        data: [],
        message: 'Failed to retrieve endpoint statistics',
        error: error.message,
      };
    }
  }

  @Get('ips')
  async getClientIpStats(@Query() filters: IpStatsFiltersDto) {
    try {
      const stats = await this.apiMonitoringService.getClientIpStats({
        blocked: filters.blocked,
        limit: filters.limit,
        offset: filters.offset,
      });

      return {
        success: true,
        data: stats,
        message: 'Client IP statistics retrieved successfully',
      };
    } catch (error) {
      this.logger.error('Error getting client IP stats:', error);
      return {
        success: false,
        data: [],
        message: 'Failed to retrieve client IP statistics',
        error: error.message,
      };
    }
  }

  @Get('logs')
  async getApiRequestLogs(@Query() filters: ApiRequestLogFiltersDto) {
    try {
      const logs = await this.apiMonitoringService.getApiRequestLogs({
        startDate: filters.startDate ? new Date(filters.startDate) : undefined,
        endDate: filters.endDate ? new Date(filters.endDate) : undefined,
        endpoint: filters.endpoint,
        method: filters.method,
        statusCode: filters.statusCode,
        requestIp: filters.requestIp,
        limit: filters.limit,
        offset: filters.offset,
      });

      return {
        success: true,
        data: logs,
        message: 'API request logs retrieved successfully',
      };
    } catch (error) {
      this.logger.error('Error getting API request logs:', error);
      return {
        success: false,
        data: { logs: [], total: 0, page: 1, limit: 50, totalPages: 0 },
        message: 'Failed to retrieve API request logs',
        error: error.message,
      };
    }
  }

  @Get('analytics')
  async getApiAnalytics(@Query('timeRange') timeRange: string = '24h') {
    try {
      const analytics = await this.apiMonitoringService.getApiAnalytics(timeRange);

      return {
        success: true,
        data: analytics,
        message: 'API analytics retrieved successfully',
      };
    } catch (error) {
      this.logger.error('Error getting API analytics:', error);
      return {
        success: false,
        data: {
          totalRequests: 0,
          totalErrors: 0,
          avgLatency: 0,
          errorRate: 0,
          topEndpoints: [],
          errorRates: [],
          requestTrends: [],
        },
        message: 'Failed to retrieve API analytics',
        error: error.message,
      };
    }
  }

  @Get('top-endpoints')
  async getTopEndpoints(@Query('limit') limit?: number) {
    try {
      const endpoints = await this.apiMonitoringService.getTopEndpoints(limit || 10);

      return {
        success: true,
        data: endpoints,
        message: 'Top endpoints retrieved successfully',
      };
    } catch (error) {
      this.logger.error('Error getting top endpoints:', error);
      return {
        success: false,
        data: [],
        message: 'Failed to retrieve top endpoints',
        error: error.message,
      };
    }
  }

  @Get('error-rates')
  async getErrorRates(@Query('timeRange') timeRange: string = '24h') {
    try {
      const errorRates = await this.apiMonitoringService.getErrorRates(timeRange);

      return {
        success: true,
        data: errorRates,
        message: 'Error rates retrieved successfully',
      };
    } catch (error) {
      this.logger.error('Error getting error rates:', error);
      return {
        success: false,
        data: [],
        message: 'Failed to retrieve error rates',
        error: error.message,
      };
    }
  }

  // Rate limiting management
  @Get('rate-limits')
  async getRateLimitRules() {
    try {
      const rules = await this.rateLimitingService.getRateLimitRules();

      return {
        success: true,
        data: rules,
        message: 'Rate limit rules retrieved successfully',
      };
    } catch (error) {
      this.logger.error('Error getting rate limit rules:', error);
      return {
        success: false,
        data: [],
        message: 'Failed to retrieve rate limit rules',
        error: error.message,
      };
    }
  }

  @Post('rate-limits')
  async createRateLimitRule(@Body() rule: CreateRateLimitRuleDto) {
    try {
      const newRule = await this.rateLimitingService.createRateLimitRule(rule);

      return {
        success: true,
        data: newRule,
        message: 'Rate limit rule created successfully',
      };
    } catch (error) {
      this.logger.error('Error creating rate limit rule:', error);
      return {
        success: false,
        data: null,
        message: 'Failed to create rate limit rule',
        error: error.message,
      };
    }
  }

  @Put('rate-limits/:id')
  async updateRateLimitRule(
    @Param('id') id: number,
    @Body() rule: UpdateRateLimitRuleDto,
  ) {
    try {
      const updatedRule = await this.rateLimitingService.updateRateLimitRule(id, rule);

      return {
        success: true,
        data: updatedRule,
        message: 'Rate limit rule updated successfully',
      };
    } catch (error) {
      this.logger.error('Error updating rate limit rule:', error);
      return {
        success: false,
        data: null,
        message: 'Failed to update rate limit rule',
        error: error.message,
      };
    }
  }

  @Delete('rate-limits/:id')
  async deleteRateLimitRule(@Param('id') id: number) {
    try {
      await this.rateLimitingService.deleteRateLimitRule(id);

      return {
        success: true,
        data: null,
        message: 'Rate limit rule deleted successfully',
      };
    } catch (error) {
      this.logger.error('Error deleting rate limit rule:', error);
      return {
        success: false,
        data: null,
        message: 'Failed to delete rate limit rule',
        error: error.message,
      };
    }
  }

  // IP blocking management
  @Get('ip-blocking')
  async getIpBlockingRules() {
    try {
      const rules = await this.ipBlockingService.getIpBlockingRules();

      return {
        success: true,
        data: rules,
        message: 'IP blocking rules retrieved successfully',
      };
    } catch (error) {
      this.logger.error('Error getting IP blocking rules:', error);
      return {
        success: false,
        data: [],
        message: 'Failed to retrieve IP blocking rules',
        error: error.message,
      };
    }
  }

  @Post('ip-blocking')
  async blockIp(@Body() blockData: BlockIpDto) {
    try {
      const blockedIp = await this.ipBlockingService.blockIp(
        blockData.ipAddress,
        blockData.reason || 'Manual block',
        blockData.blockedBy,
        blockData.expiresAt ? new Date(blockData.expiresAt) : undefined,
      );

      return {
        success: true,
        data: blockedIp,
        message: 'IP address blocked successfully',
      };
    } catch (error) {
      this.logger.error('Error blocking IP:', error);
      return {
        success: false,
        data: null,
        message: 'Failed to block IP address',
        error: error.message,
      };
    }
  }

  @Delete('ip-blocking/:ipAddress')
  async unblockIp(@Param('ipAddress') ipAddress: string) {
    try {
      await this.ipBlockingService.unblockIp(ipAddress);

      return {
        success: true,
        data: null,
        message: 'IP address unblocked successfully',
      };
    } catch (error) {
      this.logger.error('Error unblocking IP:', error);
      return {
        success: false,
        data: null,
        message: 'Failed to unblock IP address',
        error: error.message,
      };
    }
  }

  @Get('ip-blocking/:ipAddress/stats')
  async getIpStats(@Param('ipAddress') ipAddress: string) {
    try {
      const stats = await this.ipBlockingService.getIpStats(ipAddress);

      return {
        success: true,
        data: stats,
        message: 'IP statistics retrieved successfully',
      };
    } catch (error) {
      this.logger.error('Error getting IP stats:', error);
      return {
        success: false,
        data: null,
        message: 'Failed to retrieve IP statistics',
        error: error.message,
      };
    }
  }

  @Get('ip-blocking/top-blocked')
  async getTopBlockedIps(@Query('limit') limit?: number) {
    try {
      const blockedIps = await this.ipBlockingService.getTopBlockedIps(limit || 10);

      return {
        success: true,
        data: blockedIps,
        message: 'Top blocked IPs retrieved successfully',
      };
    } catch (error) {
      this.logger.error('Error getting top blocked IPs:', error);
      return {
        success: false,
        data: [],
        message: 'Failed to retrieve top blocked IPs',
        error: error.message,
      };
    }
  }

  @Get('ip-blocking/:ipAddress/history')
  async getBlockingHistory(@Param('ipAddress') ipAddress: string) {
    try {
      const history = await this.ipBlockingService.getBlockingHistory(ipAddress);

      return {
        success: true,
        data: history,
        message: 'Blocking history retrieved successfully',
      };
    } catch (error) {
      this.logger.error('Error getting blocking history:', error);
      return {
        success: false,
        data: [],
        message: 'Failed to retrieve blocking history',
        error: error.message,
      };
    }
  }
}
