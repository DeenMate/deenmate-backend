import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../database/prisma.service';
import { CommonHttpService } from '../common/common.module';
import { PrayerMapper, UpstreamCalculationMethod } from './prayer.mapper';
import { generateHash, generateSyncJobId } from '../common/common.module';

export interface PrayerSyncOptions {
  force?: boolean;
  dryRun?: boolean;
  resource?: 'methods' | 'locations' | 'times';
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
  private readonly baseUrl = 'https://api.aladhan.com/v1';
  private readonly source = 'aladhan';

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: CommonHttpService,
    private readonly mapper: PrayerMapper,
    private readonly configService: ConfigService,
  ) {}

  async syncCalculationMethods(options: PrayerSyncOptions = {}): Promise<PrayerSyncResult> {
    const startTime = Date.now();
    const jobId = generateSyncJobId('prayer-methods', 'methods', new Date());
    
    this.logger.log(`Starting prayer calculation methods sync (Job: ${jobId})`);
    
    try {
      if (!options.force) {
        const lastSync = await this.getLastSyncTime('methods');
        if (lastSync && this.shouldSkipSync(lastSync)) {
          this.logger.log('Skipping calculation methods sync - recent sync detected');
          return {
            success: true,
            resource: 'methods',
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
      const responseBody = await this.httpService.get<any>(`${this.baseUrl}/methods`);
      const methodsMap = (responseBody?.data || {}) as Record<string, UpstreamCalculationMethod>;
      let methods: UpstreamCalculationMethod[] = Object.values(methodsMap);
      // Tolerate malformed entries
      const originalCount = methods.length;
      methods = methods.filter((m: any) => m && (typeof m.id === 'number' || typeof m?.name === 'string'));
      if (methods.length !== originalCount) {
        this.logger.warn(`Skipped ${originalCount - methods.length} malformed calculation method entries`);
      }
      this.logger.log(`Fetched ${methods.length} prayer calculation methods from upstream`);

      if (options.dryRun) {
        this.logger.log(`DRY RUN: Would process ${methods.length} calculation methods`);
        return {
          success: true,
          resource: 'methods',
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
          const mappedMethod = this.mapper.mapCalculationMethodFromUpstream(method);
          
          const result = await this.prisma.prayerCalculationMethod.upsert({
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

      await this.logSyncJob('prayer-methods', 'methods', {
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        status: failed === 0 ? 'success' : failed < methods.length ? 'partial' : 'failed',
        error: errors.length > 0 ? errors.join('; ') : null,
        durationMs: Date.now() - startTime,
        recordsProcessed: methods.length,
        recordsFailed: failed,
      });

      const result: PrayerSyncResult = {
        success: failed === 0,
        resource: 'methods',
        recordsProcessed: methods.length,
        recordsInserted: inserted,
        recordsUpdated: updated,
        recordsFailed: failed,
        errors,
        durationMs: Date.now() - startTime,
      };

      this.logger.log(`Prayer calculation methods sync completed: ${JSON.stringify(result)}`);
      return result;

    } catch (error) {
      const errorMsg = `Prayer calculation methods sync failed: ${error.message}`;
      this.logger.error(errorMsg);
      
      await this.logSyncJob('prayer-methods', 'methods', {
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        status: 'failed',
        error: errorMsg,
        durationMs: Date.now() - startTime,
        recordsProcessed: 0,
        recordsFailed: 1,
      });

      return {
        success: false,
        resource: 'methods',
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
    options: PrayerSyncOptions = {}
  ): Promise<PrayerSyncResult> {
    const startTime = Date.now();
    const jobId = generateSyncJobId('prayer-times', 'times', new Date());
    
    this.logger.log(`Starting prayer times sync for ${latitude},${longitude} (Job: ${jobId})`);
    
    try {
      const locKey = generateHash(`${latitude.toFixed(3)},${longitude.toFixed(3)}`);
      
      if (!options.force) {
        const lastSync = await this.getLastSyncTimeForLocation('times', locKey);
        if (lastSync && this.shouldSkipSync(lastSync)) {
          this.logger.log('Skipping prayer times sync - recent sync detected');
          return {
            success: true,
            resource: 'times',
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

      const dateRange = options.dateRange || this.getDefaultDateRange();
      
      let totalProcessed = 0;
      let totalInserted = 0;
      let totalUpdated = 0;
      let totalFailed = 0;
      const errors: string[] = [];

      for (let d = new Date(dateRange.start); d <= dateRange.end; d.setDate(d.getDate() + 1)) {
        try {
          const date = new Date(d);
          const dateStr = date.toISOString().split('T')[0];
          
          const responseBody = await this.httpService.get<any>(
            `${this.baseUrl}/timings/${dateStr}?latitude=${latitude}&longitude=${longitude}&method=1`
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
                locKey
              );
              
              const result = await this.prisma.prayerTimes.upsert({
                where: {
                  locKey_date_method_school: {
                    locKey,
                    date: new Date(dateStr),
                    method: 1,
                    school: 0,
                  },
                },
                update: {
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
                create: {
                  locKey: mappedTimes.locKey,
                  date: mappedTimes.date,
                  method: mappedTimes.method,
                  school: mappedTimes.school,
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
          const errorMsg = `Failed to fetch prayer times for date ${d.toISOString().split('T')[0]}: ${dateError.message}`;
          errors.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }

      await this.logSyncJob('prayer-times', 'times', {
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        status: totalFailed === 0 ? 'success' : totalFailed < totalProcessed ? 'partial' : 'failed',
        error: errors.length > 0 ? errors.join('; ') : null,
        durationMs: Date.now() - startTime,
        recordsProcessed: totalProcessed,
        recordsFailed: totalFailed,
      });

      const result: PrayerSyncResult = {
        success: totalFailed === 0,
        resource: 'times',
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
      
      await this.logSyncJob('prayer-times', 'times', {
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        status: 'failed',
        error: errorMsg,
        durationMs: Date.now() - startTime,
        recordsProcessed: 0,
        recordsFailed: 1,
      });

      return {
        success: false,
        resource: 'times',
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsFailed: 1,
        errors: [errorMsg],
        durationMs: Date.now() - startTime,
      };
    }
  }

  private async ensureLocationExists(latitude: number, longitude: number): Promise<void> {
    const locKey = generateHash(`${latitude.toFixed(3)},${longitude.toFixed(3)}`);
    
    const existingLocation = await this.prisma.prayerLocation.findUnique({
      where: { locKey },
    });

    if (!existingLocation) {
      await this.prisma.prayerLocation.create({
        data: {
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
    const lastJob = await this.prisma.syncJobLog.findFirst({
      where: {
        jobName: `prayer-${resource}`,
        status: { in: ['success', 'partial'] },
      },
      orderBy: { startedAt: 'desc' },
    });

    return lastJob?.startedAt || null;
  }

  private async getLastSyncTimeForLocation(resource: string, locKey: string): Promise<Date | null> {
    const lastJob = await this.prisma.syncJobLog.findFirst({
      where: {
        jobName: `prayer-${resource}`,
        resource: locKey,
        status: { in: ['success', 'partial'] },
      },
      orderBy: { startedAt: 'desc' },
    });

    return lastJob?.startedAt || null;
  }

  private shouldSkipSync(lastSync: Date): boolean {
    const hoursSinceLastSync = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
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
    }
  ): Promise<void> {
    try {
      await this.prisma.syncJobLog.create({
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
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
