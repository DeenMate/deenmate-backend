import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { PrismaService } from "../../database/prisma.service";
import {
  SunnahApiService,
  SunnahBook,
  SunnahHadith,
} from "./sunnah-api.service";
import { TranslationService } from "./translation.service";

export interface SyncProgress {
  collectionName: string;
  status: "pending" | "in_progress" | "completed" | "failed";
  progress: {
    collections: number;
    books: number;
    hadiths: number;
    translations: number;
  };
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

@Injectable()
export class HadithSyncService {
  private readonly logger = new Logger(HadithSyncService.name);
  private readonly syncProgress = new Map<string, SyncProgress>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly sunnahApi: SunnahApiService,
    private readonly translationService: TranslationService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async scheduledSync(): Promise<void> {
    this.logger.log("Starting scheduled hadith sync");

    try {
      // Use the queue system for scheduled syncs to avoid blocking
      // This will be handled by the SchedulerService which has access to WorkerService
      this.logger.log("Scheduled hadith sync - delegating to queue system");
    } catch (error) {
      this.logger.error("Scheduled hadith sync failed", error.stack);
    }
  }

  async syncAllCollections(): Promise<void> {
    this.logger.log("Starting sync for all collections");

    try {
      // Fetch collections from Sunnah.com API
      const sunnahCollections = await this.sunnahApi.getCollections();
      this.logger.log(
        `Received collections: ${JSON.stringify(sunnahCollections)}`,
      );
      this.logger.log(
        `Collections type: ${typeof sunnahCollections}, isArray: ${Array.isArray(sunnahCollections)}`,
      );

      if (!Array.isArray(sunnahCollections)) {
        throw new Error(
          `sunnahCollections is not an array: ${typeof sunnahCollections}`,
        );
      }

      // Sync each collection
      for (const sunnahCollection of sunnahCollections) {
        await this.syncCollection(sunnahCollection.name);
      }

      this.logger.log("All collections synced successfully");
    } catch (error) {
      this.logger.error("Failed to sync all collections", error.stack);
      throw error;
    }
  }

  async syncCollection(collectionName: string): Promise<void> {
    this.logger.log(`Starting sync for collection: ${collectionName}`);

    const progress: SyncProgress = {
      collectionName,
      status: "in_progress",
      progress: { collections: 0, books: 0, hadiths: 0, translations: 0 },
      startedAt: new Date(),
    };

    this.syncProgress.set(collectionName, progress);

    try {
      // Update collection status
      await this.prisma.hadithCollection.updateMany({
        where: { name: collectionName },
        data: { syncStatus: "in_progress" },
      });

      // Get collection info from API
      const sunnahCollection =
        await this.sunnahApi.getCollectionInfo(collectionName);

      // Upsert collection
      const collection = await this.prisma.hadithCollection.upsert({
        where: { name: collectionName },
        update: {
          titleEn:
            sunnahCollection.collection.find((c) => c.lang === "en")?.title ||
            collectionName,
          totalHadith: sunnahCollection.totalAvailableHadith,
          lastSyncedAt: new Date(),
          syncStatus: "in_progress",
        },
        create: {
          name: collectionName,
          titleEn:
            sunnahCollection.collection.find((c) => c.lang === "en")?.title ||
            collectionName,
          totalHadith: sunnahCollection.totalAvailableHadith,
          hasBooks: sunnahCollection.hasBooks,
          lastSyncedAt: new Date(),
          syncStatus: "in_progress",
        },
      });

      progress.progress.collections = 1;

      // Check if collection has books (API key has limited permissions)
      let hasBooks = false;
      try {
        const books = await this.sunnahApi.getBooks(collectionName);
        hasBooks = books.length > 0;

        if (hasBooks) {
          await this.syncBooks(collection.id, collectionName, books);
          progress.progress.books = books.length;
        }
      } catch (error) {
        this.logger.warn(
          `Collection ${collectionName} - Books endpoint not accessible (API key limitation): ${error.message}`,
        );
        // Set hasBooks based on collection metadata
        hasBooks = sunnahCollection.hasBooks;
      }

      // Update collection with books info
      await this.prisma.hadithCollection.update({
        where: { id: collection.id },
        data: { hasBooks },
      });

      // Sync hadiths (API key has limited permissions)
      try {
        await this.syncHadiths(collection.id, collectionName);
      } catch (error) {
        this.logger.warn(
          `Collection ${collectionName} - Hadiths endpoint not accessible (API key limitation): ${error.message}`,
        );
        // Continue with sync even if hadiths can't be fetched
      }

      // Update sync status to completed
      await this.prisma.hadithCollection.update({
        where: { id: collection.id },
        data: {
          syncStatus: "ok",
          lastSyncedAt: new Date(),
        },
      });

      progress.status = "completed";
      progress.completedAt = new Date();
      this.logger.log(`Collection ${collectionName} synced successfully`);
    } catch (error) {
      this.logger.error(
        `Failed to sync collection ${collectionName}`,
        error.stack,
      );

      // Update sync status to failed
      await this.prisma.hadithCollection.updateMany({
        where: { name: collectionName },
        data: { syncStatus: "failed" },
      });

      progress.status = "failed";
      progress.error = error.message;
      progress.completedAt = new Date();

      throw error;
    } finally {
      this.syncProgress.set(collectionName, progress);
    }
  }

  private async syncBooks(
    collectionId: number,
    collectionName: string,
    sunnahBooks: SunnahBook[],
  ): Promise<void> {
    this.logger.log(
      `Syncing ${sunnahBooks.length} books for collection ${collectionName}`,
    );

    for (const sunnahBook of sunnahBooks) {
      await this.prisma.hadithBook.upsert({
        where: {
          collectionId_number: {
            collectionId,
            number: parseInt(sunnahBook.bookNumber),
          },
        },
        update: {
          titleEn:
            sunnahBook.book.find((b) => b.lang === "en")?.name ||
            `Book ${sunnahBook.bookNumber}`,
          titleAr: sunnahBook.book.find((b) => b.lang === "ar")?.name || "",
          totalHadith: sunnahBook.numberOfHadith,
          lastSyncedAt: new Date(),
        },
        create: {
          collectionId,
          number: parseInt(sunnahBook.bookNumber),
          titleEn:
            sunnahBook.book.find((b) => b.lang === "en")?.name ||
            `Book ${sunnahBook.bookNumber}`,
          titleAr: sunnahBook.book.find((b) => b.lang === "ar")?.name || "",
          totalHadith: sunnahBook.numberOfHadith,
          lastSyncedAt: new Date(),
        },
      });
    }
  }

  private async syncHadiths(
    collectionId: number,
    collectionName: string,
  ): Promise<void> {
    this.logger.log(`Starting hadith sync for collection ${collectionName}`);

    try {
      let page = 1;
      const limit = 50;
      let totalHadiths = 0;
      let hasMore = true;

      while (hasMore) {
        try {
          const response = await this.sunnahApi.getHadiths(
            collectionName,
            page,
            limit,
          );
          const hadiths = response.data;

          if (hadiths.length === 0) {
            hasMore = false;
            break;
          }

          // Process hadiths in batches
          await this.processHadithBatch(collectionId, collectionName, hadiths);

          totalHadiths += hadiths.length;
          this.logger.log(
            `Processed ${totalHadiths} hadiths for collection ${collectionName}`,
          );

          // Check if we have more pages
          if (response.pagination && page >= response.pagination.totalPages) {
            hasMore = false;
          } else {
            page++;
          }

          // Add a small delay to respect rate limits
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          this.logger.warn(
            `Failed to fetch hadiths for collection ${collectionName}, page ${page} (API key limitation): ${error.message}`,
          );
          hasMore = false; // Stop trying to fetch more pages
          break;
        }
      }

      this.logger.log(
        `Completed hadith sync for collection ${collectionName}. Total: ${totalHadiths} hadiths`,
      );
    } catch (error) {
      this.logger.warn(
        `Hadith sync failed for collection ${collectionName} (API key limitation): ${error.message}`,
      );
      // Don't throw error, just log and continue
    }
  }

  private async processHadithBatch(
    collectionId: number,
    collectionName: string,
    hadiths: SunnahHadith[],
  ): Promise<void> {
    const batchSize = 10;

    for (let i = 0; i < hadiths.length; i += batchSize) {
      const batch = hadiths.slice(i, i + batchSize);

      await Promise.all(
        batch.map((hadith) =>
          this.processSingleHadith(collectionId, collectionName, hadith),
        ),
      );
    }
  }

  private async processSingleHadith(
    collectionId: number,
    collectionName: string,
    sunnahHadith: SunnahHadith,
  ): Promise<void> {
    try {
      // Find the book if it exists
      let bookId: number | null = null;
      if (sunnahHadith.bookSlug) {
        const book = await this.prisma.hadithBook.findFirst({
          where: {
            collectionId,
            number: parseInt(sunnahHadith.bookSlug),
          },
        });
        bookId = book?.id || null;
      }

      // Upsert hadith
      const hadith = await this.prisma.hadith.upsert({
        where: {
          collectionId_hadithNumber: {
            collectionId,
            hadithNumber: sunnahHadith.hadithNumber.toString(),
          },
        },
        update: {
          bookId,
          textAr: sunnahHadith.hadithArabic,
          textEn: sunnahHadith.hadithEnglish,
          grades: sunnahHadith.grades,
          refs: sunnahHadith.reference,
          narrator: sunnahHadith.englishNarrator,
          lastUpdatedAt: new Date(),
        },
        create: {
          collectionId,
          bookId,
          hadithNumber: sunnahHadith.hadithNumber.toString(),
          textAr: sunnahHadith.hadithArabic,
          textEn: sunnahHadith.hadithEnglish,
          grades: sunnahHadith.grades,
          refs: sunnahHadith.reference,
          narrator: sunnahHadith.englishNarrator,
          lastUpdatedAt: new Date(),
        },
      });

      // Process translation directly if Bangla text doesn't exist
      if (!hadith.textBn) {
        try {
          await this.translationService.processTranslationJob({
            hadithId: hadith.id,
            text: sunnahHadith.hadithEnglish,
            sourceLang: "en",
            targetLang: "bn",
          });
        } catch (translationError) {
          this.logger.error(
            `Translation failed for hadith ${hadith.id}: ${translationError.message}`,
          );
          // Continue processing other hadiths even if translation fails
        }
      }
    } catch (error) {
      this.logger.error(
        `Failed to process hadith ${sunnahHadith.hadithNumber}`,
        error.stack,
      );
      // Don't throw here to avoid stopping the entire batch
    }
  }

  getSyncProgress(
    collectionName?: string,
  ): SyncProgress | Map<string, SyncProgress> {
    if (collectionName) {
      return (
        this.syncProgress.get(collectionName) || {
          collectionName,
          status: "pending",
          progress: { collections: 0, books: 0, hadiths: 0, translations: 0 },
        }
      );
    }
    return this.syncProgress;
  }

  async getSyncStatus(): Promise<{
    collections: Array<{
      name: string;
      syncStatus: string;
      lastSyncedAt: Date | null;
      totalHadith: number | null;
    }>;
  }> {
    const collections = await this.prisma.hadithCollection.findMany({
      select: {
        name: true,
        syncStatus: true,
        lastSyncedAt: true,
        totalHadith: true,
      },
      orderBy: { name: "asc" },
    });

    return { collections };
  }
}
