import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";

export interface TranslationRequest {
  text: string;
  sourceLang: string;
  targetLang: string;
}

export interface TranslationResponse {
  translatedText: string;
  isMachine: boolean;
  confidence?: number;
}

@Injectable()
export class TranslationService {
  private readonly logger = new Logger(TranslationService.name);

  constructor(private readonly prisma: PrismaService) {}

  async translateText(
    request: TranslationRequest,
  ): Promise<TranslationResponse> {
    this.logger.log(
      `Translating text from ${request.sourceLang} to ${request.targetLang}`,
    );

    try {
      // For now, return a placeholder translation
      // In production, you would integrate with a real translation service like Google Translate API
      const translatedText = await this.performTranslation(
        request.text,
        request.sourceLang,
        request.targetLang,
      );

      this.logger.log(`Translation completed successfully`);
      return {
        translatedText,
        isMachine: true,
        confidence: 0.8,
      };
    } catch (error) {
      this.logger.error(`Translation failed: ${error.message}`, error.stack);

      // Fallback to a simple placeholder translation
      return {
        translatedText: `[Translation pending: ${request.text.substring(0, 50)}...]`,
        isMachine: true,
        confidence: 0,
      };
    }
  }

  private async performTranslation(
    text: string,
    sourceLang: string,
    targetLang: string,
  ): Promise<string> {
    // Simple placeholder translation logic
    // In production, integrate with Google Translate API or similar service

    if (sourceLang === "en" && targetLang === "bn") {
      // For English to Bangla, return a more realistic placeholder
      // Remove HTML tags and create a simple Bangla placeholder
      const cleanText = text.replace(/<[^>]*>/g, '').trim();
      const words = cleanText.split(' ').slice(0, 20); // Take first 20 words
      const truncatedText = words.join(' ');
      
      // Create a more realistic Bangla placeholder
      return `[মেশিন অনুবাদ] ${truncatedText}... (এই হাদিসের বাংলা অনুবাদ প্রক্রিয়াধীন)`;
    }

    if (sourceLang === "ar" && targetLang === "bn") {
      // For Arabic to Bangla, return a placeholder
      const cleanText = text.replace(/<[^>]*>/g, '').trim();
      const words = cleanText.split(' ').slice(0, 15);
      const truncatedText = words.join(' ');
      
      return `[মেশিন অনুবাদ] ${truncatedText}... (এই হাদিসের বাংলা অনুবাদ প্রক্রিয়াধীন)`;
    }

    // Default fallback
    return `[Translation: ${text.substring(0, 100)}...]`;
  }

  async processTranslationJob(jobData: {
    hadithId: number;
    text: string;
    sourceLang: string;
    targetLang: string;
  }): Promise<void> {
    const { hadithId, text, sourceLang, targetLang } = jobData;

    this.logger.log(`Processing translation job for hadith ${hadithId}`);

    try {
      // Create translation job record
      const translationJob = await this.prisma.translationJob.create({
        data: {
          hadithId,
          text,
          sourceLang,
          targetLang,
          status: "processing",
        },
      });

      // Perform translation
      const translation = await this.translateText({
        text,
        sourceLang,
        targetLang,
      });

      // Update hadith with translated text
      await this.prisma.hadith.update({
        where: { id: hadithId },
        data: {
          textBn: translation.translatedText,
          isVerifiedBn: !translation.isMachine, // Mark as verified only if not machine translation
        },
      });

      // Update translation job as completed
      await this.prisma.translationJob.update({
        where: { id: translationJob.id },
        data: {
          status: "completed",
          translatedText: translation.translatedText,
          completedAt: new Date(),
        },
      });

      this.logger.log(`Translation job completed for hadith ${hadithId}`);
    } catch (error) {
      this.logger.error(
        `Translation job failed for hadith ${hadithId}: ${error.message}`,
        error.stack,
      );

      // Update translation job as failed
      await this.prisma.translationJob.updateMany({
        where: { hadithId },
        data: {
          status: "failed",
          error: error.message,
        },
      });

      throw error;
    }
  }

  async triggerBulkTranslation(options: {
    limit?: number;
    collectionId?: number;
    batchSize?: number;
  } = {}): Promise<{
    success: boolean;
    message: string;
    processed: number;
    errors: number;
  }> {
    const { limit = 100, collectionId, batchSize = 10 } = options;
    
    this.logger.log(`Starting bulk translation for ${limit} hadith records`);
    
    try {
      // Find hadith without Bangla translations
      const hadithToTranslate = await this.prisma.hadith.findMany({
        where: {
          textBn: null,
          ...(collectionId && { collectionId }),
        },
        take: limit,
        select: {
          id: true,
          hadithNumber: true,
          textEn: true,
          collectionId: true,
        },
      });

      this.logger.log(`Found ${hadithToTranslate.length} hadith records to translate`);

      let processed = 0;
      let errors = 0;

      // Process in batches
      for (let i = 0; i < hadithToTranslate.length; i += batchSize) {
        const batch = hadithToTranslate.slice(i, i + batchSize);
        
        await Promise.all(
          batch.map(async (hadith) => {
            try {
              await this.processTranslationJob({
                hadithId: hadith.id,
                text: hadith.textEn,
                sourceLang: "en",
                targetLang: "bn",
              });
              processed++;
            } catch (error) {
              this.logger.error(`Translation failed for hadith ${hadith.id}: ${error.message}`);
              errors++;
            }
          })
        );
        
        // Small delay between batches to avoid overwhelming the system
        if (i + batchSize < hadithToTranslate.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }

      this.logger.log(`Bulk translation completed: ${processed} processed, ${errors} errors`);

      return {
        success: true,
        message: `Bulk translation completed: ${processed} processed, ${errors} errors`,
        processed,
        errors,
      };
    } catch (error) {
      this.logger.error(`Bulk translation failed: ${error.message}`, error.stack);
      return {
        success: false,
        message: `Bulk translation failed: ${error.message}`,
        processed: 0,
        errors: 1,
      };
    }
  }

  async getTranslationStats(): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const stats = await this.prisma.translationJob.groupBy({
      by: ["status"],
      _count: {
        status: true,
      },
    });

    const result = {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
    };

    stats.forEach((stat) => {
      result.total += stat._count.status;
      result[stat.status as keyof typeof result] = stat._count.status;
    });

    return result;
  }

  async retryFailedTranslations(): Promise<void> {
    this.logger.log("Retrying failed translations");

    const failedJobs = await this.prisma.translationJob.findMany({
      where: {
        status: "failed",
        retryCount: { lt: 3 }, // Max 3 retries
      },
      take: 100, // Process in batches
    });

    for (const job of failedJobs) {
      try {
        await this.processTranslationJob({
          hadithId: job.hadithId,
          text: job.text,
          sourceLang: job.sourceLang,
          targetLang: job.targetLang,
        });

        this.logger.log(`Retry successful for translation job ${job.id}`);
      } catch (error) {
        this.logger.error(
          `Retry failed for translation job ${job.id}: ${error.message}`,
        );

        // Increment retry count
        await this.prisma.translationJob.update({
          where: { id: job.id },
          data: {
            retryCount: job.retryCount + 1,
          },
        });
      }
    }
  }
}
