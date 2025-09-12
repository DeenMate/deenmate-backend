import { Controller, Get, Post, Param, Query, UseGuards } from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiBearerAuth } from "@nestjs/swagger";
import { AdminService } from "./admin.service";
import { JwtAuthGuard } from "./guards/jwt-auth.guard";

@ApiTags("Admin - System Management")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller({ path: "admin", version: "4" })
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("stats")
  @ApiOperation({ summary: "Get comprehensive system statistics" })
  @ApiResponse({
    status: 200,
    description: "System statistics retrieved successfully",
  })
  async getSystemStats() {
    const stats = await this.adminService.getSystemStats();

    return {
      success: true,
      data: { stats },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get("summary")
  @ApiOperation({ summary: "Get dashboard summary for admin panel" })
  @ApiResponse({
    status: 200,
    description: "Dashboard summary retrieved successfully",
  })
  async getDashboardSummary() {
    const stats = await this.adminService.getSystemStats();
    const modules = await this.adminService.getModuleSummary();

    return {
      success: true,
      data: { 
        modules,
        systemHealth: {
          isHealthy: stats.system.redisConnected && stats.system.databaseConnected,
          uptime: stats.system.uptime,
          memoryUsage: stats.system.memoryUsage,
        }
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get("sync-logs")
  @ApiOperation({ summary: "Get sync job logs" })
  @ApiQuery({
    name: "limit",
    required: false,
    schema: { type: "integer", default: 50 },
  })
  @ApiResponse({ status: 200, description: "Sync logs retrieved successfully" })
  async getSyncLogs(@Query("limit") limit?: string) {
    const limitNum = limit ? parseInt(limit) : 50;
    const logs = await this.adminService.getSyncLogs(limitNum);

    return {
      success: true,
      data: { logs },
      meta: {
        total: logs.length,
        limit: limitNum,
      },
    };
  }

  @Post("sync/quran")
  @ApiOperation({ summary: "Trigger Quran data sync" })
  @ApiResponse({
    status: 200,
    description: "Quran sync triggered successfully",
  })
  async triggerQuranSync() {
    const result = await this.adminService.triggerQuranSync();

    return {
      success: result.success,
      message: result.message,
      data: { module: "quran" },
    };
  }

  @Post("sync/prayer")
  @ApiOperation({ summary: "Trigger Prayer data sync" })
  @ApiResponse({
    status: 200,
    description: "Prayer sync triggered successfully",
  })
  async triggerPrayerSync() {
    const result = await this.adminService.triggerPrayerSync();

    return {
      success: result.success,
      message: result.message,
      data: { module: "prayer" },
    };
  }

  @Post("sync/hadith")
  @ApiOperation({ summary: "Trigger Hadith data sync for all collections" })
  @ApiResponse({
    status: 200,
    description: "Hadith sync triggered successfully",
  })
  async triggerHadithSyncAll() {
    const result = await this.adminService.triggerHadithSync();

    return {
      success: result.success,
      message: result.message,
      data: { module: "hadith", scope: "all" },
    };
  }

  @Post("sync/hadith/:collectionName")
  @ApiOperation({ summary: "Trigger Hadith data sync for specific collection" })
  @ApiResponse({
    status: 200,
    description: "Hadith sync triggered successfully",
  })
  async triggerHadithSync(@Param("collectionName") collectionName: string) {
    const result = await this.adminService.triggerHadithSync(collectionName);

    return {
      success: result.success,
      message: result.message,
      data: { module: "hadith", collection: collectionName },
    };
  }

  @Post("sync/audio")
  @ApiOperation({ summary: "Trigger Audio data sync" })
  @ApiResponse({
    status: 200,
    description: "Audio sync triggered successfully",
  })
  async triggerAudioSync() {
    const result = await this.adminService.triggerAudioSync();

    return {
      success: result.success,
      message: result.message,
      data: { module: "audio" },
    };
  }

  @Post("sync/gold-price")
  @ApiOperation({ summary: "Trigger Gold price update" })
  @ApiResponse({
    status: 200,
    description: "Gold price update triggered successfully",
  })
  async triggerGoldPriceUpdate() {
    const result = await this.adminService.triggerGoldPriceUpdate();

    return {
      success: result.success,
      message: result.message,
      data: { module: "finance", type: "gold-price" },
    };
  }

  @Post("sync/:module")
  @ApiOperation({ summary: "Trigger sync for any module" })
  @ApiResponse({
    status: 200,
    description: "Module sync triggered successfully",
  })
  async triggerModuleSync(@Param("module") module: string) {
    const result = await this.adminService.triggerModuleSync(module);

    return {
      success: result.success,
      message: result.message,
      data: { module },
    };
  }

  @Get("queue-stats")
  @ApiOperation({ summary: "Get queue statistics" })
  @ApiResponse({ status: 200, description: "Queue statistics retrieved successfully" })
  async getQueueStats() {
    const stats = await this.adminService.getQueueStats();
    return {
      success: true,
      data: stats,
      meta: { timestamp: new Date().toISOString() },
    };
  }

  @Post("cache/clear")
  @ApiOperation({ summary: "Clear all cached data" })
  @ApiResponse({ status: 200, description: "Cache cleared successfully" })
  async clearCache() {
    const result = await this.adminService.clearCache();

    return {
      success: result.success,
      message: result.message,
      data: { action: "cache_clear" },
    };
  }

  // Health check endpoint
  @Get("health")
  @ApiOperation({ summary: "System health check" })
  @ApiResponse({ status: 200, description: "System health status" })
  async healthCheck() {
    const stats = await this.adminService.getSystemStats();

    const isHealthy =
      stats.system.redisConnected && stats.system.databaseConnected;

    return {
      success: true,
      data: {
        status: isHealthy ? "healthy" : "unhealthy",
        checks: {
          database: stats.system.databaseConnected ? "ok" : "error",
          redis: stats.system.redisConnected ? "ok" : "error",
          memory:
            stats.system.memoryUsage.heapUsed <
            stats.system.memoryUsage.heapTotal * 0.9
              ? "ok"
              : "warning",
        },
        uptime: stats.system.uptime,
        timestamp: new Date().toISOString(),
      },
    };
  }
}
