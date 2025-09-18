import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { HttpService } from "@nestjs/axios";
import { firstValueFrom } from "rxjs";
import { ConfigService } from "@nestjs/config";

export interface AudioSyncResult {
  success: boolean;
  recitersProcessed: number;
  audioFilesProcessed: number;
  errors: string[];
  durationMs: number;
}

@Injectable()
export class AudioSyncService {
  private readonly logger = new Logger(AudioSyncService.name);
  private readonly quranApiBase = "https://api.quran.com/api/v4";
  private readonly audioCdnBase = "https://audio.qurancdn.com";

  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
    private configService: ConfigService,
  ) {}

  /**
   * Sync reciters from Quran.com API
   */
  async syncReciters(): Promise<AudioSyncResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let recitersProcessed = 0;

    try {
      this.logger.log("Starting reciters sync from Quran.com API");

      // Fetch reciters from upstream API
      const response = await firstValueFrom(
        this.httpService.get(`${this.quranApiBase}/resources/recitations`),
      );

      const reciters = response.data.recitations || [];
      this.logger.log(`Found ${reciters.length} reciters to sync`);

      for (const reciter of reciters) {
        try {
          // Check if reciter already exists
          const existingReciter = await this.prisma.quranReciter.findFirst({
            where: { sourceId: reciter.id },
          });

          if (existingReciter) {
            // Update existing reciter
            await this.prisma.quranReciter.update({
              where: { id: existingReciter.id },
              data: {
                name: reciter.reciter_name || reciter.name,
                englishName:
                  reciter.translated_name?.name ||
                  reciter.reciter_name ||
                  reciter.name,
                languageName:
                  reciter.translated_name?.language_name || "arabic",
                isActive: true,
              },
            });
          } else {
            // Create new reciter
            await this.prisma.quranReciter.create({
              data: {
                sourceId: reciter.id,
                sourceApi: "quran.com",
                name: reciter.reciter_name || reciter.name,
                englishName:
                  reciter.translated_name?.name ||
                  reciter.reciter_name ||
                  reciter.name,
                languageName:
                  reciter.translated_name?.language_name || "arabic",
                isActive: true,
              },
            });
          }

          recitersProcessed++;
        } catch (error) {
          const errorMsg = `Failed to sync reciter ${reciter.id}: ${error.message}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      this.logger.log(`Successfully synced ${recitersProcessed} reciters`);

      // Log sync job
      await this.logSyncJob("reciters-sync", "reciters", "success", {
        recitersProcessed,
        errors: errors.length,
      });

      return {
        success: errors.length === 0,
        recitersProcessed,
        audioFilesProcessed: 0,
        errors,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMsg = `Reciters sync failed: ${error.message}`;
      this.logger.error(errorMsg);
      errors.push(errorMsg);

      await this.logSyncJob("reciters-sync", "reciters", "failed", {
        error: errorMsg,
      });

      return {
        success: false,
        recitersProcessed,
        audioFilesProcessed: 0,
        errors,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Sync audio files for a specific reciter and chapter
   */
  async syncAudioFilesForChapter(
    reciterId: number,
    chapterId: number,
  ): Promise<AudioSyncResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let audioFilesProcessed = 0;

    try {
      // Find the reciter by sourceId to get the database ID
      const reciter = await this.prisma.quranReciter.findFirst({
        where: { sourceId: reciterId },
        select: { id: true, name: true }
      });

      if (!reciter) {
        const errorMsg = `Reciter with sourceId ${reciterId} not found in database`;
        this.logger.error(errorMsg);
        return { 
          success: false, 
          recitersProcessed: 0,
          audioFilesProcessed: 0, 
          errors: [errorMsg],
          durationMs: Date.now() - startTime
        };
      }

      this.logger.log(
        `Syncing audio files for reciter ${reciter.name} (DB ID: ${reciter.id}, Source ID: ${reciterId}), chapter ${chapterId}`,
      );

      // Fetch audio files from upstream API
      const response = await firstValueFrom(
        this.httpService.get(
          `${this.quranApiBase}/recitations/${reciterId}/by_chapter/${chapterId}`,
        ),
      );

      const audioFiles = response.data.audio_files || [];
      this.logger.log(
        `Found ${audioFiles.length} audio files for chapter ${chapterId}`,
      );

      // Get verses for this chapter
      const verses = await this.prisma.quranVerse.findMany({
        where: { chapterNumber: chapterId },
        select: { id: true, verseNumber: true },
      });

      for (const audioFile of audioFiles) {
        try {
          // Find corresponding verse
          const verse = verses.find(
            (v) =>
              v.verseNumber === parseInt(audioFile.verse_key.split(":")[1]),
          );
          if (!verse) {
            this.logger.warn(
              `Verse not found for audio file: ${audioFile.verse_key}`,
            );
            continue;
          }

          // Generate proper audio URL
          const audioUrl = this.generateAudioUrl(reciterId, audioFile.url);

          await this.prisma.quranAudioFile.upsert({
            where: {
              verseId_reciterId: {
                verseId: verse.id,
                reciterId: reciter.id, // Use database ID, not source ID
              },
            },
            update: {
              sourceUrl: audioUrl,
              lastVerified: new Date(),
            },
            create: {
              verseId: verse.id,
              reciterId: reciter.id, // Use database ID, not source ID
              sourceUrl: audioUrl,
              format: "mp3",
              quality: "128kbps", // Default quality
              lastVerified: new Date(),
            },
          });

          audioFilesProcessed++;
        } catch (error) {
          const errorMsg = `Failed to sync audio file ${audioFile.verse_key}: ${error.message}`;
          this.logger.error(errorMsg);
          errors.push(errorMsg);
        }
      }

      this.logger.log(
        `Successfully synced ${audioFilesProcessed} audio files for chapter ${chapterId}`,
      );

      return {
        success: errors.length === 0,
        recitersProcessed: 0,
        audioFilesProcessed,
        errors,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMsg = `Audio files sync failed for reciter ${reciterId}, chapter ${chapterId}: ${error.message}`;
      this.logger.error(errorMsg);
      errors.push(errorMsg);

      return {
        success: false,
        recitersProcessed: 0,
        audioFilesProcessed,
        errors,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Sync audio files for all reciters and chapters
   */
  async syncAllAudioFiles(): Promise<AudioSyncResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    let totalAudioFilesProcessed = 0;

    try {
      this.logger.log("Starting full audio files sync");

      // First sync reciters
      const recitersResult = await this.syncReciters();
      if (!recitersResult.success) {
        errors.push(...recitersResult.errors);
      }

      // Get all active reciters
      const reciters = await this.prisma.quranReciter.findMany({
        where: { isActive: true },
        select: { id: true, sourceId: true, name: true },
      });

      this.logger.log(`Found ${reciters.length} active reciters`);

      // Sync audio files for each reciter and chapter
      for (const reciter of reciters) {
        for (let chapterId = 1; chapterId <= 114; chapterId++) {
          try {
            const result = await this.syncAudioFilesForChapter(
              reciter.sourceId,
              chapterId,
            );
            totalAudioFilesProcessed += result.audioFilesProcessed;
            if (!result.success) {
              errors.push(...result.errors);
            }
          } catch (error) {
            const errorMsg = `Failed to sync audio for reciter ${reciter.sourceId}, chapter ${chapterId}: ${error.message}`;
            this.logger.error(errorMsg);
            errors.push(errorMsg);
          }
        }
      }

      // Log sync job
      await this.logSyncJob("audio-files-sync", "audio_files", "success", {
        totalAudioFilesProcessed,
        errors: errors.length,
      });

      return {
        success: errors.length === 0,
        recitersProcessed: reciters.length,
        audioFilesProcessed: totalAudioFilesProcessed,
        errors,
        durationMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMsg = `Full audio files sync failed: ${error.message}`;
      this.logger.error(errorMsg);
      errors.push(errorMsg);

      await this.logSyncJob("audio-files-sync", "audio_files", "failed", {
        error: errorMsg,
      });

      return {
        success: false,
        recitersProcessed: 0,
        audioFilesProcessed: totalAudioFilesProcessed,
        errors,
        durationMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Generate proper audio URL from Quran.com CDN
   */
  private generateAudioUrl(reciterId: number, relativePath: string): string {
    // Clean up the relative path
    const cleanPath = relativePath.startsWith("/")
      ? relativePath.slice(1)
      : relativePath;
    return `${this.audioCdnBase}/${reciterId}/${cleanPath}`;
  }

  /**
   * Log sync job to database
   */
  private async logSyncJob(
    jobName: string,
    resource: string,
    status: string,
    metadata: any = {},
  ): Promise<void> {
    try {
      await this.prisma.syncJobLog.create({
        data: {
          jobName,
          resource,
          status,
          notes: JSON.stringify(metadata),
          durationMs: metadata.durationMs || 0,
          recordsProcessed:
            metadata.recitersProcessed || metadata.audioFilesProcessed || 0,
          recordsFailed: metadata.errors || 0,
        },
      });
    } catch (error) {
      this.logger.error(`Failed to log sync job: ${error.message}`);
    }
  }
}
