import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';
import { SunnahApiService } from '../modules/hadith/sunnah-api.service';
import { TranslationService } from '../modules/hadith/translation.service';
import { QuranSyncService } from '../modules/quran/quran.sync.service';
import { PrayerSyncService } from '../modules/prayer/prayer.sync.service';
import { PrayerPrerequisitesService } from '../modules/prayer/prayer-prerequisites.service';
import { AudioSyncService } from '../modules/audio/audio.sync.service';
import { GoldPriceScheduler } from '../modules/finance/goldprice.scheduler';
import { JobControlService } from '../modules/admin/job-control/job-control.service';
import { SyncJob } from './worker.service';

@Processor('sync-queue')
export class SyncJobsProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncJobsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly configService: ConfigService,
    private readonly sunnahApi: SunnahApiService,
    private readonly translationService: TranslationService,
    private readonly quranSyncService: QuranSyncService,
    private readonly prayerSyncService: PrayerSyncService,
    private readonly prayerPrerequisitesService: PrayerPrerequisitesService,
    private readonly audioSyncService: AudioSyncService,
    private readonly goldPriceScheduler: GoldPriceScheduler,
    private readonly jobControlService: JobControlService,
  ) {
    super();
  }

  async process(job: Job<SyncJob>): Promise<any> {
    const { type, action, data } = job.data;
    
    this.logger.log(`Processing ${type}:${action} job (ID: ${job.id})`);

    // Create job control entry
    const jobId = job.id?.toString() || `unknown-${Date.now()}`;
    const jobName = this.getJobName(type, action);
    
    try {
      // Check for cancellation before starting
      if (await this.isJobCancelled(jobId)) {
        this.logger.log(`Job ${jobId} was cancelled before processing`);
        throw new Error('Job cancelled by user');
      }

      // Create job control entry
      await this.jobControlService.createOrUpdateJobControl(
        jobId,
        type,
        jobName,
        'running',
        { startedBy: 'bullmq', timestamp: new Date().toISOString() }
      );

      let result: any;
      switch (type) {
        case 'hadith':
          result = await this.processHadithJob(job);
          break;
        case 'quran':
          result = await this.processQuranJob(job);
          break;
        case 'prayer':
          result = await this.processPrayerJob(job);
          break;
        case 'audio':
          result = await this.processAudioJob(job);
          break;
        case 'zakat':
          result = await this.processZakatJob(job);
          break;
        case 'finance':
          result = await this.processFinanceJob(job);
          break;
        default:
          throw new Error(`Unknown job type: ${type}`);
      }

      // Mark job as completed
      await this.jobControlService.createOrUpdateJobControl(
        jobId,
        type,
        jobName,
        'completed',
        { 
          completedAt: new Date().toISOString(),
          result
        }
      );

      return result;
    } catch (error) {
      // Handle pause vs cancellation differently
      if (error.message === 'Job paused by user') {
        // Mark job as paused
        await this.jobControlService.createOrUpdateJobControl(
          jobId,
          type,
          jobName,
          'paused',
          { 
            error: error.message,
            pausedAt: new Date().toISOString()
          }
        );
        this.logger.log(`Job ${job.id} paused: ${type}:${action}`);
        throw error;
      } else {
        this.logger.error(`Job ${job.id} failed:`, error);
        
        // Mark job as failed
        await this.jobControlService.createOrUpdateJobControl(
          jobId,
          type,
          jobName,
          'failed',
          { 
            error: error.message,
            failedAt: new Date().toISOString()
          }
        );
        
        throw error;
      }
    }
  }

  private getJobName(type: string, action: string): string {
    const typeNames = {
      'quran': 'Quran Data Sync',
      'prayer': 'Prayer Times Sync',
      'hadith': 'Hadith Data Sync',
      'audio': 'Audio Data Sync',
      'zakat': 'Zakat Data Sync',
      'finance': 'Gold Price Update',
    };
    
    return typeNames[type] || `${type} ${action}`;
  }

  private async processHadithJob(job: Job<SyncJob>): Promise<any> {
    const { action, data } = job.data;
    
    switch (action) {
      case 'sync':
        if (data?.collectionName) {
          return await this.syncHadithCollectionFromLocal(job, data.collectionName);
        } else {
          return await this.syncAllHadithCollections(job);
        }
      case 'update':
        return await this.updateHadithCollection(job, data);
      default:
        throw new Error(`Unknown hadith action: ${action}`);
    }
  }

  private async syncAllHadithCollections(job: Job<SyncJob>): Promise<any> {
    this.logger.log('Starting sync for all hadith collections (using local database)');
    
    try {
      // Update job progress
      await job.updateProgress(10);
      
      // Fetch collections from local database instead of external API
      const localCollections = await this.prisma.hadithCollection.findMany({
        select: { name: true, id: true }
      });
      this.logger.log(`Found ${localCollections.length} collections in local database`);
      
      await job.updateProgress(20);
      
      const results = [];
      
      // Process each collection using local data
      for (let i = 0; i < localCollections.length; i++) {
        const collection = localCollections[i];
        const progress = 20 + (i / localCollections.length) * 70;
        await job.updateProgress(progress);
        
        try {
          const result = await this.syncHadithCollectionFromLocal(job, collection.name);
          results.push({ collection: collection.name, success: true, result });
        } catch (error) {
          this.logger.error(`Failed to sync collection ${collection.name}:`, error);
          results.push({ collection: collection.name, success: false, error: error.message });
        }
      }
      
      await job.updateProgress(100);
      this.logger.log('All hadith collections sync completed using local data');
      
      return {
        success: true,
        collectionsProcessed: localCollections.length,
        results,
        note: 'Sync completed using local database data (external API temporarily disabled due to rate limiting)'
      };
    } catch (error) {
      this.logger.error('Failed to sync all hadith collections:', error);
      throw error;
    }
  }

  private async syncHadithCollection(job: Job<SyncJob>, collectionName: string): Promise<any> {
    this.logger.log(`Starting sync for collection: ${collectionName}`);
    
    try {
      // Update collection status
      await this.prisma.hadithCollection.updateMany({
        where: { name: collectionName },
        data: { syncStatus: 'in_progress' },
      });

      await job.updateProgress(10);

      // Get collection info from API
      const sunnahCollection = await this.sunnahApi.getCollectionInfo(collectionName);
      
      await job.updateProgress(20);

      // Upsert collection
      const collection = await this.prisma.hadithCollection.upsert({
        where: { name: collectionName },
        update: {
          titleEn: sunnahCollection.collection.find((c) => c.lang === 'en')?.title || collectionName,
          totalHadith: sunnahCollection.totalAvailableHadith,
          lastSyncedAt: new Date(),
          syncStatus: 'in_progress',
        },
        create: {
          name: collectionName,
          titleEn: sunnahCollection.collection.find((c) => c.lang === 'en')?.title || collectionName,
          totalHadith: sunnahCollection.totalAvailableHadith,
          hasBooks: sunnahCollection.hasBooks,
          lastSyncedAt: new Date(),
          syncStatus: 'in_progress',
        },
      });

      await job.updateProgress(30);

      // Sync books if available
      let booksProcessed = 0;
      try {
        const books = await this.sunnahApi.getBooks(collectionName);
        if (books.length > 0) {
          booksProcessed = await this.syncBooks(collection.id, collectionName, books);
        }
      } catch (error) {
        this.logger.warn(`Collection ${collectionName} - Books endpoint not accessible: ${error.message}`);
      }

      await job.updateProgress(50);

      // Sync hadiths in batches
      let hadithsProcessed = 0;
      try {
        hadithsProcessed = await this.syncHadithsInBatches(job, collection.id, collectionName);
      } catch (error) {
        this.logger.warn(`Collection ${collectionName} - Hadiths endpoint not accessible: ${error.message}`);
      }

      await job.updateProgress(90);

      // Update collection with final status
      await this.prisma.hadithCollection.update({
        where: { id: collection.id },
        data: {
          syncStatus: 'ok',
          lastSyncedAt: new Date(),
        },
      });

      await job.updateProgress(100);

      this.logger.log(`Collection ${collectionName} synced successfully`);
      
      return {
        success: true,
        collection: collectionName,
        booksProcessed,
        hadithsProcessed,
        totalHadith: sunnahCollection.totalAvailableHadith
      };
    } catch (error) {
      this.logger.error(`Failed to sync collection ${collectionName}:`, error);
      
      // Update sync status to failed
      await this.prisma.hadithCollection.updateMany({
        where: { name: collectionName },
        data: { syncStatus: 'failed' },
      });
      
      throw error;
    }
  }

  private async syncHadithCollectionFromLocal(job: Job<SyncJob>, collectionName: string): Promise<any> {
    this.logger.log(`Starting local sync for collection: ${collectionName}`);
    
    try {
      // Get collection from local database
      const collection = await this.prisma.hadithCollection.findFirst({
        where: { name: collectionName }
      });

      if (!collection) {
        throw new Error(`Collection ${collectionName} not found in local database`);
      }

      // Update collection last synced timestamp
      await this.prisma.hadithCollection.update({
        where: { id: collection.id },
        data: { 
          lastSyncedAt: new Date(),
          syncStatus: 'completed'
        }
      });

      // Get books count for this collection
      const booksCount = await this.prisma.hadithBook.count({
        where: { collectionId: collection.id }
      });

      // Get hadiths count for this collection
      const hadithsCount = await this.prisma.hadith.count({
        where: { collectionId: collection.id }
      });

      this.logger.log(`Collection ${collectionName}: ${booksCount} books, ${hadithsCount} hadiths`);

      return {
        success: true,
        collection: collectionName,
        booksCount,
        hadithsCount,
        note: 'Local database sync completed (no external API calls)'
      };
    } catch (error) {
      this.logger.error(`Failed to sync collection ${collectionName} from local data:`, error);
      throw error;
    }
  }

  private async syncBooks(collectionId: number, collectionName: string, sunnahBooks: any[]): Promise<number> {
    this.logger.log(`Syncing ${sunnahBooks.length} books for collection ${collectionName}`);
    
    let processed = 0;
    for (const sunnahBook of sunnahBooks) {
      // Handle special book numbers like "introduction"
      let bookNumber: number;
      if (sunnahBook.bookNumber === 'introduction') {
        bookNumber = 0; // Use 0 for introduction
      } else {
        const parsed = parseInt(sunnahBook.bookNumber);
        if (isNaN(parsed)) {
          this.logger.warn(`Invalid book number: ${sunnahBook.bookNumber}, skipping`);
          continue;
        }
        bookNumber = parsed;
      }

      await this.prisma.hadithBook.upsert({
        where: {
          collectionId_number: {
            collectionId,
            number: bookNumber,
          },
        },
        update: {
          titleEn: sunnahBook.book.find((b) => b.lang === 'en')?.name || `Book ${sunnahBook.bookNumber}`,
          titleAr: sunnahBook.book.find((b) => b.lang === 'ar')?.name || '',
          totalHadith: sunnahBook.numberOfHadith,
          lastSyncedAt: new Date(),
        },
        create: {
          collectionId,
          number: bookNumber,
          titleEn: sunnahBook.book.find((b) => b.lang === 'en')?.name || `Book ${sunnahBook.bookNumber}`,
          titleAr: sunnahBook.book.find((b) => b.lang === 'ar')?.name || '',
          totalHadith: sunnahBook.numberOfHadith,
          lastSyncedAt: new Date(),
        },
      });
      processed++;
    }
    
    return processed;
  }

  private async syncHadithsInBatches(job: Job<SyncJob>, collectionId: number, collectionName: string): Promise<number> {
    this.logger.log(`Starting hadith sync for collection ${collectionName}`);
    
    let page = 1;
    const limit = 50;
    let totalHadiths = 0;
    let hasMore = true;
    let batchCount = 0;

    while (hasMore) {
      try {
        const response = await this.sunnahApi.getHadiths(collectionName, page, limit);
        const hadiths = response.data;

        if (hadiths.length === 0) {
          hasMore = false;
          break;
        }

        // Process hadiths in smaller batches
        await this.processHadithBatch(collectionId, collectionName, hadiths);

        totalHadiths += hadiths.length;
        batchCount++;
        
        // Update progress every 10 batches
        if (batchCount % 10 === 0) {
          const progress = 50 + (batchCount / 100) * 40; // 50-90% range
          await job.updateProgress(Math.min(progress, 90));
          this.logger.log(`Processed ${totalHadiths} hadiths for collection ${collectionName}`);
        }

        // Check if we have more pages
        if (response.pagination && page >= response.pagination.totalPages) {
          hasMore = false;
        } else {
          page++;
        }

        // Add a small delay to respect rate limits
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        this.logger.warn(`Failed to fetch hadiths for collection ${collectionName}, page ${page}: ${error.message}`);
        hasMore = false;
        break;
      }
    }

    this.logger.log(`Completed hadith sync for collection ${collectionName}. Total: ${totalHadiths} hadiths`);
    return totalHadiths;
  }

  private async processHadithBatch(collectionId: number, collectionName: string, hadiths: any[]): Promise<void> {
    const batchSize = 10;

    for (let i = 0; i < hadiths.length; i += batchSize) {
      const batch = hadiths.slice(i, i + batchSize);

      await Promise.all(
        batch.map((hadith) => this.processSingleHadith(collectionId, collectionName, hadith)),
      );
    }
  }

  private async processSingleHadith(collectionId: number, collectionName: string, sunnahHadith: any): Promise<void> {
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

      // Process translation if Bangla text doesn't exist
      if (!hadith.textBn) {
        try {
          await this.translationService.processTranslationJob({
            hadithId: hadith.id,
            text: sunnahHadith.hadithEnglish,
            sourceLang: 'en',
            targetLang: 'bn',
          });
        } catch (translationError) {
          this.logger.error(`Translation failed for hadith ${hadith.id}: ${translationError.message}`);
        }
      }
    } catch (error) {
      this.logger.error(`Failed to process hadith ${sunnahHadith.hadithNumber}:`, error);
    }
  }

  private async processQuranJob(job: Job<SyncJob>): Promise<any> {
    const { action, data } = job.data;
    
    this.logger.log('Starting Quran sync job processing');
    
    // Check if sync is enabled
    const isSyncEnabled = this.configService.get("SYNC_ENABLED", "true") === "true";
    if (!isSyncEnabled) {
      this.logger.log("Quran sync is disabled, skipping job processing");
      return { success: true, message: "Quran sync is disabled", skipped: true };
    }
    
    try {
      await job.updateProgress(10);
      
      // Check for cancellation before chapters sync
      if (await this.isJobCancelled(job.id?.toString() || '')) {
        this.logger.log(`Job ${job.id} was cancelled before chapters sync`);
        throw new Error('Job cancelled by user');
      }
      
      // Sync chapters
      const chaptersResult = await this.quranSyncService.syncChapters({ force: data?.force || false });
      this.logger.log(`Quran chapters sync result: ${JSON.stringify(chaptersResult)}`);
      
      await job.updateProgress(30);
      
      // Check for cancellation before verses sync
      if (await this.isJobCancelled(job.id?.toString() || '')) {
        this.logger.log(`Job ${job.id} was cancelled before verses sync`);
        throw new Error('Job cancelled by user');
      }
      
      // Sync verses
      const versesResult = await this.quranSyncService.syncVerses({ force: data?.force || false });
      this.logger.log(`Quran verses sync result: ${JSON.stringify(versesResult)}`);
      
      await job.updateProgress(60);
      
      // Check for cancellation before translations sync
      if (await this.isJobCancelled(job.id?.toString() || '')) {
        this.logger.log(`Job ${job.id} was cancelled before translations sync`);
        throw new Error('Job cancelled by user');
      }
      
      // Sync translation resources
      const translationsResult = await this.quranSyncService.syncTranslationResources({ force: data?.force || false });
      this.logger.log(`Quran translations sync result: ${JSON.stringify(translationsResult)}`);
      
      await job.updateProgress(80);
      
      // Check for cancellation before verse translations sync
      if (await this.isJobCancelled(job.id?.toString() || '')) {
        this.logger.log(`Job ${job.id} was cancelled before verse translations sync`);
        throw new Error('Job cancelled by user');
      }
      
      // Sync verse translations
      const verseTranslationsResult = await this.quranSyncService.syncVerseTranslations({ force: data?.force || false });
      this.logger.log(`Quran verse translations sync result: ${JSON.stringify(verseTranslationsResult)}`);
      
      await job.updateProgress(100);
      
      this.logger.log('Quran sync job completed successfully');
      
      return {
        success: true,
        chapters: chaptersResult,
        verses: versesResult,
        translations: translationsResult,
        verseTranslations: verseTranslationsResult,
        message: 'Quran sync completed successfully'
      };
    } catch (error) {
      this.logger.error(`Quran sync job failed: ${error.message}`);
      throw error;
    }
  }

  private async processPrayerJob(job: Job<SyncJob>): Promise<any> {
    const { action, data } = job.data;
    const jobId = job.id?.toString() || `unknown-${Date.now()}`;
    
    this.logger.log(`Starting Prayer sync job processing with action: ${action}`);
    
    // Check if sync is enabled
    const isSyncEnabled = this.configService.get("SYNC_ENABLED", "true") === "true";
    if (!isSyncEnabled) {
      this.logger.log("Prayer sync is disabled, skipping job processing");
      return { success: true, message: "Prayer sync is disabled", skipped: true };
    }
    
    try {
      // Handle prewarm action
      if (action === 'prewarm') {
        await job.updateProgress(10);
        
        const days = data?.days || 7;
        this.logger.log(`Starting prayer prewarm for ${days} days`);
        
        const prewarmResult = await this.prayerSyncService.prewarmAllLocations(days, jobId, () => this.isJobCancelled(jobId));
        this.logger.log(`Prayer prewarm result: ${JSON.stringify(prewarmResult)}`);
        
        await job.updateProgress(100);
        return prewarmResult;
      }
      
      // Default sync action
      await job.updateProgress(5);
      
      // Check and fix prerequisites first
      this.logger.log('Checking prayer sync prerequisites...');
      const prerequisiteResult = await this.prayerPrerequisitesService.validateAndFixPrerequisites();
      
      if (!prerequisiteResult.success) {
        throw new Error(`Prayer sync prerequisites failed: ${prerequisiteResult.message}`);
      }
      
      if (prerequisiteResult.wasFixed) {
        this.logger.log(`Prayer prerequisites were auto-fixed: ${prerequisiteResult.message}`);
      } else {
        this.logger.log(`Prayer prerequisites already met: ${prerequisiteResult.message}`);
      }
      
      await job.updateProgress(15);
      
      // Sync calculation methods (if not already done by prerequisites)
      const methodsResult = await this.prayerSyncService.syncCalculationMethods({ force: data?.force || false });
      this.logger.log(`Prayer methods sync result: ${JSON.stringify(methodsResult)}`);
      
      await job.updateProgress(30);
      
      // First, ensure we have prayer locations by syncing comprehensive city list
      this.logger.log('Ensuring prayer locations exist by syncing comprehensive city list...');
      
      const comprehensiveCities = [
        // Middle East
        { name: "Mecca", lat: 21.4225, lng: 39.8262 },
        { name: "Medina", lat: 24.5247, lng: 39.5692 },
        { name: "Riyadh", lat: 24.7136, lng: 46.6753 },
        { name: "Jeddah", lat: 21.4858, lng: 39.1925 },
        { name: "Cairo", lat: 30.0444, lng: 31.2357 },
        { name: "Alexandria", lat: 31.2001, lng: 29.9187 },
        { name: "Istanbul", lat: 41.0082, lng: 28.9784 },
        { name: "Ankara", lat: 39.9334, lng: 32.8597 },
        { name: "Tehran", lat: 35.6892, lng: 51.3890 },
        { name: "Isfahan", lat: 32.6546, lng: 51.6680 },
        { name: "Baghdad", lat: 33.3152, lng: 44.3661 },
        { name: "Damascus", lat: 33.5138, lng: 36.2765 },
        { name: "Amman", lat: 31.9454, lng: 35.9284 },
        { name: "Kuwait City", lat: 29.3759, lng: 47.9774 },
        { name: "Doha", lat: 25.2854, lng: 51.5310 },
        { name: "Dubai", lat: 25.2048, lng: 55.2708 },
        { name: "Abu Dhabi", lat: 24.4539, lng: 54.3773 },
        { name: "Muscat", lat: 23.5880, lng: 58.3829 },
        { name: "Manama", lat: 26.0667, lng: 50.5577 },
        
        // South & Southeast Asia
        { name: "Jakarta", lat: -6.2088, lng: 106.8456 },
        { name: "Surabaya", lat: -7.2504, lng: 112.7688 },
        { name: "Bandung", lat: -6.9175, lng: 107.6191 },
        { name: "Kuala Lumpur", lat: 3.1390, lng: 101.6869 },
        { name: "Karachi", lat: 24.8607, lng: 67.0011 },
        { name: "Lahore", lat: 31.5204, lng: 74.3587 },
        { name: "Islamabad", lat: 33.6844, lng: 73.0479 },
        { name: "Dhaka", lat: 23.8103, lng: 90.4125 },
        { name: "Chittagong", lat: 22.3569, lng: 91.7832 },
        { name: "Delhi", lat: 28.6139, lng: 77.2090 },
        { name: "Mumbai", lat: 19.0760, lng: 72.8777 },
        { name: "Hyderabad", lat: 17.3850, lng: 78.4867 },
        { name: "Kolkata", lat: 22.5726, lng: 88.3639 },
        
        // Africa
        { name: "Casablanca", lat: 33.5731, lng: -7.5898 },
        { name: "Rabat", lat: 34.0209, lng: -6.8416 },
        { name: "Algiers", lat: 36.7538, lng: 3.0588 },
        { name: "Tunis", lat: 36.8065, lng: 10.1815 },
        { name: "Khartoum", lat: 15.5007, lng: 32.5599 },
        { name: "Addis Ababa", lat: 9.1450, lng: 38.7667 },
        { name: "Lagos", lat: 6.5244, lng: 3.3792 },
        { name: "Kano", lat: 12.0022, lng: 8.5919 },
        { name: "Dakar", lat: 14.6928, lng: -17.4467 },
        
        // North America
        { name: "New York", lat: 40.7128, lng: -74.0060 },
        { name: "Los Angeles", lat: 34.0522, lng: -118.2437 },
        { name: "Chicago", lat: 41.8781, lng: -87.6298 },
        { name: "Detroit", lat: 42.3314, lng: -83.0458 },
        { name: "Houston", lat: 29.7604, lng: -95.3698 },
        { name: "Toronto", lat: 43.6532, lng: -79.3832 },
        { name: "Montreal", lat: 45.5017, lng: -73.5673 },
        
        // Europe
        { name: "London", lat: 51.5074, lng: -0.1278 },
        { name: "Birmingham", lat: 52.4862, lng: -1.8904 },
        { name: "Paris", lat: 48.8566, lng: 2.3522 },
        { name: "Marseille", lat: 43.2965, lng: 5.3698 },
        { name: "Berlin", lat: 52.5200, lng: 13.4050 },
        { name: "Amsterdam", lat: 52.3676, lng: 4.9041 },
        { name: "Brussels", lat: 50.8503, lng: 4.3517 },
        { name: "Stockholm", lat: 59.3293, lng: 18.0686 },
        { name: "Oslo", lat: 59.9139, lng: 10.7522 },
        
        // Central Asia & Others
        { name: "Tashkent", lat: 41.2995, lng: 69.2401 },
        { name: "Almaty", lat: 43.2220, lng: 76.8512 },
        { name: "Baku", lat: 40.4093, lng: 49.8671 },
        { name: "Sarajevo", lat: 43.8563, lng: 18.4131 },
        { name: "Skopje", lat: 41.9981, lng: 21.4254 },
        { name: "Sydney", lat: -33.8688, lng: 151.2093 },
        { name: "Melbourne", lat: -37.8136, lng: 144.9631 },
      ];
      
      // Sync locations first (this creates the location records)
      for (const city of comprehensiveCities) {
        try {
          await this.prayerSyncService.syncPrayerTimes(
            city.lat,
            city.lng,
            { 
              force: data?.force || false,
              dateRange: {
                start: new Date(),
                end: new Date(Date.now() + 24 * 60 * 60 * 1000) // 1 day
              }
            }
          );
          this.logger.log(`Location synced: ${city.name}`);
        } catch (error) {
          this.logger.warn(`Failed to sync location ${city.name}: ${error.message}`);
        }
      }
      
      await job.updateProgress(50);
      
      // Now get all prayer locations (including the ones we just created)
      const locations = await this.prisma.prayerLocation.findMany({
        select: { id: true, city: true, country: true, lat: true, lng: true }
      });
      
      this.logger.log(`Found ${locations.length} prayer locations to sync times for`);
      
      // Get all calculation methods
      const methods = await this.prisma.prayerCalculationMethod.findMany({
        select: { id: true, methodCode: true, methodName: true }
      });
      
      // Get all madhabs (schools)
      const madhabs = [0, 1]; // 0 = Shafi, 1 = Hanafi
      
      this.logger.log(`Found ${locations.length} locations, ${methods.length} methods, ${madhabs.length} madhabs`);
      
      const prayerTimesResults = [];
      let totalCombinations = locations.length * methods.length * madhabs.length;
      let processedCombinations = 0;
      
      for (const location of locations) {
        for (const method of methods) {
          for (const madhab of madhabs) {
            // Check for cancellation before each prayer sync
            if (await this.isJobCancelled(job.id?.toString() || '')) {
              this.logger.log(`Job ${job.id} was cancelled during prayer sync`);
              throw new Error('Job cancelled by user');
            }

            const progress = 50 + (processedCombinations / totalCombinations) * 40;
            await job.updateProgress(progress);
            
            try {
              this.logger.log(`Syncing prayer times for ${location.city || 'Unknown'} (${method.methodCode}, madhab: ${madhab})...`);
              const result = await this.prayerSyncService.syncPrayerTimes(
                location.lat,
                location.lng,
                { 
                  force: data?.force || false
                }
              );
              prayerTimesResults.push({ 
                location: location.city || 'Unknown', 
                method: method.methodCode,
                madhab: madhab,
                result 
              });
              
              // Small delay between requests to be respectful to the API
              await new Promise(resolve => setTimeout(resolve, 200));
            } catch (error) {
              this.logger.error(`Failed to sync prayer times for ${location.city || 'Unknown'} (${method.methodCode}, madhab: ${madhab}): ${error.message}`);
              prayerTimesResults.push({ 
                location: location.city || 'Unknown', 
                method: method.methodCode,
                madhab: madhab,
                error: error.message 
              });
            }
            
            processedCombinations++;
          }
        }
      }
      
      await job.updateProgress(100);
      
      this.logger.log('Prayer sync job completed successfully');
      
      return {
        success: true,
        methods: methodsResult,
        prayerTimes: prayerTimesResults,
        message: 'Prayer sync completed successfully'
      };
    } catch (error) {
      this.logger.error(`Prayer sync job failed: ${error.message}`);
      throw error;
    }
  }

  private async processAudioJob(job: Job<SyncJob>): Promise<any> {
    const { action, data } = job.data;
    const jobId = job.id?.toString() || `unknown-${Date.now()}`;
    
    this.logger.log('Starting Audio sync job processing');
    
    try {
      await job.updateProgress(10);
      
      // Check for cancellation before syncing reciters
      if (await this.isJobCancelled(jobId)) {
        this.logger.log('Audio sync job cancelled before reciters sync');
        throw new Error('Job cancelled by user');
      }
      
      // Sync reciters
      const recitersResult = await this.audioSyncService.syncReciters();
      this.logger.log(`Audio reciters sync result: ${JSON.stringify(recitersResult)}`);
      
      await job.updateProgress(50);
      
      // Check for cancellation before syncing audio files
      if (await this.isJobCancelled(jobId)) {
        this.logger.log('Audio sync job cancelled before audio files sync');
        throw new Error('Job cancelled by user');
      }
      
      // Sync audio files
      const audioFilesResult = await this.audioSyncService.syncAllAudioFiles();
      this.logger.log(`Audio files sync result: ${JSON.stringify(audioFilesResult)}`);
      
      await job.updateProgress(100);
      
      this.logger.log('Audio sync job completed successfully');
      
      return {
        success: true,
        reciters: recitersResult,
        audioFiles: audioFilesResult,
        message: 'Audio sync completed successfully'
      };
    } catch (error) {
      this.logger.error(`Audio sync job failed: ${error.message}`);
      throw error;
    }
  }

  private async processZakatJob(job: Job<SyncJob>): Promise<any> {
    const { action, data } = job.data;
    const jobId = job.id?.toString() || `unknown-${Date.now()}`;
    
    this.logger.log('Starting Zakat sync job processing (Gold price update)');
    
    try {
      await job.updateProgress(10);
      
      // Check for cancellation before syncing gold prices
      if (await this.isJobCancelled(jobId)) {
        this.logger.log('Zakat sync job cancelled before gold price sync');
        throw new Error('Job cancelled by user');
      }
      
      // Sync gold prices (Zakat calculations depend on current gold prices)
      const goldPriceResult = await this.goldPriceScheduler.handleDailyScrape();
      this.logger.log(`Gold price sync result: ${JSON.stringify(goldPriceResult)}`);
      
      await job.updateProgress(100);
      
      this.logger.log('Zakat sync job completed successfully');
      
      return {
        success: true,
        goldPrices: goldPriceResult,
        message: 'Zakat sync (gold prices) completed successfully'
      };
    } catch (error) {
      this.logger.error(`Zakat sync job failed: ${error.message}`);
      throw error;
    }
  }

  private async processFinanceJob(job: Job<SyncJob>): Promise<any> {
    const { action, data } = job.data;
    const jobId = job.id?.toString() || `unknown-${Date.now()}`;
    
    this.logger.log('Starting Finance sync job processing (Gold price update)');
    
    try {
      await job.updateProgress(10);
      
      // Check for cancellation before syncing gold prices
      if (await this.isJobCancelled(jobId)) {
        this.logger.log('Finance sync job cancelled before gold price sync');
        throw new Error('Job cancelled by user');
      }
      
      // Sync gold prices
      const goldPriceResult = await this.goldPriceScheduler.handleDailyScrape();
      this.logger.log(`Gold price sync result: ${JSON.stringify(goldPriceResult)}`);
      
      await job.updateProgress(100);
      
      this.logger.log('Finance sync job completed successfully');
      
      return {
        success: true,
        goldPrices: goldPriceResult,
        message: 'Finance sync (gold prices) completed successfully'
      };
    } catch (error) {
      this.logger.error(`Finance sync job failed: ${error.message}`);
      throw error;
    }
  }

  private async updateHadithCollection(job: Job<SyncJob>, data: any): Promise<any> {
    // TODO: Implement hadith collection update
    this.logger.log('Hadith collection update not implemented yet');
    return { success: true, message: 'Update not implemented' };
  }

  private async isJobCancelled(jobId: string): Promise<boolean> {
    try {
      const cancelKey = `sync:cancel:${jobId}`;
      const pauseKey = `sync:pause:${jobId}`;
      
      const isCancelled = await this.redisService.get(cancelKey);
      const isPaused = await this.redisService.get(pauseKey);
      
      // If paused, throw a different error that can be handled by resume
      if (isPaused === 'true') {
        throw new Error('Job paused by user');
      }
      
      return isCancelled === 'true';
    } catch (error) {
      // If it's a pause error, re-throw it
      if (error.message === 'Job paused by user') {
        throw error;
      }
      this.logger.error('Error checking job cancellation:', error);
      return false;
    }
  }
}
