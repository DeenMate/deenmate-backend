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
  resource?: "methods" | "locations" | "times";
  location?: string; // Specific location to sync
  dateRange?: {
    start: Date;
    end: Date;
  };
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: CommonHttpService,
    private readonly mapper: PrayerMapper,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {}

  private async sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async savePrayerTimesWithRetry(
    mappedTimes: any,
    methodId?: number,
    maxRetries: number = 3,
  ) {
    const where = {
      locKey_date_method_school: {
        locKey: mappedTimes.locKey,
        date: mappedTimes.date,
        method: methodId ?? mappedTimes.method ?? 1,
        school: mappedTimes.school ?? 0,
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

  async syncPrayerTimes(
    latitude: number,
    longitude: number,
    options: PrayerSyncOptions = {},
  ): Promise<PrayerSyncResult> {
    const startTime = Date.now();
    const jobId = generateSyncJobId("prayer-times", "times", new Date());

    this.logger.log(
      `Starting prayer times sync for ${latitude},${longitude} (Job: ${jobId})`,
    );

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

      const dateRange = options.dateRange || this.getDefaultDateRange();

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
          const dateStr = date.toISOString().split("T")[0];
          
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

  private getDefaultDateRange(): { start: Date; end: Date } {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - 7);

    const end = new Date(today);
    end.setDate(today.getDate() + 7);

    return { start, end };
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
