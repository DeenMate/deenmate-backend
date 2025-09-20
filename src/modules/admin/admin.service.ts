import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { WorkerService, SyncJob } from "../../workers/worker.service";
import { QuranSyncService } from "../quran/quran.sync.service";
import { PrayerSyncService } from "../prayer/prayer.sync.service";
import { HadithSyncService } from "../hadith/hadith-sync.service";
import { AudioSyncService } from "../audio/audio.sync.service";
import { GoldPriceScheduler } from "../finance/goldprice.scheduler";
import { GoldPriceService } from "../finance/goldprice.service";

export interface SystemStats {
  quran: {
    chapters: number;
    verses: number;
    translations: number;
    lastSync: Date | null;
  };
  prayer: {
    locations: number;
    methods: number;
    lastSync: Date | null;
  };
  hadith: {
    collections: number;
    books: number;
    hadiths: number;
    lastSync: Date | null;
  };
  audio: {
    reciters: number;
    audioFiles: number;
    lastSync: Date | null;
  };
  finance: {
    goldPrices: number;
    lastUpdate: Date | null;
  };
  system: {
    uptime: number;
    memoryUsage: NodeJS.MemoryUsage;
    redisConnected: boolean;
    databaseConnected: boolean;
  };
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly workerService: WorkerService,
    private readonly quranSync: QuranSyncService,
    private readonly prayerSync: PrayerSyncService,
    private readonly hadithSync: HadithSyncService,
    private readonly audioSync: AudioSyncService,
    private readonly goldPriceScheduler: GoldPriceScheduler,
    private readonly goldPriceService: GoldPriceService,
  ) {}

  async getSystemStats(): Promise<SystemStats> {
    this.logger.log("Fetching system statistics");

    try {
      const [
        quranStats,
        prayerStats,
        hadithStats,
        audioStats,
        financeStats,
        systemStats,
      ] = await Promise.all([
        this.getQuranStats(),
        this.getPrayerStats(),
        this.getHadithStats(),
        this.getAudioStats(),
        this.getFinanceStats(),
        this.getSystemHealthStats(),
      ]);

      return {
        quran: quranStats,
        prayer: prayerStats,
        hadith: hadithStats,
        audio: audioStats,
        finance: financeStats,
        system: systemStats,
      };
    } catch (error) {
      this.logger.error("Failed to fetch system stats", error.stack);
      throw error;
    }
  }

  async getModuleSummary() {
    this.logger.log("Fetching module summary for dashboard");

    try {
      const stats = await this.getSystemStats();
      
      return [
        {
          name: 'Quran',
          recordCount: stats.quran.verses,
          lastSync: stats.quran.lastSync,
          syncStatus: this.getSyncStatus(stats.quran.lastSync),
          isHealthy: true,
          details: {
            chapters: stats.quran.chapters,
            verses: stats.quran.verses,
            translations: stats.quran.translations,
          }
        },
        {
          name: 'Hadith',
          recordCount: stats.hadith.hadiths,
          lastSync: stats.hadith.lastSync,
          syncStatus: this.getSyncStatus(stats.hadith.lastSync),
          isHealthy: true,
          details: {
            collections: stats.hadith.collections,
            books: stats.hadith.books,
            hadiths: stats.hadith.hadiths,
          }
        },
        {
          name: 'Prayer Times',
          recordCount: stats.prayer.locations,
          lastSync: stats.prayer.lastSync,
          syncStatus: this.getSyncStatus(stats.prayer.lastSync),
          isHealthy: true,
          details: {
            locations: stats.prayer.locations,
            methods: stats.prayer.methods,
          }
        },
        {
          name: 'Zakat',
          recordCount: 0, // Zakat doesn't have stored records, it's calculated
          lastSync: null,
          syncStatus: 'idle' as const,
          isHealthy: true,
          details: {
            note: 'Zakat calculations are performed on-demand'
          }
        },
        {
          name: 'Audio',
          recordCount: stats.audio.audioFiles,
          lastSync: stats.audio.lastSync,
          syncStatus: this.getSyncStatus(stats.audio.lastSync),
          isHealthy: true,
          details: {
            reciters: stats.audio.reciters,
            audioFiles: stats.audio.audioFiles,
          }
        },
        {
          name: 'Finance',
          recordCount: stats.finance.goldPrices,
          lastSync: stats.finance.lastUpdate,
          syncStatus: this.getSyncStatus(stats.finance.lastUpdate),
          isHealthy: true,
          details: {
            goldPrices: stats.finance.goldPrices,
          }
        }
      ];
    } catch (error) {
      this.logger.error("Failed to fetch module summary", error.stack);
      throw error;
    }
  }

  private getSyncStatus(lastSync: Date | null): 'success' | 'failed' | 'pending' | 'idle' {
    if (!lastSync) return 'idle';
    
    const hoursSinceSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceSync < 1) return 'success';
    if (hoursSinceSync < 24) return 'success';
    return 'idle';
  }

  private async getQuranStats() {
    const [chapters, verses, translations, lastSync] = await Promise.all([
      this.prisma.quranChapter.count(),
      this.prisma.quranVerse.count(),
      this.prisma.verseTranslation.count(),
      this.prisma.syncJobLog.findFirst({
        where: { 
          jobName: { in: ["quran-daily", "quran-translations", "quran-verses", "quran-verse-translations"] },
          status: "success"
        },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true },
      }),
    ]);

    return {
      chapters,
      verses,
      translations,
      lastSync: lastSync?.startedAt || null,
    };
  }

  private async getPrayerStats() {
    const [locations, methods, lastSync] = await Promise.all([
      this.prisma.prayerLocation.count(),
      this.prisma.prayerCalculationMethod.count(),
      this.prisma.syncJobLog.findFirst({
        where: { 
          jobName: { in: ["prayer-prewarm", "prayer-times"] },
          status: "success"
        },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true },
      }),
    ]);

    return {
      locations,
      methods,
      lastSync: lastSync?.startedAt || null,
    };
  }

  private async getHadithStats() {
    const [collections, books, hadiths, lastSync] = await Promise.all([
      this.prisma.hadithCollection.count(),
      this.prisma.hadithBook.count(),
      this.prisma.hadith.count(),
      this.prisma.syncJobLog.findFirst({
        where: { 
          jobName: "hadith-sync",
          status: "success"
        },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true },
      }),
    ]);

    return {
      collections,
      books,
      hadiths,
      lastSync: lastSync?.startedAt || null,
    };
  }

  private async getAudioStats() {
    const [reciters, audioFiles, lastSync] = await Promise.all([
      this.prisma.quranReciter.count(),
      this.prisma.quranAudioFile.count(),
      this.prisma.syncJobLog.findFirst({
        where: { 
          jobName: { in: ["audio-files-sync", "reciters-sync"] },
          status: "success"
        },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true },
      }),
    ]);

    return {
      reciters,
      audioFiles,
      lastSync: lastSync?.startedAt || null,
    };
  }

  private async getFinanceStats() {
    const [goldPrices, lastUpdate] = await Promise.all([
      this.prisma.goldPrice.count(),
      this.prisma.syncJobLog.findFirst({
        where: { 
          jobName: { in: ["finance-daily", "gold-price-update"] },
          status: "success"
        },
        orderBy: { startedAt: "desc" },
        select: { startedAt: true },
      }),
    ]);

    return {
      goldPrices,
      lastUpdate: lastUpdate?.startedAt || null,
    };
  }

  private async getSystemHealthStats() {
    const [redisConnected, databaseConnected] = await Promise.all([
      this.checkRedisConnection(),
      this.checkDatabaseConnection(),
    ]);

    return {
      uptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
      redisConnected,
      databaseConnected,
    };
  }

  private async checkRedisConnection(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch {
      return false;
    }
  }

  private async checkDatabaseConnection(): Promise<boolean> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return true;
    } catch {
      return false;
    }
  }

  async triggerQuranSync(): Promise<{ success: boolean; message: string }> {
    try {
      await this.quranSync.syncChapters();
      await this.quranSync.syncVerses();
      await this.quranSync.syncTranslationResources();
      await this.quranSync.syncVerseTranslations();
      return { success: true, message: "Quran sync triggered successfully" };
    } catch (error) {
      this.logger.error("Failed to trigger Quran sync", error.stack);
      return { success: false, message: `Quran sync failed: ${error.message}` };
    }
  }

  async triggerPrayerSync(): Promise<{ success: boolean; message: string }> {
    try {
      // Change behavior: When dashboard requests Prayer sync, run 1-day prewarm for all cities/methods/madhabs
      const res = await this.prayerSync.prewarmAllLocations(1);
      return { success: res.success, message: res.success ? "Prayer prewarm (today) triggered successfully" : "Prayer prewarm failed" };
    } catch (error) {
      this.logger.error("Failed to trigger Prayer sync", error.stack);
      return {
        success: false,
        message: `Prayer sync failed: ${error.message}`,
      };
    }
  }

  async prewarmPrayerTimes(days: number = 7) {
    try {
      // Queue the prayer prewarm as a background job instead of running synchronously
      const syncJob: SyncJob = {
        type: 'prayer',
        action: 'prewarm',
        data: { days },
        priority: 1,
      };

      // Add job to queue
      const job = await this.workerService.addSyncJob(syncJob);
      
      this.logger.log(`Prayer prewarm job queued with ID: ${job.id}`);
      
      return {
        success: true,
        message: `Prayer prewarm for ${days} days queued successfully`,
        jobId: job.id?.toString(),
        resource: 'times',
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsFailed: 0,
        errors: [],
        durationMs: 0,
      };
    } catch (error) {
      this.logger.error('Failed to queue prayer prewarm', error.stack);
      return {
        success: false,
        resource: 'times',
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsFailed: 0,
        errors: [error.message],
        durationMs: 0,
      } as any;
    }
  }

  async syncPrayerTimesForLocation(
    lat: number,
    lng: number,
    methodCode: string,
    school: number = 0,
    days: number = 1,
    force: boolean = false,
    latitudeAdjustmentMethod?: number,
    tune?: string,
    timezonestring?: string
  ) {
    try {
      // Find the method ID from the method code
      const method = await this.prisma.prayerCalculationMethod.findFirst({
        where: { methodCode },
        select: { id: true }
      });

      if (!method) {
        return {
          success: false,
          message: `Prayer calculation method '${methodCode}' not found`,
        };
      }

      // Calculate date range
      // Use UTC date to avoid timezone issues
      const now = new Date();
      const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + days - 1));

      this.logger.log(`Admin service: Calling syncPrayerTimesForMethod with dateRange: ${today.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]} (${days} days)`);
      this.logger.log(`Admin service: Method ID: ${method.id}, School: ${school}, Force: ${force}`);

      const result = await this.prayerSync.syncPrayerTimesForMethod(
        lat,
        lng,
        method.id,
        school,
        {
          force,
          resource: 'times',
          dateRange: { start: today, end: endDate },
          latitudeAdjustmentMethod,
          tune,
          timezonestring
        }
      );
      return {
        success: result.success,
        message: result.success ? "Prayer times sync completed" : "Prayer times sync failed",
        data: result,
      };
    } catch (error) {
      this.logger.error("Failed to sync prayer times for location", error.stack);
      return {
        success: false,
        message: `Prayer times sync failed: ${error.message}`,
      };
    }
  }

  async syncPrayerTimesCalendar(
    lat: number,
    lng: number,
    methodCode: string,
    school: number = 0,
    year: number,
    month: number,
    force: boolean = false,
    latitudeAdjustmentMethod?: number,
    tune?: string,
    timezonestring?: string
  ) {
    try {
      // Find the method ID from the method code
      const method = await this.prisma.prayerCalculationMethod.findFirst({
        where: { methodCode },
        select: { id: true }
      });

      if (!method) {
        return {
          success: false,
          message: `Prayer calculation method '${methodCode}' not found`,
        };
      }

      this.logger.log(`Admin service: Calling syncPrayerTimesCalendar for ${year}-${month} with method=${method.id}, school=${school}, force=${force}`);

      const result = await this.prayerSync.syncPrayerTimesCalendar(
        lat,
        lng,
        method.id,
        school,
        year,
        month,
        {
          force,
          resource: 'calendar',
          latitudeAdjustmentMethod,
          tune,
          timezonestring
        }
      );
      return {
        success: result.success,
        message: result.success ? `Prayer times calendar sync completed for ${year}-${month}` : "Prayer times calendar sync failed",
        data: result,
      };
    } catch (error) {
      this.logger.error("Failed to sync prayer times calendar", error.stack);
      return {
        success: false,
        message: `Prayer times calendar sync failed: ${error.message}`,
      };
    }
  }

  async syncPrayerTimesHijriCalendar(
    lat: number,
    lng: number,
    methodCode: string,
    school: number = 0,
    hijriYear: number,
    hijriMonth: number,
    force: boolean = false,
    latitudeAdjustmentMethod?: number,
    tune?: string,
    timezonestring?: string
  ) {
    try {
      // Find the method ID from the method code
      const method = await this.prisma.prayerCalculationMethod.findFirst({
        where: { methodCode },
        select: { id: true }
      });

      if (!method) {
        return {
          success: false,
          message: `Prayer calculation method '${methodCode}' not found`,
        };
      }

      this.logger.log(`Admin service: Calling syncPrayerTimesHijriCalendar for Hijri ${hijriYear}-${hijriMonth} with method=${method.id}, school=${school}, force=${force}`);

      const result = await this.prayerSync.syncPrayerTimesHijriCalendar(
        lat,
        lng,
        method.id,
        school,
        hijriYear,
        hijriMonth,
        {
          force,
          resource: 'hijri-calendar',
          latitudeAdjustmentMethod,
          tune,
          timezonestring
        }
      );
      return {
        success: result.success,
        message: result.success ? `Prayer times Hijri calendar sync completed for ${hijriYear}-${hijriMonth}` : "Prayer times Hijri calendar sync failed",
        data: result,
      };
    } catch (error) {
      this.logger.error("Failed to sync prayer times Hijri calendar", error.stack);
      return {
        success: false,
        message: `Prayer times Hijri calendar sync failed: ${error.message}`,
      };
    }
  }

  async convertGregorianToHijri(gregorianDate: string) {
    try {
      return await this.prayerSync.convertGregorianToHijri(gregorianDate);
    } catch (error) {
      this.logger.error("Failed to convert Gregorian to Hijri", error.stack);
      return null;
    }
  }

  async convertHijriToGregorian(hijriDate: string) {
    try {
      return await this.prayerSync.convertHijriToGregorian(hijriDate);
    } catch (error) {
      this.logger.error("Failed to convert Hijri to Gregorian", error.stack);
      return null;
    }
  }

  async getCurrentTime(timezone: string) {
    try {
      return await this.prayerSync.getCurrentTime(timezone);
    } catch (error) {
      this.logger.error("Failed to get current time", error.stack);
      return null;
    }
  }

  async getAsmaAlHusna() {
    try {
      return await this.prayerSync.getAsmaAlHusna();
    } catch (error) {
      this.logger.error("Failed to get Asma Al Husna", error.stack);
      return null;
    }
  }

  async triggerHadithSync(
    collectionName?: string,
  ): Promise<{ success: boolean; message: string; jobId?: string }> {
    try {
      // Create sync job
      const syncJob = {
        type: 'hadith' as const,
        action: 'sync' as const,
        data: collectionName ? { collectionName } : undefined,
        priority: 1, // High priority for manual sync
      };

      // Add job to queue
      const job = await this.workerService.addSyncJob(syncJob);
      
      this.logger.log(`Hadith sync job queued with ID: ${job.id}`);
      
      return {
        success: true,
        message: collectionName 
          ? `Hadith sync for ${collectionName} queued successfully`
          : "Hadith sync for all collections queued successfully",
        jobId: job.id?.toString(),
      };
    } catch (error) {
      this.logger.error("Failed to trigger Hadith sync", error.stack);
      return {
        success: false,
        message: `Hadith sync failed: ${error.message}`,
      };
    }
  }

  async triggerAudioSync(): Promise<{ success: boolean; message: string }> {
    try {
      await this.audioSync.syncReciters();
      await this.audioSync.syncAllAudioFiles();
      return { success: true, message: "Audio sync triggered successfully" };
    } catch (error) {
      this.logger.error("Failed to trigger Audio sync", error.stack);
      return { success: false, message: `Audio sync failed: ${error.message}` };
    }
  }

  async triggerGoldPriceUpdate(): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const result = await this.goldPriceService.fetchAndStore();
      return {
        success: true,
        message: `Gold price update triggered successfully. ${result.inserted} records inserted.`,
      };
    } catch (error) {
      this.logger.error("Failed to trigger Gold price update", error.stack);
      return {
        success: false,
        message: `Gold price update failed: ${error.message}`,
      };
    }
  }

  async triggerModuleSync(module: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      switch (module.toLowerCase()) {
        case 'quran':
          return await this.triggerQuranSync();
        case 'prayer':
        case 'prayer-times':
          return await this.triggerPrayerSync();
        case 'hadith':
          return await this.triggerHadithSync();
        case 'audio':
          return await this.triggerAudioSync();
        case 'finance':
        case 'gold-price':
          return await this.triggerGoldPriceUpdate();
        case 'zakat':
          return {
            success: true,
            message: "Zakat calculations are performed on-demand, no sync needed",
          };
        default:
          return {
            success: false,
            message: `Unknown module: ${module}`,
          };
      }
    } catch (error) {
      this.logger.error(`Failed to trigger sync for module ${module}`, error.stack);
      return {
        success: false,
        message: `Sync failed for ${module}: ${error.message}`,
      };
    }
  }

  async getSyncLogs(limit: number = 50): Promise<any[]> {
    return this.prisma.syncJobLog.findMany({
      take: limit,
      orderBy: { startedAt: "desc" },
    });
  }

  async getQueueStats(): Promise<any> {
    try {
      return await this.workerService.getQueueStats();
    } catch (error) {
      this.logger.error('Failed to get queue stats', error.stack);
      return { error: 'Failed to get queue stats' };
    }
  }

  async clearCache(): Promise<{ success: boolean; message: string }> {
    try {
      // Clear cache by invalidating common prefixes
      const prefixes = [
        "quran:",
        "prayer:",
        "hadith:",
        "audio:",
        "zakat:",
        "goldprice:",
      ];
      let totalCleared = 0;

      for (const prefix of prefixes) {
        totalCleared += await this.redis.invalidateByPrefix(prefix);
      }

      return {
        success: true,
        message: `Cache cleared successfully. ${totalCleared} keys removed.`,
      };
    } catch (error) {
      this.logger.error("Failed to clear cache", error.stack);
      return {
        success: false,
        message: `Cache clear failed: ${error.message}`,
      };
    }
  }

  async getPrayerMethods(): Promise<any[]> {
    const methods = await this.prisma.prayerCalculationMethod.findMany({
      select: {
        id: true,
        methodName: true,
        methodCode: true,
        description: true,
      },
      orderBy: { methodName: 'asc' },
    });
    return methods;
  }
}
