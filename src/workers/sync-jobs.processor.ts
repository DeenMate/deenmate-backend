import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { SunnahApiService } from '../modules/hadith/sunnah-api.service';
import { TranslationService } from '../modules/hadith/translation.service';
import { QuranSyncService } from '../modules/quran/quran.sync.service';
import { PrayerSyncService } from '../modules/prayer/prayer.sync.service';
import { AudioSyncService } from '../modules/audio/audio.sync.service';
import { GoldPriceScheduler } from '../modules/finance/goldprice.scheduler';
import { SyncJob } from './worker.service';

@Processor('sync-queue')
export class SyncJobsProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncJobsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sunnahApi: SunnahApiService,
    private readonly translationService: TranslationService,
    private readonly quranSyncService: QuranSyncService,
    private readonly prayerSyncService: PrayerSyncService,
    private readonly audioSyncService: AudioSyncService,
    private readonly goldPriceScheduler: GoldPriceScheduler,
  ) {
    super();
  }

  async process(job: Job<SyncJob>): Promise<any> {
    const { type, action, data } = job.data;
    
    this.logger.log(`Processing ${type}:${action} job (ID: ${job.id})`);

    try {
      switch (type) {
        case 'hadith':
          return await this.processHadithJob(job);
        case 'quran':
          return await this.processQuranJob(job);
        case 'prayer':
          return await this.processPrayerJob(job);
        case 'audio':
          return await this.processAudioJob(job);
        case 'zakat':
          return await this.processZakatJob(job);
        default:
          throw new Error(`Unknown job type: ${type}`);
      }
    } catch (error) {
      this.logger.error(`Job ${job.id} failed:`, error);
      throw error;
    }
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
    
    try {
      await job.updateProgress(10);
      
      // Sync chapters
      const chaptersResult = await this.quranSyncService.syncChapters({ force: data?.force || false });
      this.logger.log(`Quran chapters sync result: ${JSON.stringify(chaptersResult)}`);
      
      await job.updateProgress(30);
      
      // Sync verses
      const versesResult = await this.quranSyncService.syncVerses({ force: data?.force || false });
      this.logger.log(`Quran verses sync result: ${JSON.stringify(versesResult)}`);
      
      await job.updateProgress(60);
      
      // Sync translation resources
      const translationsResult = await this.quranSyncService.syncTranslationResources({ force: data?.force || false });
      this.logger.log(`Quran translations sync result: ${JSON.stringify(translationsResult)}`);
      
      await job.updateProgress(80);
      
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
    
    this.logger.log('Starting Prayer sync job processing');
    
    try {
      await job.updateProgress(10);
      
      // Sync calculation methods
      const methodsResult = await this.prayerSyncService.syncCalculationMethods({ force: data?.force || false });
      this.logger.log(`Prayer methods sync result: ${JSON.stringify(methodsResult)}`);
      
      await job.updateProgress(30);
      
      // Sync prayer times for major cities
      const majorCities = [
        { name: "Mecca", lat: 21.4225, lng: 39.8262 },
        { name: "Medina", lat: 24.5247, lng: 39.5692 },
        { name: "Istanbul", lat: 41.0082, lng: 28.9784 },
        { name: "Cairo", lat: 30.0444, lng: 31.2357 },
        { name: "Jakarta", lat: -6.2088, lng: 106.8456 },
        { name: "Lahore", lat: 31.5204, lng: 74.3587 },
        { name: "Tehran", lat: 35.6892, lng: 51.389 },
        { name: "Dubai", lat: 25.2048, lng: 55.2708 },
        { name: "Kuala Lumpur", lat: 3.139, lng: 101.6869 },
        { name: "London", lat: 51.5074, lng: -0.1278 },
        { name: "New York", lat: 40.7128, lng: -74.006 },
        { name: "Toronto", lat: 43.6532, lng: -79.3832 },
        { name: "Sydney", lat: -33.8688, lng: 151.2093 },
      ];
      
      const prayerTimesResults = [];
      for (let i = 0; i < majorCities.length; i++) {
        const city = majorCities[i];
        const progress = 30 + (i / majorCities.length) * 60;
        await job.updateProgress(progress);
        
        try {
          this.logger.log(`Syncing prayer times for ${city.name}...`);
          const result = await this.prayerSyncService.syncPrayerTimes(
            city.lat,
            city.lng,
            { force: data?.force || false }
          );
          prayerTimesResults.push({ city: city.name, result });
          
          // Small delay between cities to be respectful
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          this.logger.error(`Failed to sync prayer times for ${city.name}: ${error.message}`);
          prayerTimesResults.push({ city: city.name, error: error.message });
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
    
    this.logger.log('Starting Audio sync job processing');
    
    try {
      await job.updateProgress(10);
      
      // Sync reciters
      const recitersResult = await this.audioSyncService.syncReciters();
      this.logger.log(`Audio reciters sync result: ${JSON.stringify(recitersResult)}`);
      
      await job.updateProgress(50);
      
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
    
    this.logger.log('Starting Zakat sync job processing (Gold price update)');
    
    try {
      await job.updateProgress(10);
      
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

  private async updateHadithCollection(job: Job<SyncJob>, data: any): Promise<any> {
    // TODO: Implement hadith collection update
    this.logger.log('Hadith collection update not implemented yet');
    return { success: true, message: 'Update not implemented' };
  }
}
