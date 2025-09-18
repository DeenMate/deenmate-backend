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

  @Post("sync/prayer/prewarm")
  @ApiOperation({ summary: "Prewarm prayer times for all locations (default 7 days)" })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days including today' })
  async prewarmPrayer(@Query('days') days?: string) {
    const result = await this.adminService.prewarmPrayerTimes(days ? parseInt(days, 10) : 7);
    return {
      success: result.success,
      message: `Prewarm completed in ${result.durationMs}ms`,
      data: result,
    };
  }

  @Post("sync/prayer/times")
  @ApiOperation({ summary: "Sync prayer times for specific location and method" })
  @ApiQuery({ name: 'lat', required: true, type: Number, description: 'Latitude' })
  @ApiQuery({ name: 'lng', required: true, type: Number, description: 'Longitude' })
  @ApiQuery({ name: 'methodCode', required: true, type: String, description: 'Prayer calculation method code' })
  @ApiQuery({ name: 'school', required: false, type: Number, description: 'School: 0=Shafi, 1=Hanafi (default: 0)' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Number of days to sync (default: 1)' })
  @ApiQuery({ name: 'force', required: false, type: Boolean, description: 'Force sync even if data exists (default: false)' })
  @ApiQuery({ name: 'latitudeAdjustmentMethod', required: false, type: Number, description: 'High latitude adjustment: 0=None, 1=Middle, 2=OneSeventh, 3=AngleBased (default: 0)' })
  @ApiQuery({ name: 'tune', required: false, type: String, description: 'Minute offsets: "fajr,sunrise,dhuhr,asr,maghrib,isha" (default: null)' })
  @ApiQuery({ name: 'timezonestring', required: false, type: String, description: 'IANA timezone: "Asia/Dhaka", "America/New_York" (default: null)' })
  async syncPrayerTimes(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('methodCode') methodCode: string,
    @Query('school') school?: string,
    @Query('days') days?: string,
    @Query('force') force?: string,
    @Query('latitudeAdjustmentMethod') latitudeAdjustmentMethod?: string,
    @Query('tune') tune?: string,
    @Query('timezonestring') timezonestring?: string
  ) {
    const result = await this.adminService.syncPrayerTimesForLocation(
      parseFloat(lat),
      parseFloat(lng),
      methodCode,
      school ? parseInt(school, 10) : 0,
      days ? parseInt(days, 10) : 1,
      force === 'true',
      latitudeAdjustmentMethod ? parseInt(latitudeAdjustmentMethod, 10) : undefined,
      tune,
      timezonestring
    );
    return {
      success: result.success,
      message: result.message,
      data: result,
    };
  }

  @Post("sync/prayer/calendar")
  @ApiOperation({ summary: "Sync prayer times for a full month using calendar endpoint" })
  @ApiQuery({ name: 'lat', required: true, type: Number, description: 'Latitude' })
  @ApiQuery({ name: 'lng', required: true, type: Number, description: 'Longitude' })
  @ApiQuery({ name: 'methodCode', required: true, type: String, description: 'Prayer calculation method code' })
  @ApiQuery({ name: 'school', required: false, type: Number, description: 'School: 0=Shafi, 1=Hanafi (default: 0)' })
  @ApiQuery({ name: 'year', required: true, type: Number, description: 'Year (e.g., 2025)' })
  @ApiQuery({ name: 'month', required: true, type: Number, description: 'Month (1-12)' })
  @ApiQuery({ name: 'force', required: false, type: Boolean, description: 'Force sync even if data exists (default: false)' })
  @ApiQuery({ name: 'latitudeAdjustmentMethod', required: false, type: Number, description: 'High latitude adjustment: 0=None, 1=Middle, 2=OneSeventh, 3=AngleBased (default: 0)' })
  @ApiQuery({ name: 'tune', required: false, type: String, description: 'Minute offsets: "fajr,sunrise,dhuhr,asr,maghrib,isha" (default: null)' })
  @ApiQuery({ name: 'timezonestring', required: false, type: String, description: 'IANA timezone: "Asia/Dhaka", "America/New_York" (default: null)' })
  async syncPrayerTimesCalendar(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('methodCode') methodCode: string,
    @Query('school') school?: string,
    @Query('year') year?: string,
    @Query('month') month?: string,
    @Query('force') force?: string,
    @Query('latitudeAdjustmentMethod') latitudeAdjustmentMethod?: string,
    @Query('tune') tune?: string,
    @Query('timezonestring') timezonestring?: string
  ) {
    const result = await this.adminService.syncPrayerTimesCalendar(
      parseFloat(lat),
      parseFloat(lng),
      methodCode,
      school ? parseInt(school, 10) : 0,
      year ? parseInt(year, 10) : new Date().getFullYear(),
      month ? parseInt(month, 10) : new Date().getMonth() + 1,
      force === 'true',
      latitudeAdjustmentMethod ? parseInt(latitudeAdjustmentMethod, 10) : undefined,
      tune,
      timezonestring
    );
    return {
      success: result.success,
      message: result.message,
      data: result,
    };
  }

  @Post("sync/prayer/hijri-calendar")
  @ApiOperation({ summary: "Sync prayer times for a full Hijri month using Hijri calendar endpoint" })
  @ApiQuery({ name: 'lat', required: true, type: Number, description: 'Latitude' })
  @ApiQuery({ name: 'lng', required: true, type: Number, description: 'Longitude' })
  @ApiQuery({ name: 'methodCode', required: true, type: String, description: 'Prayer calculation method code' })
  @ApiQuery({ name: 'school', required: false, type: Number, description: 'School: 0=Shafi, 1=Hanafi (default: 0)' })
  @ApiQuery({ name: 'hijriYear', required: true, type: Number, description: 'Hijri Year (e.g., 1447)' })
  @ApiQuery({ name: 'hijriMonth', required: true, type: Number, description: 'Hijri Month (1-12)' })
  @ApiQuery({ name: 'force', required: false, type: Boolean, description: 'Force sync even if data exists (default: false)' })
  @ApiQuery({ name: 'latitudeAdjustmentMethod', required: false, type: Number, description: 'High latitude adjustment: 0=None, 1=Middle, 2=OneSeventh, 3=AngleBased (default: 0)' })
  @ApiQuery({ name: 'tune', required: false, type: String, description: 'Minute offsets: "fajr,sunrise,dhuhr,asr,maghrib,isha" (default: null)' })
  @ApiQuery({ name: 'timezonestring', required: false, type: String, description: 'IANA timezone: "Asia/Dhaka", "America/New_York" (default: null)' })
  async syncPrayerTimesHijriCalendar(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Query('methodCode') methodCode: string,
    @Query('school') school?: string,
    @Query('hijriYear') hijriYear?: string,
    @Query('hijriMonth') hijriMonth?: string,
    @Query('force') force?: string,
    @Query('latitudeAdjustmentMethod') latitudeAdjustmentMethod?: string,
    @Query('tune') tune?: string,
    @Query('timezonestring') timezonestring?: string
  ) {
    const result = await this.adminService.syncPrayerTimesHijriCalendar(
      parseFloat(lat),
      parseFloat(lng),
      methodCode,
      school ? parseInt(school, 10) : 0,
      hijriYear ? parseInt(hijriYear, 10) : 1447,
      hijriMonth ? parseInt(hijriMonth, 10) : 1,
      force === 'true',
      latitudeAdjustmentMethod ? parseInt(latitudeAdjustmentMethod, 10) : undefined,
      tune,
      timezonestring
    );
    return {
      success: result.success,
      message: result.message,
      data: result,
    };
  }

  @Get("prayer/convert/gregorian-to-hijri")
  @ApiOperation({ summary: "Convert Gregorian date to Hijri date" })
  @ApiQuery({ name: 'date', required: true, type: String, description: 'Gregorian date in DD-MM-YYYY format' })
  async convertGregorianToHijri(@Query('date') date: string) {
    const result = await this.adminService.convertGregorianToHijri(date);
    return {
      success: !!result,
      data: result,
      message: result ? "Date converted successfully" : "Failed to convert date",
    };
  }

  @Get("prayer/convert/hijri-to-gregorian")
  @ApiOperation({ summary: "Convert Hijri date to Gregorian date" })
  @ApiQuery({ name: 'date', required: true, type: String, description: 'Hijri date in DD-MM-YYYY format' })
  async convertHijriToGregorian(@Query('date') date: string) {
    const result = await this.adminService.convertHijriToGregorian(date);
    return {
      success: !!result,
      data: result,
      message: result ? "Date converted successfully" : "Failed to convert date",
    };
  }

  @Get("prayer/current-time")
  @ApiOperation({ summary: "Get current time in specified timezone" })
  @ApiQuery({ name: 'timezone', required: true, type: String, description: 'IANA timezone (e.g., Asia/Dhaka)' })
  async getCurrentTime(@Query('timezone') timezone: string) {
    const result = await this.adminService.getCurrentTime(timezone);
    return {
      success: !!result,
      data: result,
      message: result ? "Current time retrieved successfully" : "Failed to get current time",
    };
  }

  @Get("prayer/asma-al-husna")
  @ApiOperation({ summary: "Get Asma Al Husna (Names of Allah)" })
  async getAsmaAlHusna() {
    const result = await this.adminService.getAsmaAlHusna();
    return {
      success: !!result,
      data: result,
      message: result ? "Asma Al Husna retrieved successfully" : "Failed to get Asma Al Husna",
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

  @Get('prayer-filters/methods')
  @ApiOperation({ summary: 'Get prayer calculation methods for filtering' })
  @ApiResponse({ status: 200, description: 'Prayer methods retrieved successfully' })
  async getPrayerMethods() {
    const methods = await this.adminService.getPrayerMethods();
    return {
      success: true,
      data: methods,
    };
  }

  @Get('prayer-filters/madhabs')
  @ApiOperation({ summary: 'Get prayer madhabs for filtering' })
  @ApiResponse({ status: 200, description: 'Prayer madhabs retrieved successfully' })
  async getPrayerMadhabs() {
    const madhabs = [
      { id: 0, name: 'Shafi', code: 'shafi' },
      { id: 1, name: 'Hanafi', code: 'hanafi' },
    ];
    return {
      success: true,
      data: madhabs,
    };
  }
}
