import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../database/prisma.service";
import { CommonHttpService } from "../../common/common.module";
import { PrayerMapper, UpstreamCalculationMethod } from "./prayer.mapper";
import { generateHash, generateSyncJobId } from "../../common/common.module";
import { RedisService } from "../../redis/redis.service";

export interface PrayerSyncOptions {
  force?: boolean;
  dryRun?: boolean;
  resource?: "methods" | "locations" | "times" | "calendar" | "hijri-calendar";
  location?: string; // Specific location to sync
  dateRange?: {
    start: Date;
    end: Date;
  };
  // New Aladhan API parameters
  latitudeAdjustmentMethod?: number; // 0=None, 1=Middle, 2=OneSeventh, 3=AngleBased
  tune?: string; // Comma-separated minute offsets: "fajr,sunrise,dhuhr,asr,maghrib,isha"
  timezonestring?: string; // IANA timezone: "Asia/Dhaka", "America/New_York"
}

export interface PrayerSyncResult {
  success: boolean;
  resource: string;
  recordsProcessed: number;
  recordsInserted: number;
  recordsUpdated: number;
  recordsFailed: number;
  errors: string[];
  durationMs: number;
}

@Injectable()
export class PrayerSyncService {
  private readonly logger = new Logger(PrayerSyncService.name);
  private readonly baseUrl = "https://api.aladhan.com/v1";
  private readonly source = "aladhan";
  private readonly isSyncEnabled: boolean;

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: CommonHttpService,
    private readonly mapper: PrayerMapper,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.isSyncEnabled = this.configService.get("SYNC_ENABLED", "true") === "true";
  }

  private async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Convert Gregorian date to Hijri date using Aladhan API
   */
  async convertGregorianToHijri(gregorianDate: string): Promise<{ hijri: string; gregorian: string } | null> {
    try {
      const response = await this.httpService.get(`${this.baseUrl}/gToH/${gregorianDate}`);
      const data = response.data;
      
      if (data && data.data) {
        return {
          hijri: data.data.hijri.date,
          gregorian: data.data.gregorian.date,
        };
      }
      return null;
    } catch (error) {
      this.logger.error(`Failed to convert Gregorian to Hijri: ${error.message}`);
      return null;
    }
  }

  /**
   * Convert Hijri date to Gregorian date using Aladhan API
   */
  async convertHijriToGregorian(hijriDate: string): Promise<{ hijri: string; gregorian: string } | null> {
    try {
      const response = await this.httpService.get(`${this.baseUrl}/hToG/${hijriDate}`);
      const data = response.data;
      
      if (data && data.data) {
        return {
          hijri: data.data.hijri.date,
          gregorian: data.data.gregorian.date,
        };
      }
      return null;
    } catch (error) {
      this.logger.error(`Failed to convert Hijri to Gregorian: ${error.message}`);
      return null;
    }
  }

  /**
   * Get current time in specified timezone using Aladhan API
   */
  async getCurrentTime(timezone: string): Promise<{ time: string; timezone: string } | null> {
    try {
      const response = await this.httpService.get(`${this.baseUrl}/currentTime?zone=${encodeURIComponent(timezone)}`);
      const data = response.data;
      
      if (data && data.data) {
        return {
          time: data.data,
          timezone: timezone,
        };
      }
      return null;
    } catch (error) {
      this.logger.error(`Failed to get current time: ${error.message}`);
      return null;
    }
  }

  /**
   * Get Asma Al Husna (Names of Allah) from Aladhan API
   */
  async getAsmaAlHusna(): Promise<Array<{ number: number; name: string; transliteration: string; meaning: string }> | null> {
    try {
      const response = await this.httpService.get(`${this.baseUrl}/asmaAlHusna`);
      const data = response.data;
      
      if (data && data.data && Array.isArray(data.data)) {
        return data.data.map((item: any) => ({
          number: item.number,
          name: item.name,
          transliteration: item.transliteration,
          meaning: item.en?.meaning || item.meaning || '',
        }));
      }
      return null;
    } catch (error) {
      this.logger.error(`Failed to get Asma Al Husna: ${error.message}`);
      return null;
    }
  }

  private async savePrayerTimesWithRetry(
    mappedTimes: any,
    methodId?: number,
    maxRetries: number = 3,
  ) {
    const where = {
      locKey_date_method_school_latitudeAdjustmentMethod_tune: {
        locKey: mappedTimes.locKey,
        date: mappedTimes.date,
        method: methodId ?? mappedTimes.method ?? 1,
        school: mappedTimes.school ?? 0,
        latitudeAdjustmentMethod: mappedTimes.latitudeAdjustmentMethod || 0,
        tune: mappedTimes.tune || null,
      },
    } as const;

    // Try create first to avoid an extra read
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await (this.prisma as any).prayerTimes.create({
          data: {
            locKey: mappedTimes.locKey,
            date: mappedTimes.date,
            method: methodId ?? mappedTimes.method ?? 1,
            school: mappedTimes.school ?? 0,
            fajr: mappedTimes.fajr,
            sunrise: mappedTimes.sunrise,
            dhuhr: mappedTimes.dhuhr,
            asr: mappedTimes.asr,
            maghrib: mappedTimes.maghrib,
            isha: mappedTimes.isha,
            imsak: mappedTimes.imsak,
            midnight: mappedTimes.midnight,
            qiblaDirection: mappedTimes.qiblaDirection,
            source: mappedTimes.source,
            lastSynced: new Date(),
            rawResponse: mappedTimes.rawResponse,
          },
        });
      } catch (error: any) {
        // Prisma unique constraint error code
        const isUniqueConflict = error?.code === 'P2002';
        if (!isUniqueConflict && attempt >= maxRetries) throw error;
        if (!isUniqueConflict) throw error;

        // Another worker inserted first; perform update
        try {
          return await (this.prisma as any).prayerTimes.update({
            where,
            data: {
              fajr: mappedTimes.fajr,
              sunrise: mappedTimes.sunrise,
              dhuhr: mappedTimes.dhuhr,
              asr: mappedTimes.asr,
              maghrib: mappedTimes.maghrib,
              isha: mappedTimes.isha,
              imsak: mappedTimes.imsak,
              midnight: mappedTimes.midnight,
              qiblaDirection: mappedTimes.qiblaDirection,
              source: mappedTimes.source,
              lastSynced: new Date(),
              rawResponse: mappedTimes.rawResponse,
            },
          });
        } catch (updateErr: any) {
          // If update failed because record not found (race), retry
          if (attempt < maxRetries) {
            await this.sleep(100 * (attempt + 1));
            continue;
          }
          throw updateErr;
        }
      }
    }
  }

  async syncCalculationMethods(
    options: PrayerSyncOptions = {},
  ): Promise<PrayerSyncResult> {
    const startTime = Date.now();
    const jobId = generateSyncJobId("prayer-methods", "methods", new Date());

    this.logger.log(`Starting prayer calculation methods sync (Job: ${jobId})`);

    if (!this.isSyncEnabled) {
      this.logger.log("Prayer calculation methods sync is disabled");
      return {
        success: true,
        resource: "methods",
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsFailed: 0,
        errors: [],
        durationMs: Date.now() - startTime,
      };
    }

    try {
      if (!options.force) {
        const lastSync = await this.getLastSyncTime("methods");
        if (lastSync && this.shouldSkipSync(lastSync)) {
          this.logger.log(
            "Skipping calculation methods sync - recent sync detected",
          );
          return {
            success: true,
            resource: "methods",
            recordsProcessed: 0,
            recordsInserted: 0,
            recordsUpdated: 0,
            recordsFailed: 0,
            errors: [],
            durationMs: Date.now() - startTime,
          };
        }
      }

      // Fetch calculation methods from upstream
      const responseBody = await this.httpService.get<any>(
        `${this.baseUrl}/methods`,
      );
      const methodsMap = (responseBody?.data || {}) as Record<
        string,
        UpstreamCalculationMethod
      >;
      let methods: UpstreamCalculationMethod[] = Object.values(methodsMap);
      // Tolerate malformed entries
      const originalCount = methods.length;
      methods = methods.filter(
        (m: any) =>
          m && (typeof m.id === "number" || typeof m?.name === "string"),
      );
      if (methods.length !== originalCount) {
        this.logger.warn(
          `Skipped ${originalCount - methods.length} malformed calculation method entries`,
        );
      }
      this.logger.log(
        `Fetched ${methods.length} prayer calculation methods from upstream`,
      );

      if (options.dryRun) {
        this.logger.log(
          `DRY RUN: Would process ${methods.length} calculation methods`,
        );
        return {
          success: true,
          resource: "methods",
          recordsProcessed: methods.length,
          recordsInserted: 0,
          recordsUpdated: 0,
          recordsFailed: 0,
          errors: [],
          durationMs: Date.now() - startTime,
        };
      }

      let inserted = 0;
      let updated = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const method of methods) {
        try {
          const mappedMethod =
            this.mapper.mapCalculationMethodFromUpstream(method);

          const result = await (
            this.prisma as any
          ).prayerCalculationMethod.upsert({
            where: { methodCode: mappedMethod.methodCode },
            update: {
              ...mappedMethod,
              lastSynced: new Date(),
            },
            create: {
              ...mappedMethod,
              lastSynced: new Date(),
            },
          });

          if (result) {
            updated++;
          } else {
            inserted++;
          }
        } catch (error) {
          failed++;
          const errorMsg = `Failed to sync calculation method: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }

      await this.logSyncJob("prayer-methods", "methods", {
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        status:
          failed === 0
            ? "success"
            : failed < methods.length
              ? "partial"
              : "failed",
        error: errors.length > 0 ? errors.join("; ") : null,
        durationMs: Date.now() - startTime,
        recordsProcessed: methods.length,
        recordsFailed: failed,
      });

      const result: PrayerSyncResult = {
        success: failed === 0,
        resource: "methods",
        recordsProcessed: methods.length,
        recordsInserted: inserted,
        recordsUpdated: updated,
        recordsFailed: failed,
        errors,
        durationMs: Date.now() - startTime,
      };

      this.logger.log(
        `Prayer calculation methods sync completed: ${JSON.stringify(result)}`,
      );
      return result;
    } catch (error) {
      const errorMsg = `Prayer calculation methods sync failed: ${error.message}`;
      this.logger.error(errorMsg);

      await this.logSyncJob("prayer-methods", "methods", {
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        status: "failed",
        error: errorMsg,
        durationMs: Date.now() - startTime,
        recordsProcessed: 0,
        recordsFailed: 1,
      });

      return {
        success: false,
        resource: "methods",
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsFailed: 1,
        errors: [errorMsg],
        durationMs: Date.now() - startTime,
      };
    }
  }

  async syncPrayerTimesForMethod(
    latitude: number,
    longitude: number,
    methodId: number,
    school: number,
    options: PrayerSyncOptions = {},
    isCancelled?: () => Promise<boolean>,
    jobId?: string,
  ): Promise<PrayerSyncResult> {
    const startTime = Date.now();
    const internalJobId = jobId || generateSyncJobId("prayer-times", "times", new Date());

    this.logger.log(
      `[syncPrayerTimesForMethod] Starting prayer times sync for ${latitude},${longitude} method=${methodId} school=${school} (Job: ${internalJobId})`,
    );
    this.logger.log(`[syncPrayerTimesForMethod] Options: ${JSON.stringify(options)}`);

    try {
      const locKey = generateHash(
        `${latitude.toFixed(3)},${longitude.toFixed(3)}`,
      );

      if (!options.force) {
        const lastSync = await this.getLastSyncTimeForLocation("times", locKey);
        if (lastSync && this.shouldSkipSync(lastSync)) {
          this.logger.log("Skipping prayer times sync - recent sync detected");
          return {
            success: true,
            resource: "times",
            recordsProcessed: 0,
            recordsInserted: 0,
            recordsUpdated: 0,
            recordsFailed: 0,
            errors: [],
            durationMs: Date.now() - startTime,
          };
        }
      }

      await this.ensureLocationExists(latitude, longitude);

      const dateRange = options.dateRange || this.getDefaultDateRange(1);
      this.logger.log(`syncPrayerTimes: Date range: ${dateRange.start.toISOString().split('T')[0]} to ${dateRange.end.toISOString().split('T')[0]} (${options.dateRange ? 'custom' : 'default'})`);
      this.logger.log(`Date range: ${dateRange.start.toISOString().split('T')[0]} to ${dateRange.end.toISOString().split('T')[0]} (${options.dateRange ? 'custom' : 'default'})`);
      
      // If custom dateRange is provided, use it instead of default
      if (options.dateRange) {
        this.logger.log(`Using custom date range: ${options.dateRange.start.toISOString().split('T')[0]} to ${options.dateRange.end.toISOString().split('T')[0]}`);
      }

      let totalProcessed = 0;
      let totalInserted = 0;
      let totalUpdated = 0;
      let totalFailed = 0;
      const errors: string[] = [];

      for (let d = new Date(dateRange.start); d <= dateRange.end; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
        // Check for cancellation before processing each date
        if (isCancelled) {
          try {
            const cancelled = await isCancelled();
            if (cancelled) {
              this.logger.log(`Prayer times sync cancelled at date ${d.toISOString().split('T')[0]}`);
              throw new Error('Job cancelled by user');
            }
          } catch (error) {
            // Re-throw pause errors as-is
            if (error.message === 'Job paused by user') {
              this.logger.log(`Prayer times sync paused at date ${d.toISOString().split('T')[0]}`);
              throw error;
            }
            // Re-throw cancellation errors as-is
            if (error.message === 'Job cancelled by user') {
              throw error;
            }
            // For other errors, log and continue
            this.logger.warn(`Error checking cancellation status: ${error.message}`);
          }
        }

        try {
          // Format date as DD-MM-YYYY for Aladhan API
          const dateStr = `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
          // Format date as YYYY-MM-DD for mapper
          const dateStrForMapper = d.toISOString().split('T')[0];
          // Map our methodId to Aladhan method code or use custom angles
          let methodParam = String(methodId);
          let extraParams = '';
          try {
            const methodRecord = await (this.prisma as any).prayerCalculationMethod.findUnique({
              where: { id: methodId },
              select: { methodCode: true, fajrAngle: true, ishaAngle: true, ishaInterval: true },
            });
            const code: string = methodRecord?.methodCode || '';
            const aladhanMap: Record<string, number> = {
              JAFARI: 0,
              KARACHI: 1,
              ISNA: 2,
              MWL: 3,
              MAKKAH: 4,
              EGYPT: 5,
              TEHRAN: 7,
              KUWAIT: 9,
              QATAR: 10,
              SINGAPORE: 11,
              FRANCE: 12,
              TURKEY: 13,
              RUSSIA: 14,
              MOON_SIGHTING: 15,
            };
            if (code && aladhanMap[code] !== undefined) {
              methodParam = String(aladhanMap[code]);
              // Special case: Umm Al-Qura uses fixed 120 for Isha
              if (code === 'MAKKAH' && methodRecord?.ishaInterval) {
                methodParam = '4';
                extraParams = '';
              }
            } else {
              // Custom: 99 with explicit angles if provided
              methodParam = '99';
              const fajr = methodRecord?.fajrAngle != null ? `&fajr=${methodRecord.fajrAngle}` : '';
              const isha = methodRecord?.ishaAngle != null ? `&isha=${methodRecord.ishaAngle}` : '';
              extraParams = `${fajr}${isha}`;
            }
          } catch {}

          // Build URL with all Aladhan API parameters
          let url = `${this.baseUrl}/timings/${dateStr}?latitude=${latitude}&longitude=${longitude}&method=${methodParam}&school=${school}${extraParams}`;
          
          // Add latitudeAdjustmentMethod if provided
          if (options.latitudeAdjustmentMethod !== undefined) {
            url += `&latitudeAdjustmentMethod=${options.latitudeAdjustmentMethod}`;
          }
          
          // Add tune parameter if provided
          if (options.tune) {
            url += `&tune=${encodeURIComponent(options.tune)}`;
          }
          
          // Add timezone string if provided
          if (options.timezonestring) {
            url += `&timezonestring=${encodeURIComponent(options.timezonestring)}`;
          }

          const response = await this.httpService.get(url);
          const upstreamData = response.data;

          // Check if response has the expected structure
          // Aladhan API returns timings directly at root level, not under data
          if (!upstreamData || !upstreamData.timings) {
            this.logger.error(`Response structure issue:`, {
              hasUpstreamData: !!upstreamData,
              hasTimings: !!(upstreamData && upstreamData.timings),
              responseKeys: upstreamData ? Object.keys(upstreamData) : 'no upstreamData'
            });
            throw new Error(`Upstream API error: ${upstreamData?.status || 'missing timings'}`);
          }

          const mappedData = this.mapper.mapPrayerTimesFromUpstream(
            upstreamData.timings,
            upstreamData.date,
            latitude,
            longitude,
            locKey,
            dateStrForMapper,
            methodId,
            school,
            options.latitudeAdjustmentMethod,
            options.tune,
            options.timezonestring,
            "Standard" // Default midnight mode
          );
          
          const result = await this.upsertPrayerTimesRecord(mappedData);
          totalProcessed += 1;
          totalInserted += result.inserted;
          totalUpdated += result.updated;
          totalFailed += result.failed;

          await this.sleep(100); // Rate limiting
        } catch (error) {
          totalFailed++;
          errors.push(`Date ${d.toISOString().split('T')[0]}: ${error.message}`);
          this.logger.error(`Failed to sync prayer times for ${d.toISOString().split('T')[0]}:`, error);
        }
      }

      await this.logSyncJob(internalJobId, "times", {
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        status: "success",
        durationMs: Date.now() - startTime,
        recordsProcessed: totalProcessed,
        recordsFailed: totalFailed,
      });

      return {
        success: totalFailed === 0,
        resource: "times",
        recordsProcessed: totalProcessed,
        recordsInserted: totalInserted,
        recordsUpdated: totalUpdated,
        recordsFailed: totalFailed,
        errors,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Prayer times sync failed: ${error.message}`, error.stack);
      
      await this.logSyncJob(internalJobId, "times", {
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        status: "failed",
        error: error.message,
        durationMs: Date.now() - startTime,
        recordsProcessed: 0,
        recordsFailed: 1,
      });

      return {
        success: false,
        resource: "times",
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsFailed: 1,
        errors: [error.message],
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Sync prayer times using Aladhan calendar endpoint for bulk efficiency
   * This method uses the /calendar/{year}/{month} endpoint for better performance
   */
  async syncPrayerTimesCalendar(
    latitude: number,
    longitude: number,
    methodId: number,
    school: number,
    year: number,
    month: number,
    options: PrayerSyncOptions = {},
  ): Promise<PrayerSyncResult> {
    const startTime = Date.now();
    const jobId = generateSyncJobId("prayer-times", "calendar", new Date());

    this.logger.log(
      `[syncPrayerTimesCalendar] Starting calendar sync for ${latitude},${longitude} method=${methodId} school=${school} year=${year} month=${month} (Job: ${jobId})`,
    );

    try {
      const locKey = generateHash(
        `${latitude.toFixed(3)},${longitude.toFixed(3)}`,
      );

      if (!options.force) {
        const lastSync = await this.getLastSyncTimeForLocation("times", locKey);
        if (lastSync && this.shouldSkipSync(lastSync)) {
          this.logger.log("Skipping calendar sync - recent sync detected");
          return {
            success: true,
            resource: "calendar",
            recordsProcessed: 0,
            recordsInserted: 0,
            recordsUpdated: 0,
            recordsFailed: 0,
            errors: [],
            durationMs: Date.now() - startTime,
          };
        }
      }

      await this.ensureLocationExists(latitude, longitude);

      // Map our methodId to Aladhan method code
      let methodParam = String(methodId);
      let extraParams = '';
      try {
        const methodRecord = await (this.prisma as any).prayerCalculationMethod.findUnique({
          where: { id: methodId },
          select: { methodCode: true, fajrAngle: true, ishaAngle: true, ishaInterval: true },
        });
        const code: string = methodRecord?.methodCode || '';
        const aladhanMap: Record<string, number> = {
          JAFARI: 0,
          KARACHI: 1,
          ISNA: 2,
          MWL: 3,
          MAKKAH: 4,
          EGYPT: 5,
          TEHRAN: 7,
          KUWAIT: 9,
          QATAR: 10,
          SINGAPORE: 11,
          FRANCE: 12,
          TURKEY: 13,
          RUSSIA: 14,
          MOON_SIGHTING: 15,
        };
        if (code && aladhanMap[code] !== undefined) {
          methodParam = String(aladhanMap[code]);
          if (code === 'MAKKAH' && methodRecord?.ishaInterval) {
            methodParam = '4';
            extraParams = '';
          }
        } else {
          methodParam = '99';
          const fajr = methodRecord?.fajrAngle != null ? `&fajr=${methodRecord.fajrAngle}` : '';
          const isha = methodRecord?.ishaAngle != null ? `&isha=${methodRecord.ishaAngle}` : '';
          extraParams = `${fajr}${isha}`;
        }
      } catch {}

      // Build URL with all Aladhan API parameters
      let url = `${this.baseUrl}/calendar/${year}/${month}?latitude=${latitude}&longitude=${longitude}&method=${methodParam}&school=${school}${extraParams}`;
      
      // Add latitudeAdjustmentMethod if provided
      if (options.latitudeAdjustmentMethod !== undefined) {
        url += `&latitudeAdjustmentMethod=${options.latitudeAdjustmentMethod}`;
      }
      
      // Add tune parameter if provided
      if (options.tune) {
        url += `&tune=${encodeURIComponent(options.tune)}`;
      }
      
      // Add timezone string if provided
      if (options.timezonestring) {
        url += `&timezonestring=${encodeURIComponent(options.timezonestring)}`;
      }

      this.logger.log(`Calendar sync URL: ${url}`);

      const response = await this.httpService.get(url);
      const upstreamData = response.data;

      this.logger.log(`Calendar API response status: ${upstreamData?.code || 'unknown'}`);
      this.logger.log(`Calendar API response has data: ${!!upstreamData?.data}`);
      this.logger.log(`Calendar API data is array: ${Array.isArray(upstreamData?.data)}`);
      this.logger.log(`Calendar API data length: ${upstreamData?.data?.length || 0}`);

      // Check if response has the expected structure
      if (!upstreamData || !upstreamData.data || !Array.isArray(upstreamData.data)) {
        this.logger.error(`Calendar API response structure:`, JSON.stringify(upstreamData, null, 2));
        throw new Error(`Upstream API error: ${upstreamData?.status || 'missing calendar data'}`);
      }

      let totalProcessed = 0;
      let totalInserted = 0;
      let totalUpdated = 0;
      let totalFailed = 0;
      const errors: string[] = [];

      // Process each day in the calendar response
      for (const dayData of upstreamData.data) {
        try {
          if (!dayData.timings) {
            continue; // Skip days without timings
          }

          const dateStr = dayData.date?.gregorian?.date;
          if (!dateStr) {
            continue; // Skip days without date
          }

          // Parse date from DD-MM-YYYY format
          const [dd, mm, yyyy] = dateStr.split('-');
          const date = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);

          const mappedData = this.mapper.mapPrayerTimesFromUpstream(
            dayData.timings,
            dayData.date,
            latitude,
            longitude,
            locKey,
            dateStr,
            methodId,
            school,
            options.latitudeAdjustmentMethod,
            options.tune,
            options.timezonestring,
            "Standard" // Default midnight mode
          );
          
          const result = await this.upsertPrayerTimesRecord(mappedData);
          totalProcessed += 1;
          totalInserted += result.inserted;
          totalUpdated += result.updated;
          totalFailed += result.failed;

          await this.sleep(50); // Rate limiting
        } catch (error) {
          totalFailed++;
          errors.push(`Day ${dayData.date?.gregorian?.date || 'unknown'}: ${error.message}`);
          this.logger.error(`Failed to process day: ${error.message}`);
        }
      }

      await this.logSyncJob(jobId, "calendar", {
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        status: "completed",
        durationMs: Date.now() - startTime,
        recordsProcessed: totalProcessed,
        recordsFailed: totalFailed,
      });

      this.logger.log(
        `Calendar sync completed: ${totalProcessed} days processed, ${totalInserted} inserted, ${totalUpdated} updated, ${totalFailed} failed`,
      );

      return {
        success: totalFailed === 0,
        resource: "calendar",
        recordsProcessed: totalProcessed,
        recordsInserted: totalInserted,
        recordsUpdated: totalUpdated,
        recordsFailed: totalFailed,
        errors,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Calendar sync failed: ${error.message}`, error.stack);
      
      await this.logSyncJob(jobId, "calendar", {
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        status: "failed",
        error: error.message,
        durationMs: Date.now() - startTime,
        recordsProcessed: 0,
        recordsFailed: 1,
      });

      return {
        success: false,
        resource: "calendar",
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsFailed: 1,
        errors: [error.message],
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Sync prayer times using Hijri calendar endpoint
   * This method uses the /hijriCalendar/{year}/{month} endpoint
   */
  async syncPrayerTimesHijriCalendar(
    latitude: number,
    longitude: number,
    methodId: number,
    school: number,
    hijriYear: number,
    hijriMonth: number,
    options: PrayerSyncOptions = {},
  ): Promise<PrayerSyncResult> {
    const startTime = Date.now();
    const jobId = generateSyncJobId("prayer-times", "hijri-calendar", new Date());

    this.logger.log(
      `[syncPrayerTimesHijriCalendar] Starting Hijri calendar sync for ${latitude},${longitude} method=${methodId} school=${school} hijriYear=${hijriYear} hijriMonth=${hijriMonth} (Job: ${jobId})`,
    );

    try {
      const locKey = generateHash(
        `${latitude.toFixed(3)},${longitude.toFixed(3)}`,
      );

      if (!options.force) {
        const lastSync = await this.getLastSyncTimeForLocation("times", locKey);
        if (lastSync && this.shouldSkipSync(lastSync)) {
          this.logger.log("Skipping Hijri calendar sync - recent sync detected");
          return {
            success: true,
            resource: "hijri-calendar",
            recordsProcessed: 0,
            recordsInserted: 0,
            recordsUpdated: 0,
            recordsFailed: 0,
            errors: [],
            durationMs: Date.now() - startTime,
          };
        }
      }

      await this.ensureLocationExists(latitude, longitude);

      // Map our methodId to Aladhan method code
      let methodParam = String(methodId);
      let extraParams = '';
      try {
        const methodRecord = await (this.prisma as any).prayerCalculationMethod.findUnique({
          where: { id: methodId },
          select: { methodCode: true, fajrAngle: true, ishaAngle: true, ishaInterval: true },
        });
        const code: string = methodRecord?.methodCode || '';
        const aladhanMap: Record<string, number> = {
          JAFARI: 0,
          KARACHI: 1,
          ISNA: 2,
          MWL: 3,
          MAKKAH: 4,
          EGYPT: 5,
          TEHRAN: 7,
          KUWAIT: 9,
          QATAR: 10,
          SINGAPORE: 11,
          FRANCE: 12,
          TURKEY: 13,
          RUSSIA: 14,
          MOON_SIGHTING: 15,
        };
        if (code && aladhanMap[code] !== undefined) {
          methodParam = String(aladhanMap[code]);
          if (code === 'MAKKAH' && methodRecord?.ishaInterval) {
            methodParam = '4';
            extraParams = '';
          }
        } else {
          methodParam = '99';
          const fajr = methodRecord?.fajrAngle != null ? `&fajr=${methodRecord.fajrAngle}` : '';
          const isha = methodRecord?.ishaAngle != null ? `&isha=${methodRecord.ishaAngle}` : '';
          extraParams = `${fajr}${isha}`;
        }
      } catch {}

      // Build URL with all Aladhan API parameters
      let url = `${this.baseUrl}/hijriCalendar/${hijriYear}/${hijriMonth}?latitude=${latitude}&longitude=${longitude}&method=${methodParam}&school=${school}${extraParams}`;
      
      // Add latitudeAdjustmentMethod if provided
      if (options.latitudeAdjustmentMethod !== undefined) {
        url += `&latitudeAdjustmentMethod=${options.latitudeAdjustmentMethod}`;
      }
      
      // Add tune parameter if provided
      if (options.tune) {
        url += `&tune=${encodeURIComponent(options.tune)}`;
      }
      
      // Add timezone string if provided
      if (options.timezonestring) {
        url += `&timezonestring=${encodeURIComponent(options.timezonestring)}`;
      }

      this.logger.log(`Hijri calendar sync URL: ${url}`);

      const response = await this.httpService.get(url);
      const upstreamData = response.data;

      this.logger.log(`Hijri calendar API response status: ${upstreamData?.code || 'unknown'}`);
      this.logger.log(`Hijri calendar API response has data: ${!!upstreamData?.data}`);
      this.logger.log(`Hijri calendar API data is array: ${Array.isArray(upstreamData?.data)}`);
      this.logger.log(`Hijri calendar API data length: ${upstreamData?.data?.length || 0}`);

      // Check if response has the expected structure
      if (!upstreamData || !upstreamData.data || !Array.isArray(upstreamData.data)) {
        this.logger.error(`Hijri calendar API response structure:`, JSON.stringify(upstreamData, null, 2));
        throw new Error(`Upstream API error: ${upstreamData?.status || 'missing hijri calendar data'}`);
      }

      let totalProcessed = 0;
      let totalInserted = 0;
      let totalUpdated = 0;
      let totalFailed = 0;
      const errors: string[] = [];

      // Process each day in the Hijri calendar response
      for (const dayData of upstreamData.data) {
        try {
          if (!dayData.timings) {
            continue; // Skip days without timings
          }

          const dateStr = dayData.date?.gregorian?.date;
          if (!dateStr) {
            continue; // Skip days without date
          }

          // Parse date from DD-MM-YYYY format
          const [dd, mm, yyyy] = dateStr.split('-');
          const date = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);

          const mappedData = this.mapper.mapPrayerTimesFromUpstream(
            dayData.timings,
            dayData.date,
            latitude,
            longitude,
            locKey,
            dateStr,
            methodId,
            school,
            options.latitudeAdjustmentMethod,
            options.tune,
            options.timezonestring,
            "Standard" // Default midnight mode
          );
          
          const result = await this.upsertPrayerTimesRecord(mappedData);
          totalProcessed += 1;
          totalInserted += result.inserted;
          totalUpdated += result.updated;
          totalFailed += result.failed;

          await this.sleep(50); // Rate limiting
        } catch (error) {
          totalFailed++;
          errors.push(`Day ${dayData.date?.gregorian?.date || 'unknown'}: ${error.message}`);
          this.logger.error(`Failed to process Hijri day: ${error.message}`);
        }
      }

      await this.logSyncJob(jobId, "hijri-calendar", {
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        status: "completed",
        durationMs: Date.now() - startTime,
        recordsProcessed: totalProcessed,
        recordsFailed: totalFailed,
      });

      this.logger.log(
        `Hijri calendar sync completed: ${totalProcessed} days processed, ${totalInserted} inserted, ${totalUpdated} updated, ${totalFailed} failed`,
      );

      return {
        success: totalFailed === 0,
        resource: "hijri-calendar",
        recordsProcessed: totalProcessed,
        recordsInserted: totalInserted,
        recordsUpdated: totalUpdated,
        recordsFailed: totalFailed,
        errors,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Hijri calendar sync failed: ${error.message}`, error.stack);
      
      await this.logSyncJob(jobId, "hijri-calendar", {
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        status: "failed",
        error: error.message,
        durationMs: Date.now() - startTime,
        recordsProcessed: 0,
        recordsFailed: 1,
      });

      return {
        success: false,
        resource: "hijri-calendar",
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsFailed: 1,
        errors: [error.message],
        durationMs: Date.now() - startTime,
      };
    }
  }

  async syncPrayerTimes(
    latitude: number,
    longitude: number,
    options: PrayerSyncOptions = {},
    jobId?: string,
  ): Promise<PrayerSyncResult> {
    const startTime = Date.now();
    const internalJobId = jobId || generateSyncJobId("prayer-times", "times", new Date());

    this.logger.log(
      `[syncPrayerTimes] Starting prayer times sync for ${latitude},${longitude} (Job: ${internalJobId})`,
    );
    this.logger.log(`[syncPrayerTimes] Options: ${JSON.stringify(options)}`);

    if (!this.isSyncEnabled) {
      this.logger.log("Prayer times sync is disabled");
      return {
        success: true,
        resource: "times",
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsFailed: 0,
        errors: [],
        durationMs: Date.now() - startTime,
      };
    }

    try {
      const locKey = generateHash(
        `${latitude.toFixed(3)},${longitude.toFixed(3)}`,
      );

      if (!options.force) {
        const lastSync = await this.getLastSyncTimeForLocation("times", locKey);
        if (lastSync && this.shouldSkipSync(lastSync)) {
          this.logger.log("Skipping prayer times sync - recent sync detected");
          return {
            success: true,
            resource: "times",
            recordsProcessed: 0,
            recordsInserted: 0,
            recordsUpdated: 0,
            recordsFailed: 0,
            errors: [],
            durationMs: Date.now() - startTime,
          };
        }
      }

      await this.ensureLocationExists(latitude, longitude);

      // Resolve method to a valid FK (default to MWL for method=1)
      let methodId: number | null = null;
      try {
        const mwl = await (
          this.prisma as any
        ).prayerCalculationMethod.findUnique({ where: { methodCode: "MWL" } });
        if (!mwl) {
          // Ensure methods are present
          await this.syncCalculationMethods({ force: true });
        }
        const resolved = await (
          this.prisma as any
        ).prayerCalculationMethod.findUnique({ where: { methodCode: "MWL" } });
        methodId = resolved ? resolved.id : null;
      } catch (e) {
        this.logger.warn(
          `Unable to resolve prayer method ID (MWL): ${e instanceof Error ? e.message : e}`,
        );
      }

      const dateRange = options.dateRange || this.getDefaultDateRange(1);
      this.logger.log(`syncPrayerTimes: Date range: ${dateRange.start.toISOString().split('T')[0]} to ${dateRange.end.toISOString().split('T')[0]} (${options.dateRange ? 'custom' : 'default'})`);

      let totalProcessed = 0;
      let totalInserted = 0;
      let totalUpdated = 0;
      let totalFailed = 0;
      const errors: string[] = [];

      for (
        let d = new Date(dateRange.start);
        d <= dateRange.end;
        d.setDate(d.getDate() + 1)
      ) {
        try {
          const date = new Date(d);
          // Format date as DD-MM-YYYY for Aladhan API
          const dateStr = `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;
          
          console.log(`Prayer sync: Requesting date ${dateStr} for ${latitude},${longitude}`);

          const responseBody = await this.httpService.get<any>(
            `${this.baseUrl}/timings/${dateStr}?latitude=${latitude}&longitude=${longitude}&method=1`,
          );
          const timings = responseBody?.data?.timings;
          const dateInfo = responseBody?.data?.date;

          if (timings) {
            totalProcessed++;

            try {
              const mappedTimes = this.mapper.mapPrayerTimesFromUpstream(
                timings,
                dateInfo,
                latitude,
                longitude,
                locKey,
                dateStr, // Pass the requested date
              );

              const result = await this.savePrayerTimesWithRetry(mappedTimes, methodId);

              // Pre-warm Redis cache with Aladhan-compatible shape
              try {
                const cacheKey = `prayer:timings:${latitude}:${longitude}:${dateStr}:${1}:${0}:${1}:${0}:${"auto"}:${0}:${false}`;
                const aladhanLike = {
                  code: 200,
                  status: "OK",
                  data: {
                    timings: {
                      Fajr: timings.Fajr,
                      Sunrise: timings.Sunrise,
                      Dhuhr: timings.Dhuhr,
                      Asr: timings.Asr,
                      Sunset: timings.Maghrib,
                      Maghrib: timings.Maghrib,
                      Isha: timings.Isha,
                      Imsak: timings.Imsak || timings.Fajr,
                      Midnight: timings.Midnight || "",
                      Firstthird: timings.Firstthird || "",
                      Lastthird: timings.Lastthird || "",
                    },
                    date: {
                      readable: dateStr,
                      timestamp: Math.floor(
                        new Date(dateStr).getTime() / 1000,
                      ).toString(),
                      gregorian: {
                        date: "",
                        format: "",
                        day: "",
                        weekday: { en: "", ar: "" },
                        month: { number: 0, en: "", ar: "" },
                        year: "",
                      },
                      hijri: {
                        date: "",
                        format: "",
                        day: "",
                        weekday: { en: "", ar: "" },
                        month: { number: 0, en: "", ar: "" },
                        year: "",
                      },
                    },
                    meta: {
                      latitude,
                      longitude,
                      timezone: "auto",
                      method: {
                        id: 1,
                        name: "",
                        params: { Fajr: 0, Isha: 0 },
                        location: { latitude: 0, longitude: 0 },
                      },
                      latitudeAdjustmentMethod: "1",
                      midnightMode: "0",
                      school: "0",
                      offset: {},
                    },
                  },
                };
                await this.redisService.set(
                  cacheKey,
                  JSON.stringify(aladhanLike),
                  86400,
                );
              } catch (cacheErr) {
                this.logger.warn(
                  `Failed to cache prayer timings for ${latitude},${longitude} ${dateStr}: ${cacheErr instanceof Error ? cacheErr.message : cacheErr}`,
                );
              }

              if (result) {
                totalUpdated++;
              } else {
                totalInserted++;
              }
            } catch (timeError) {
              totalFailed++;
              const errorMsg = `Failed to sync prayer times for ${dateStr}: ${timeError.message}`;
              errors.push(errorMsg);
              this.logger.error(errorMsg);
            }
          }

          await this.delay(100);
        } catch (dateError) {
          const errorMsg = `Failed to fetch prayer times for date ${d.toISOString().split("T")[0]}: ${dateError.message}`;
          errors.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }

      await this.logSyncJob("prayer-times", "times", {
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        status:
          totalFailed === 0
            ? "success"
            : totalFailed < totalProcessed
              ? "partial"
              : "failed",
        error: errors.length > 0 ? errors.join("; ") : null,
        durationMs: Date.now() - startTime,
        recordsProcessed: totalProcessed,
        recordsFailed: totalFailed,
      });

      const result: PrayerSyncResult = {
        success: totalFailed === 0,
        resource: "times",
        recordsProcessed: totalProcessed,
        recordsInserted: totalInserted,
        recordsUpdated: totalUpdated,
        recordsFailed: totalFailed,
        errors,
        durationMs: Date.now() - startTime,
      };

      this.logger.log(`Prayer times sync completed: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      const errorMsg = `Prayer times sync failed: ${error.message}`;
      this.logger.error(errorMsg);

      await this.logSyncJob("prayer-times", "times", {
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        status: "failed",
        error: errorMsg,
        durationMs: Date.now() - startTime,
        recordsProcessed: 0,
        recordsFailed: 1,
      });

      return {
        success: false,
        resource: "times",
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsFailed: 1,
        errors: [errorMsg],
        durationMs: Date.now() - startTime,
      };
    }
  }

  async prewarmAllLocations(days: number = 7, jobId?: string, isCancelled?: () => Promise<boolean>): Promise<PrayerSyncResult> {
    const startTime = Date.now();
    
    if (!this.isSyncEnabled) {
      this.logger.log("Prayer prewarm is disabled");
      return {
        success: true,
        resource: "prewarm",
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsFailed: 0,
        errors: [],
        durationMs: Date.now() - startTime,
      };
    }
    
    // Use UTC date to avoid timezone issues
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + Math.max(0, days - 1)));

    const locations = await (this.prisma as any).prayerLocation.findMany({
      select: { lat: true, lng: true, city: true, country: true },
      orderBy: { id: 'asc' },
    });

    // Get all calculation methods
    const methods = await (this.prisma as any).prayerCalculationMethod.findMany({
      select: { id: true, methodCode: true },
      orderBy: { methodName: 'asc' },
    });

    let processed = 0;
    let inserted = 0;
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    this.logger.log(`Prewarming ${locations.length} locations for ${days} days with ${methods.length} methods and 2 school types`);

    for (const loc of locations) {
      // Check for cancellation before processing each location
      if (isCancelled) {
        try {
          const cancelled = await isCancelled();
          if (cancelled) {
            this.logger.log(`Prayer prewarm cancelled at location ${loc.city || loc.country}`);
            throw new Error('Job cancelled by user');
          }
        } catch (error) {
          if (error.message === 'Job paused by user') {
            this.logger.log(`Prayer prewarm paused at location ${loc.city || loc.country}`);
            throw error;
          }
          if (error.message === 'Job cancelled by user') {
            throw error;
          }
          this.logger.warn(`Error checking cancellation status: ${error.message}`);
        }
      }

      for (const method of methods) {
        // Sync for both school types: 0=Shafi, 1=Hanafi
        for (const school of [0, 1]) {
          try {
            // Try city-based sync first if city/country available
            let res: PrayerSyncResult;
            if (loc.city && loc.country) {
              res = await this.syncPrayerTimesForMethodByCity(loc.city, loc.country, method.id, school, {
                force: true,
                resource: 'times',
                dateRange: { start: today, end },
              }, isCancelled, jobId);
            } else {
              // Fallback to lat/lng
              res = await this.syncPrayerTimesForMethod(loc.lat, loc.lng, method.id, school, {
                force: true,
                resource: 'times',
                dateRange: { start: today, end },
              }, isCancelled, jobId);
            }
            processed += res.recordsProcessed;
            inserted += res.recordsInserted;
            updated += res.recordsUpdated;
            failed += res.recordsFailed;
          } catch (e) {
            // Handle pause vs cancellation differently
            if (e.message === 'Job paused by user') {
              this.logger.log(`Prayer prewarm paused at ${loc.city || loc.country} with ${method.methodCode}/school${school}`);
              throw e; // Re-throw to be handled by the main process method
            } else if (e.message === 'Job cancelled by user') {
              this.logger.log(`Prayer prewarm cancelled at ${loc.city || loc.country} with ${method.methodCode}/school${school}`);
              return {
                success: false,
                resource: 'prewarm',
                recordsProcessed: processed,
                recordsInserted: inserted,
                recordsUpdated: updated,
                recordsFailed: failed,
                errors: ['Job cancelled by user'],
                durationMs: Date.now() - startTime,
              };
            } else {
              failed++;
              errors.push(`${method.methodCode}/school${school}: ${e instanceof Error ? e.message : String(e)}`);
            }
          }
          // small delay to be nice to upstream
          await this.sleep(50);
        }
      }
    }

    return {
      success: errors.length === 0,
      resource: 'times',
      recordsProcessed: processed,
      recordsInserted: inserted,
      recordsUpdated: updated,
      recordsFailed: failed,
      errors,
      durationMs: Date.now() - startTime,
    };
  }

  async syncPrayerTimesForMethodByCity(
    city: string,
    country: string,
    methodId: number,
    school: number,
    options: PrayerSyncOptions = {},
    isCancelled?: () => Promise<boolean>,
    jobId?: string,
  ): Promise<PrayerSyncResult> {
    const startTime = Date.now();
    const internalJobId = jobId || generateSyncJobId("prayer-times", "times", new Date());

    this.logger.log(
      `Starting prayer times sync for ${city}, ${country} method=${methodId} school=${school} (Job: ${internalJobId})`,
    );

    try {
      // Get location coordinates for locKey generation
      const location = await (this.prisma as any).prayerLocation.findFirst({
        where: { city, country },
        select: { lat: true, lng: true },
      });

      if (!location) {
        throw new Error(`Location not found for ${city}, ${country}`);
      }

      const locKey = generateHash(
        `${location.lat.toFixed(3)},${location.lng.toFixed(3)}`,
      );

      const dateRange = options.dateRange || this.getDefaultDateRange(1);
      this.logger.log(`syncPrayerTimes: Date range: ${dateRange.start.toISOString().split('T')[0]} to ${dateRange.end.toISOString().split('T')[0]} (${options.dateRange ? 'custom' : 'default'})`);

      let totalProcessed = 0;
      let totalInserted = 0;
      let totalUpdated = 0;
      let totalFailed = 0;
      const errors: string[] = [];

      for (let d = new Date(dateRange.start); d <= dateRange.end; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
        // Check for cancellation before processing each date
        if (isCancelled) {
          try {
            const cancelled = await isCancelled();
            if (cancelled) {
              this.logger.log(`Prayer times sync cancelled at date ${d.toISOString().split('T')[0]}`);
              throw new Error('Job cancelled by user');
            }
          } catch (error) {
            // Re-throw pause errors as-is
            if (error.message === 'Job paused by user') {
              this.logger.log(`Prayer times sync paused at date ${d.toISOString().split('T')[0]}`);
              throw error;
            }
            // Re-throw cancellation errors as-is
            if (error.message === 'Job cancelled by user') {
              throw error;
            }
            // For other errors, log and continue
            this.logger.warn(`Error checking cancellation status: ${error.message}`);
          }
        }

        try {
          // Format date as DD-MM-YYYY for Aladhan API
          const dateStr = `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
          
          // Map our methodId to Aladhan method code
          let methodParam = String(methodId);
          let extraParams = '';
          try {
            const methodRecord = await (this.prisma as any).prayerCalculationMethod.findUnique({
              where: { id: methodId },
              select: { methodCode: true, fajrAngle: true, ishaAngle: true, ishaInterval: true },
            });
            const code: string = methodRecord?.methodCode || '';
            const aladhanMap: Record<string, number> = {
              JAFARI: 0,
              KARACHI: 1,
              ISNA: 2,
              MWL: 3,
              MAKKAH: 4,
              EGYPT: 5,
              TEHRAN: 7,
              KUWAIT: 9,
              QATAR: 10,
              SINGAPORE: 11,
              FRANCE: 12,
              TURKEY: 13,
              RUSSIA: 14,
              MOON_SIGHTING: 15,
            };
            if (code && aladhanMap[code] !== undefined) {
              methodParam = String(aladhanMap[code]);
              if (code === 'MAKKAH' && methodRecord?.ishaInterval) {
                methodParam = '4';
                extraParams = '';
              }
            } else {
              methodParam = '99';
              const fajr = methodRecord?.fajrAngle != null ? `&fajr=${methodRecord.fajrAngle}` : '';
              const isha = methodRecord?.ishaAngle != null ? `&isha=${methodRecord.ishaAngle}` : '';
              extraParams = `${fajr}${isha}`;
            }
          } catch {}

          // Add state parameter for US/Canada cities
          let stateParam = '';
          if (country === 'United States' || country === 'USA') {
            const stateMap: Record<string, string> = {
              'New York': 'NY',
              'Los Angeles': 'CA',
              'Chicago': 'IL',
              'Detroit': 'MI',
              'Houston': 'TX',
            };
            if (stateMap[city]) {
              stateParam = `&state=${stateMap[city]}`;
            }
          } else if (country === 'Canada') {
            const provinceMap: Record<string, string> = {
              'Toronto': 'ON',
              'Montreal': 'QC',
            };
            if (provinceMap[city]) {
              stateParam = `&state=${provinceMap[city]}`;
            }
          }

          const url = `${this.baseUrl}/timingsByCity/${dateStr}?city=${encodeURIComponent(city)}&country=${encodeURIComponent(country)}${stateParam}&method=${methodParam}&school=${school}${extraParams}`;

          const response = await this.httpService.get(url);
          let upstreamData = response.data;

          // If city endpoint didn't return timings, fallback to lat/lng for that date
          if (!(upstreamData && upstreamData.timings)) {
            const fallbackUrl = `${this.baseUrl}/timings/${dateStr}?latitude=${location.lat}&longitude=${location.lng}&method=${methodParam}&school=${school}${extraParams}`;
            const fbResp = await this.httpService.get(fallbackUrl);
            upstreamData = fbResp.data;
          }

          if (!(upstreamData && upstreamData.timings)) {
            throw new Error(`Upstream API error: ${upstreamData?.status || 'missing timings'}`);
          }

          const mappedData = this.mapper.mapPrayerTimesFromUpstream(
            upstreamData.timings,
            upstreamData.date,
            location.lat,
            location.lng,
            locKey,
            dateStr,
            methodId
          );
          
          const result = await this.upsertPrayerTimesRecord(mappedData);
          totalProcessed += 1;
          totalInserted += result.inserted;
          totalUpdated += result.updated;
          totalFailed += result.failed;

          await this.sleep(100); // Rate limiting
        } catch (error) {
          totalFailed++;
          errors.push(`Date ${d.toISOString().split('T')[0]}: ${error.message}`);
          this.logger.error(`Failed to sync prayer times for ${d.toISOString().split('T')[0]}:`, error);
        }
      }

      await this.logSyncJob(internalJobId, "times", {
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        status: "success",
        durationMs: Date.now() - startTime,
        recordsProcessed: totalProcessed,
        recordsFailed: totalFailed,
      });

      return {
        success: totalFailed === 0,
        resource: "times",
        recordsProcessed: totalProcessed,
        recordsInserted: totalInserted,
        recordsUpdated: totalUpdated,
        recordsFailed: totalFailed,
        errors,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMsg = `Prayer times sync failed for ${city}, ${country}: ${error.message}`;
      this.logger.error(errorMsg);

      await this.logSyncJob(internalJobId, "times", {
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        status: "failed",
        error: errorMsg,
        durationMs: Date.now() - startTime,
        recordsProcessed: 0,
        recordsFailed: 1,
      });

      return {
        success: false,
        resource: "times",
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsFailed: 1,
        errors: [errorMsg],
        durationMs: Date.now() - startTime,
      };
    }
  }

  private async upsertPrayerTimesRecord(mappedData: any): Promise<{ inserted: number; updated: number; failed: number }> {
    try {
      // Use the new unique constraint that includes latitudeAdjustmentMethod and tune
      const whereClause = {
        locKey: mappedData.locKey,
        date: mappedData.date,
        method: mappedData.method,
        school: mappedData.school,
        latitudeAdjustmentMethod: mappedData.latitudeAdjustmentMethod || 0,
        tune: mappedData.tune || null,
      };

      const existing = await (this.prisma as any).prayerTimes.findFirst({
        where: whereClause,
      });

      if (existing) {
        await (this.prisma as any).prayerTimes.updateMany({
          where: whereClause,
          data: {
            fajr: mappedData.fajr,
            sunrise: mappedData.sunrise,
            dhuhr: mappedData.dhuhr,
            asr: mappedData.asr,
            maghrib: mappedData.maghrib,
            isha: mappedData.isha,
            imsak: mappedData.imsak,
            midnight: mappedData.midnight,
            qiblaDirection: mappedData.qiblaDirection,
            source: mappedData.source,
            rawResponse: mappedData.rawResponse,
            lastSynced: new Date(),
            timezone: mappedData.timezone,
            midnightMode: mappedData.midnightMode,
          },
        });
        return { inserted: 0, updated: 1, failed: 0 };
      } else {
        await (this.prisma as any).prayerTimes.create({
          data: mappedData,
        });
        return { inserted: 1, updated: 0, failed: 0 };
      }
    } catch (error) {
      this.logger.error(`Failed to upsert prayer times record: ${error.message}`);
      return { inserted: 0, updated: 0, failed: 1 };
    }
  }

  private async ensureLocationExists(
    latitude: number,
    longitude: number,
  ): Promise<void> {
    const locKey = generateHash(
      `${latitude.toFixed(3)},${longitude.toFixed(3)}`,
    );

    // Use upsert to avoid race conditions/unique violations on locKey
    await (this.prisma as any).prayerLocation.upsert({
      where: { locKey },
      update: { lastSynced: new Date() },
      create: {
        locKey,
        lat: latitude,
        lng: longitude,
        city: null,
        country: null,
        timezone: null,
        elevation: 0,
        source: this.source,
        lastSynced: new Date(),
      },
    });
  }

  private getDefaultDateRange(days: number = 1): { start: Date; end: Date } {
    const validatedDays = this.validateDateRange(days);
    // Use UTC date to avoid timezone issues
    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + validatedDays - 1));
    
    this.logger.debug(`getDefaultDateRange: today=${today.toISOString()}, start=${start.toISOString()}, end=${end.toISOString()}`);
    
    return { start, end };
  }

  private validateDateRange(days: number): number {
    if (days <= 0 || days > 365) {
      throw new Error(`Invalid days parameter: ${days}. Must be between 1 and 365.`);
    }
    return days;
  }

  private async getLastSyncTime(resource: string): Promise<Date | null> {
    const lastJob = await (this.prisma as any).syncJobLog.findFirst({
      where: {
        jobName: `prayer-${resource}`,
        status: { in: ["success", "partial"] },
      },
      orderBy: { startedAt: "desc" },
    });

    return lastJob?.startedAt || null;
  }

  private async getLastSyncTimeForLocation(
    resource: string,
    locKey: string,
  ): Promise<Date | null> {
    const lastJob = await (this.prisma as any).syncJobLog.findFirst({
      where: {
        jobName: `prayer-${resource}`,
        resource: locKey,
        status: { in: ["success", "partial"] },
      },
      orderBy: { startedAt: "desc" },
    });

    return lastJob?.startedAt || null;
  }

  private shouldSkipSync(lastSync: Date): boolean {
    const hoursSinceLastSync =
      (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastSync < 24;
  }

  private async logSyncJob(
    jobName: string,
    resource: string,
    data: {
      startedAt: Date;
      finishedAt: Date;
      status: string;
      error?: string | null;
      durationMs: number;
      recordsProcessed: number;
      recordsFailed: number;
    },
  ): Promise<void> {
    try {
      await (this.prisma as any).syncJobLog.create({
        data: {
          jobName,
          resource,
          ...data,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log sync job: ${error.message}`);
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
