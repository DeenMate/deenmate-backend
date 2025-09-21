import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../database/prisma.service";
import { CommonHttpService } from "../../common/common.module";
import { QuranMapper } from "./quran.mapper";
import { generateSyncJobId } from "../../common/common.module";

export interface QuranSyncOptions {
  force?: boolean;
  dryRun?: boolean;
  resource?: "chapters" | "verses" | "translations" | "audio";
}

export interface QuranSyncResult {
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
export class QuranSyncService {
  private readonly logger = new Logger(QuranSyncService.name);
  private readonly baseUrl = "https://api.quran.com/api/v4";
  private readonly source = "quran.com";

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: CommonHttpService,
    private readonly mapper: QuranMapper,
    private readonly configService: ConfigService,
  ) {}

  async syncChapters(options: QuranSyncOptions = {}, isCancelled?: () => Promise<boolean>): Promise<QuranSyncResult> {
    const startTime = Date.now();
    const jobId = generateSyncJobId("quran-chapters", "chapters", new Date());

    this.logger.log(`Starting Quran chapters sync (Job: ${jobId})`);

    try {
      if (!options.force) {
        const lastSync = await this.getLastSyncTime("chapters");
        if (lastSync && this.shouldSkipSync(lastSync)) {
          this.logger.log("Skipping chapters sync - recent sync detected");
          return {
            success: true,
            resource: "chapters",
            recordsProcessed: 0,
            recordsInserted: 0,
            recordsUpdated: 0,
            recordsFailed: 0,
            errors: [],
            durationMs: Date.now() - startTime,
          };
        }
      }

      // Fetch chapters from upstream
      const responseBody = await this.httpService.get<any>(
        `${this.baseUrl}/chapters`,
      );
      const chapters = responseBody?.chapters || [];
      this.logger.log(`Fetched ${chapters.length} chapters from upstream`);

      // Fetch Bangla translations for chapter names
      const banglaTranslations = new Map<number, string>();
      try {
        for (const chapter of chapters) {
          try {
            const banglaResponse = await this.httpService.get<any>(
              `${this.baseUrl}/chapters/${chapter.id}?language=bn&translations=161,162,163`,
              { timeout: 5000 }
            );
            if (banglaResponse?.chapter?.translated_name?.name) {
              banglaTranslations.set(chapter.id, banglaResponse.chapter.translated_name.name);
            }
            // Small delay to be respectful to the API
            await this.delay(100);
          } catch (error) {
            this.logger.warn(`Failed to fetch Bangla translation for chapter ${chapter.id}: ${error.message}`);
          }
        }
        this.logger.log(`Fetched Bangla translations for ${banglaTranslations.size} chapters`);
      } catch (error) {
        this.logger.warn(`Failed to fetch Bangla chapter translations: ${error.message}`);
      }

      if (options.dryRun) {
        this.logger.log(`DRY RUN: Would process ${chapters.length} chapters`);
        return {
          success: true,
          resource: "chapters",
          recordsProcessed: chapters.length,
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

      for (const chapter of chapters) {
        try {
          const mappedChapter = this.mapper.mapChapterFromUpstream(chapter, banglaTranslations.get(chapter.id));

          const result = await (this.prisma as any).quranChapter.upsert({
            where: { chapterNumber: mappedChapter.chapterNumber },
            update: {
              ...mappedChapter,
              lastSynced: new Date(),
            },
            create: {
              ...mappedChapter,
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
          const errorMsg = `Failed to sync chapter ${chapter.id}: ${error.message}`;
          errors.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }

      await this.logSyncJob("quran-chapters", "chapters", {
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        status:
          failed === 0
            ? "success"
            : failed < chapters.length
              ? "partial"
              : "failed",
        error: errors.length > 0 ? errors.join("; ") : null,
        durationMs: Date.now() - startTime,
        recordsProcessed: chapters.length,
        recordsFailed: failed,
      });

      const result: QuranSyncResult = {
        success: failed === 0,
        resource: "chapters",
        recordsProcessed: chapters.length,
        recordsInserted: inserted,
        recordsUpdated: updated,
        recordsFailed: failed,
        errors,
        durationMs: Date.now() - startTime,
      };

      this.logger.log(
        `Quran chapters sync completed: ${JSON.stringify(result)}`,
      );
      return result;
    } catch (error) {
      const errorMsg = `Quran chapters sync failed: ${error.message}`;
      this.logger.error(errorMsg);

      await this.logSyncJob("quran-chapters", "chapters", {
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
        resource: "chapters",
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsFailed: 1,
        errors: [errorMsg],
        durationMs: Date.now() - startTime,
      };
    }
  }

  async syncVerses(options: QuranSyncOptions = {}, isCancelled?: () => Promise<boolean>): Promise<QuranSyncResult> {
    const startTime = Date.now();
    const jobId = generateSyncJobId("quran-verses", "verses", new Date());

    this.logger.log(`Starting Quran verses sync (Job: ${jobId})`);

    try {
      if (!options.force) {
        const lastSync = await this.getLastSyncTime("verses");
        if (lastSync && this.shouldSkipSync(lastSync)) {
          this.logger.log("Skipping verses sync - recent sync detected");
          return {
            success: true,
            resource: "verses",
            recordsProcessed: 0,
            recordsInserted: 0,
            recordsUpdated: 0,
            recordsFailed: 0,
            errors: [],
            durationMs: Date.now() - startTime,
          };
        }
      }

      const chapters = await (this.prisma as any).quranChapter.findMany({
        select: { chapterNumber: true },
        orderBy: { chapterNumber: "asc" },
      });

      let totalProcessed = 0;
      let totalInserted = 0;
      let totalUpdated = 0;
      let totalFailed = 0;
      const errors: string[] = [];

      for (const chapter of chapters) {
        // Check for cancellation before processing each chapter
        if (isCancelled && await isCancelled()) {
          this.logger.log(`Quran verses sync cancelled at chapter ${chapter.chapterNumber}`);
          throw new Error('Job cancelled by user');
        }

        try {
          const responseBody = await this.httpService.get<any>(
            `${this.baseUrl}/verses/by_chapter/${chapter.chapterNumber}?language=en&translations=20,22,19&page=1&per_page=286&words=false&fields=text_uthmani,text_simple,text_indopak,text_imlaei,translations,audio,verse_key,verse_number&translation_fields=text,resource_id,language_name`,
            { timeout: 15000 },
          );
          const verses = responseBody?.verses || [];
          this.logger.log(
            `Fetched ${verses.length} verses for chapter ${chapter.chapterNumber}`,
          );
          totalProcessed += verses.length;

          for (const verse of verses) {
            try {
              const mappedVerse = this.mapper.mapVerseFromUpstream(verse);

              // Build non-null update to avoid overwriting existing text with nulls
              const updateData: any = { lastSynced: new Date() };
              for (const key of [
                "chapterNumber",
                "verseNumber",
                "verseKey",
                "textUthmani",
                "textSimple",
                "textIndopak",
                "textImlaei",
                "pageNumber",
                "juzNumber",
                "hizbNumber",
                "rubNumber",
                "sajdaType",
                "source",
              ]) {
                const val = (mappedVerse as any)[key];
                if (val !== undefined && val !== null) updateData[key] = val;
              }

              const result = await (this.prisma as any).quranVerse.upsert({
                where: { verseKey: mappedVerse.verseKey },
                update: updateData,
                create: {
                  ...mappedVerse,
                  lastSynced: new Date(),
                },
              });

              if (result) {
                totalUpdated++;
              } else {
                totalInserted++;
              }
            } catch (verseError) {
              totalFailed++;
              const errorMsg = `Failed to sync verse ${verse.id}: ${verseError.message}`;
              errors.push(errorMsg);
              this.logger.error(errorMsg);
            }
          }

          await this.delay(100);
        } catch (chapterError) {
          const errorMsg = `Failed to fetch verses for chapter ${chapter.chapterNumber}: ${chapterError.message}`;
          errors.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }

      await this.logSyncJob("quran-verses", "verses", {
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

      const result: QuranSyncResult = {
        success: totalFailed === 0,
        resource: "verses",
        recordsProcessed: totalProcessed,
        recordsInserted: totalInserted,
        recordsUpdated: totalUpdated,
        recordsFailed: totalFailed,
        errors,
        durationMs: Date.now() - startTime,
      };

      this.logger.log(`Quran verses sync completed: ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      const errorMsg = `Quran verses sync failed: ${error.message}`;
      this.logger.error(errorMsg);

      await this.logSyncJob("quran-verses", "verses", {
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
        resource: "verses",
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsFailed: 1,
        errors: [errorMsg],
        durationMs: Date.now() - startTime,
      };
    }
  }

  async syncTranslationResources(
    options: QuranSyncOptions = {},
  ): Promise<QuranSyncResult> {
    const startTime = Date.now();
    const jobId = generateSyncJobId(
      "quran-translations",
      "translations",
      new Date(),
    );

    this.logger.log(
      `Starting Quran translation resources sync (Job: ${jobId})`,
    );

    try {
      if (!options.force) {
        const lastSync = await this.getLastSyncTime("translations");
        if (lastSync && this.shouldSkipSync(lastSync)) {
          this.logger.log(
            "Skipping translation resources sync - recent sync detected",
          );
          return {
            success: true,
            resource: "translations",
            recordsProcessed: 0,
            recordsInserted: 0,
            recordsUpdated: 0,
            recordsFailed: 0,
            errors: [],
            durationMs: Date.now() - startTime,
          };
        }
      }

      const responseBody = await this.httpService.get<any>(
        `${this.baseUrl}/resources/translations`,
        { timeout: 20000 },
      );
      let resources = responseBody?.translations || [];
      // Filter for English and Bangla resources for now
      resources = resources.filter((r: any) => {
        const lang = (r.language || r.language_name || "").toLowerCase();
        return (
          lang === "en" ||
          lang === "english" ||
          lang === "bn" ||
          lang === "bangla" ||
          lang === "bengali"
        );
      });
      this.logger.log(
        `Fetched ${resources.length} translation resources from upstream`,
      );

      if (options.dryRun) {
        this.logger.log(
          `DRY RUN: Would process ${resources.length} translation resources`,
        );
        return {
          success: true,
          resource: "translations",
          recordsProcessed: resources.length,
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

      for (const resource of resources) {
        try {
          const mappedResource =
            this.mapper.mapTranslationResourceFromUpstream(resource);

          const result = await (this.prisma as any).translationResource.upsert({
            where: { resourceId: mappedResource.resourceId },
            update: {
              ...mappedResource,
              lastSynced: new Date(),
            },
            create: {
              ...mappedResource,
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
          const errorMsg = `Failed to sync translation resource ${(resource && resource.id) || "unknown"}: ${error instanceof Error ? error.message : String(error)}`;
          errors.push(errorMsg);
          this.logger.error(errorMsg);
        }
      }

      await this.logSyncJob("quran-translations", "translations", {
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        status:
          failed === 0
            ? "success"
            : failed < resources.length
              ? "partial"
              : "failed",
        error: errors.length > 0 ? errors.join("; ") : null,
        durationMs: Date.now() - startTime,
        recordsProcessed: resources.length,
        recordsFailed: failed,
      });

      const result: QuranSyncResult = {
        success: failed === 0,
        resource: "translations",
        recordsProcessed: resources.length,
        recordsInserted: inserted,
        recordsUpdated: updated,
        recordsFailed: failed,
        errors,
        durationMs: Date.now() - startTime,
      };

      this.logger.log(
        `Quran translation resources sync completed: ${JSON.stringify(result)}`,
      );
      return result;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      const isUpstream5xx =
        /Server error \(5\d\d\)/.test(msg) || /status code 5\d\d/.test(msg);
      const errorMsg = `Quran translation resources sync failed: ${msg}`;
      if (isUpstream5xx) {
        this.logger.warn(
          `Upstream 5xx for translations; attempting env-based EN/BN backfill.`,
        );

        const idsRaw = process.env.QURAN_FALLBACK_TRANSLATION_IDS || "20,22,19";
        const langsRaw =
          process.env.QURAN_FALLBACK_TRANSLATION_LANGS || "en,bn";
        const ids = idsRaw
          .split(",")
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => !isNaN(n));
        const langs = langsRaw.split(",").map((s) => s.trim().toLowerCase());

        let processed = 0;
        let failedBackfill = 0;
        const backfillErrors: string[] = [];

        for (let i = 0; i < ids.length; i++) {
          const id = ids[i];
          const lang = langs[i] || (i === 0 ? "en" : "bn");
          try {
            await (this.prisma as any).translationResource.upsert({
              where: { resourceId: id },
              update: {
                resourceId: id,
                languageCode: lang,
                languageName: lang === "bn" ? "Bengali" : "English",
                name: `Fallback Translation ${id}`,
                authorName: "Unknown",
                direction: "ltr",
                isActive: true,
                lastSynced: new Date(),
              },
              create: {
                resourceId: id,
                languageCode: lang,
                languageName: lang === "bn" ? "Bengali" : "English",
                name: `Fallback Translation ${id}`,
                authorName: "Unknown",
                direction: "ltr",
                isActive: true,
                lastSynced: new Date(),
              },
            });
            processed++;
          } catch (e) {
            failedBackfill++;
            const em = `Failed backfill for resource ${id} (${lang}): ${e instanceof Error ? e.message : String(e)}`;
            backfillErrors.push(em);
            this.logger.error(em);
          }
        }

        await this.logSyncJob("quran-translations", "translations", {
          startedAt: new Date(startTime),
          finishedAt: new Date(),
          status: failedBackfill === 0 ? "partial" : "failed",
          error: backfillErrors.join("; "),
          durationMs: Date.now() - startTime,
          recordsProcessed: processed,
          recordsFailed: failedBackfill,
        });

        return {
          success: failedBackfill === 0,
          resource: "translations",
          recordsProcessed: processed,
          recordsInserted: processed,
          recordsUpdated: 0,
          recordsFailed: failedBackfill,
          errors: backfillErrors,
          durationMs: Date.now() - startTime,
        };
      }

      this.logger.error(errorMsg);
      await this.logSyncJob("quran-translations", "translations", {
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
        resource: "translations",
        recordsProcessed: 0,
        recordsInserted: 0,
        recordsUpdated: 0,
        recordsFailed: 1,
        errors: [errorMsg],
        durationMs: Date.now() - startTime,
      };
    }
  }

  private async getLastSyncTime(resource: string): Promise<Date | null> {
    const lastJob = await (this.prisma as any).syncJobLog.findFirst({
      where: {
        jobName: `quran-${resource}`,
        status: { in: ["success", "partial"] },
      },
      orderBy: { startedAt: "desc" },
    });

    return lastJob?.startedAt || null;
  }

  private shouldSkipSync(lastSync: Date): boolean {
    const hoursSinceLastSync =
      (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastSync < 24; // Skip if less than 24 hours
  }

  async syncVerseTranslations(
    options: QuranSyncOptions & { chapterNumbers?: number[] } = {},
    isCancelled?: () => Promise<boolean>
  ): Promise<QuranSyncResult> {
    const startTime = Date.now();
    const jobId = generateSyncJobId(
      "quran-verse-translations",
      "verse-translations",
      new Date(),
    );

    this.logger.log(
      `Starting Quran verse translations sync (Job: ${jobId})`,
    );

    try {
      if (!options.force) {
        const lastSync = await this.getLastSyncTime("verse-translations");
        if (lastSync && this.shouldSkipSync(lastSync)) {
          this.logger.log(
            "Skipping verse translations sync - recent sync detected",
          );
          return {
            success: true,
            resource: "verse-translations",
            recordsProcessed: 0,
            recordsInserted: 0,
            recordsUpdated: 0,
            recordsFailed: 0,
            errors: [],
            durationMs: Date.now() - startTime,
          };
        }
      }

      // Get translation resources
      const translationResources = await this.prisma.translationResource.findMany({
        where: {
          languageCode: {
            in: ['en', 'bn']
          }
        }
      });

      if (translationResources.length === 0) {
        this.logger.warn("No translation resources found. Run translation resources sync first.");
        return {
          success: true,
          resource: "verse-translations",
          recordsProcessed: 0,
          recordsInserted: 0,
          recordsUpdated: 0,
          recordsFailed: 0,
          errors: ["No translation resources found"],
          durationMs: Date.now() - startTime,
        };
      }

      let totalProcessed = 0;
      let totalInserted = 0;
      let totalUpdated = 0;
      let totalFailed = 0;
      const errors: string[] = [];

      // Get verses (all or specific chapters)
      const verses = await this.prisma.quranVerse.findMany({
        where: options.chapterNumbers ? {
          chapterNumber: { in: options.chapterNumbers }
        } : undefined,
        orderBy: { verseNumber: 'asc' }
      });

      this.logger.log(`Syncing translations for ${verses.length} verses with ${translationResources.length} translation resources`);

      // Process verses in batches (reduced batch size to avoid rate limiting)
      const batchSize = 5;
      for (let i = 0; i < verses.length; i += batchSize) {
        // Check for cancellation before processing each batch
        if (isCancelled) {
          try {
            const cancelled = await isCancelled();
            if (cancelled) {
              this.logger.log(`Quran verse translations sync cancelled at batch ${i}/${verses.length}`);
              throw new Error('Job cancelled by user');
            }
          } catch (error) {
            // Re-throw pause errors as-is
            if (error.message === 'Job paused by user') {
              this.logger.log(`Quran verse translations sync paused at batch ${i}/${verses.length}`);
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

        const batch = verses.slice(i, i + batchSize);
        
        for (const verse of batch) {
          // Check for cancellation before processing each verse
          if (isCancelled) {
            try {
              const cancelled = await isCancelled();
              if (cancelled) {
                this.logger.log(`Quran verse translations sync cancelled at verse ${verse.chapterNumber}:${verse.verseNumber}`);
                throw new Error('Job cancelled by user');
              }
            } catch (error) {
              // Re-throw pause errors as-is
              if (error.message === 'Job paused by user') {
                this.logger.log(`Quran verse translations sync paused at verse ${verse.chapterNumber}:${verse.verseNumber}`);
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
            // Add delay between API calls to avoid rate limiting
            if (i > 0) {
              await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second delay
            }
            
            // Get translations for this verse
            const responseBody = await this.httpService.get<any>(
              `${this.baseUrl}/verses/by_key/${verse.chapterNumber}:${verse.verseNumber}?language=en&words=false&fields=text_uthmani,text_simple,text_indopak,text_imlaei,translations,audio,verse_key,verse_number&translation_fields=text,resource_id,language_name&translations=${translationResources.map(r => r.resourceId).join(',')}`,
              { timeout: 30000 } // Increased timeout to 30 seconds
            );

            const translations = responseBody?.verse?.translations || [];
            
            for (const translation of translations) {
              try {
                const resourceId = translation.resource_id;
                const translationResource = translationResources.find(r => r.resourceId === resourceId);
                
                if (!translationResource) continue;

                // Upsert verse translation
                await this.prisma.verseTranslation.upsert({
                  where: {
                    verseId_resourceId: {
                      verseId: verse.id,
                      resourceId: resourceId
                    }
                  },
                  update: {
                    text: translation.text,
                    lastSynced: new Date()
                  },
                  create: {
                    verseId: verse.id,
                    resourceId: resourceId,
                    text: translation.text,
                    lastSynced: new Date()
                  }
                });

                totalProcessed++;
                totalUpdated++;
              } catch (error) {
                this.logger.error(`Failed to process translation for verse ${verse.chapterNumber}:${verse.verseNumber}: ${error.message}`);
                totalFailed++;
                errors.push(`Verse ${verse.chapterNumber}:${verse.verseNumber}: ${error.message}`);
              }
            }

            // Small delay to be respectful to the API
            await this.delay(100);
          } catch (error) {
            this.logger.error(`Failed to fetch translations for verse ${verse.chapterNumber}:${verse.verseNumber}: ${error.message}`);
            totalFailed++;
            errors.push(`Verse ${verse.chapterNumber}:${verse.verseNumber}: ${error.message}`);
          }
        }

        // Log progress
        if (i % 100 === 0) {
          this.logger.log(`Processed ${i}/${verses.length} verses`);
        }
      }

      await this.logSyncJob(jobId, "verse-translations", {
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        status: "completed",
        durationMs: Date.now() - startTime,
        recordsProcessed: totalProcessed,
        recordsFailed: totalFailed,
      });

      this.logger.log(
        `Quran verse translations sync completed: ${totalProcessed} processed, ${totalInserted} inserted, ${totalUpdated} updated, ${totalFailed} failed`,
      );

      return {
        success: true,
        resource: "verse-translations",
        recordsProcessed: totalProcessed,
        recordsInserted: totalInserted,
        recordsUpdated: totalUpdated,
        recordsFailed: totalFailed,
        errors: errors.slice(0, 10),
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Quran verse translations sync failed: ${error.message}`);
      await this.logSyncJob(jobId, "verse-translations", {
        startedAt: new Date(startTime),
        finishedAt: new Date(),
        status: "failed",
        error: error.message,
        durationMs: Date.now() - startTime,
        recordsProcessed: 0,
        recordsFailed: 1,
      });
      throw error;
    }
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
