import { Controller, Get, Post, Param, Body, Query } from "@nestjs/common";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiQuery,
} from "@nestjs/swagger";
import { HadithSyncService } from "./hadith-sync.service";
import { TranslationService } from "./translation.service";
import { PrismaService } from "../../database/prisma.service";

@ApiTags("Admin - Hadith Management")
@Controller({ path: "admin/hadith", version: "4" })
export class AdminHadithController {
  constructor(
    private readonly hadithSyncService: HadithSyncService,
    private readonly translationService: TranslationService,
    private readonly prisma: PrismaService,
  ) {}

  @Get("collections")
  @ApiOperation({ summary: "List collections with sync status and counts" })
  @ApiResponse({ status: 200, description: "Success" })
  async getCollections() {
    const syncStatus = await this.hadithSyncService.getSyncStatus();

    // Get additional stats for each collection
    const collectionsWithStats = await Promise.all(
      syncStatus.collections.map(async (collection) => {
        const [bookCount, hadithCount] = await Promise.all([
          this.prisma.hadithBook.count({
            where: { collection: { name: collection.name } },
          }),
          this.prisma.hadith.count({
            where: { collection: { name: collection.name } },
          }),
        ]);

        // Get translation stats using a simpler approach
        const translationStatsMap = {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
        };

        try {
          // Get all translation jobs for this collection's hadiths
          const collectionRecord =
            await this.prisma.hadithCollection.findUnique({
              where: { name: collection.name },
              select: { id: true },
            });

          if (collectionRecord) {
            const hadithIds = await this.prisma.hadith.findMany({
              where: { collectionId: collectionRecord.id },
              select: { id: true },
            });

            if (hadithIds.length > 0) {
              const translationJobs = await this.prisma.translationJob.findMany(
                {
                  where: {
                    hadithId: { in: hadithIds.map((h) => h.id) },
                  },
                  select: { status: true },
                },
              );

              translationJobs.forEach((job) => {
                if (translationStatsMap.hasOwnProperty(job.status)) {
                  translationStatsMap[
                    job.status as keyof typeof translationStatsMap
                  ]++;
                }
              });
            }
          }
        } catch (error) {
          console.error("Error getting translation stats:", error);
        }

        return {
          ...collection,
          bookCount,
          hadithCount,
          translationStats: translationStatsMap,
        };
      }),
    );

    return {
      success: true,
      data: { collections: collectionsWithStats },
      meta: {
        totalCollections: collectionsWithStats.length,
      },
    };
  }

  @Post("sync/:collectionName")
  @ApiOperation({ summary: "Trigger manual sync for a specific collection" })
  @ApiResponse({ status: 200, description: "Sync started successfully" })
  @ApiResponse({ status: 400, description: "Invalid collection name" })
  async syncCollection(@Param("collectionName") collectionName: string) {
    try {
      // Start sync in background
      this.hadithSyncService.syncCollection(collectionName).catch((error) => {
        console.error(`Background sync failed for ${collectionName}:`, error);
      });

      return {
        success: true,
        message: `Sync started for collection: ${collectionName}`,
        data: { collectionName },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to start sync for collection ${collectionName}: ${error.message}`,
      };
    }
  }

  @Post("sync-all")
  @ApiOperation({ summary: "Trigger manual sync for all collections" })
  @ApiResponse({ status: 200, description: "Sync started successfully" })
  async syncAllCollections() {
    try {
      // Start sync in background
      this.hadithSyncService.syncAllCollections().catch((error) => {
        console.error("Background sync failed:", error);
      });

      return {
        success: true,
        message: "Sync started for all collections",
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to start sync: ${error.message}`,
      };
    }
  }

  @Get("status/:collectionName")
  @ApiOperation({ summary: "Get sync progress for a specific collection" })
  @ApiResponse({ status: 200, description: "Success" })
  async getSyncStatus(@Param("collectionName") collectionName: string) {
    const progress = this.hadithSyncService.getSyncProgress(collectionName);

    return {
      success: true,
      data: { progress },
    };
  }

  @Get("status")
  @ApiOperation({ summary: "Get sync progress for all collections" })
  @ApiResponse({ status: 200, description: "Success" })
  async getAllSyncStatus() {
    const progress = this.hadithSyncService.getSyncProgress();

    return {
      success: true,
      data: { progress },
    };
  }

  @Post("verify-translation")
  @ApiOperation({ summary: "Update human-verified Bangla translation" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        hadithId: { type: "number" },
        translatedText: { type: "string" },
        isVerified: { type: "boolean", default: true },
      },
      required: ["hadithId", "translatedText"],
    },
  })
  @ApiResponse({ status: 200, description: "Translation updated successfully" })
  @ApiResponse({ status: 404, description: "Hadith not found" })
  async verifyTranslation(
    @Body()
    body: {
      hadithId: number;
      translatedText: string;
      isVerified?: boolean;
    },
  ) {
    const { hadithId, translatedText, isVerified = true } = body;

    try {
      const hadith = await this.prisma.hadith.update({
        where: { id: hadithId },
        data: {
          textBn: translatedText,
          isVerifiedBn: isVerified,
        },
      });

      return {
        success: true,
        message: "Translation updated successfully",
        data: { hadith },
      };
    } catch (error) {
      if (error.code === "P2025") {
        return {
          success: false,
          error: "Hadith not found",
        };
      }

      return {
        success: false,
        error: `Failed to update translation: ${error.message}`,
      };
    }
  }

  @Post("trigger-bulk-translation")
  @ApiOperation({ summary: "Trigger bulk translation for hadith without Bangla text" })
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        limit: { type: "number", default: 100, description: "Maximum number of hadith to translate" },
        collectionId: { type: "number", description: "Specific collection ID to translate (optional)" },
        batchSize: { type: "number", default: 10, description: "Batch size for processing" },
      },
    },
  })
  @ApiResponse({ status: 200, description: "Bulk translation triggered successfully" })
  async triggerBulkTranslation(
    @Body()
    body: {
      limit?: number;
      collectionId?: number;
      batchSize?: number;
    } = {},
  ) {
    try {
      const result = await this.translationService.triggerBulkTranslation(body);
      
      return {
        success: result.success,
        message: result.message,
        data: {
          processed: result.processed,
          errors: result.errors,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to trigger bulk translation: ${error.message}`,
      };
    }
  }

  @Get("translation-stats")
  @ApiOperation({ summary: "Get translation statistics" })
  @ApiResponse({ status: 200, description: "Success" })
  async getTranslationStats() {
    const stats = await this.translationService.getTranslationStats();

    return {
      success: true,
      data: { stats },
    };
  }

  @Post("retry-failed-translations")
  @ApiOperation({ summary: "Retry failed translation jobs" })
  @ApiResponse({ status: 200, description: "Retry process started" })
  async retryFailedTranslations() {
    try {
      // Start retry in background
      this.translationService.retryFailedTranslations().catch((error) => {
        console.error("Failed to retry translations:", error);
      });

      return {
        success: true,
        message: "Retry process started for failed translations",
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to start retry process: ${error.message}`,
      };
    }
  }

  @Get("translation-jobs")
  @ApiOperation({ summary: "Get translation jobs with pagination" })
  @ApiQuery({
    name: "page",
    required: false,
    schema: { type: "integer", default: 1 },
  })
  @ApiQuery({
    name: "per_page",
    required: false,
    schema: { type: "integer", default: 20 },
  })
  @ApiQuery({
    name: "status",
    required: false,
    schema: {
      type: "string",
      enum: ["pending", "processing", "completed", "failed"],
    },
  })
  @ApiResponse({ status: 200, description: "Success" })
  async getTranslationJobs(
    @Query("page") page?: string,
    @Query("per_page") perPage?: string,
    @Query("status") status?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const perPageNum = perPage ? parseInt(perPage) : 20;
    const skip = (pageNum - 1) * perPageNum;

    const where: any = {};
    if (status) {
      where.status = status;
    }

    const [jobs, total] = await Promise.all([
      this.prisma.translationJob.findMany({
        where,
        skip,
        take: perPageNum,
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.translationJob.count({ where }),
    ]);

    // Get hadith details separately
    const jobsWithDetails = await Promise.all(
      jobs.map(async (job) => {
        const hadith = await this.prisma.hadith.findUnique({
          where: { id: job.hadithId },
          select: {
            id: true,
            hadithNumber: true,
            collection: {
              select: {
                name: true,
                titleEn: true,
              },
            },
          },
        });

        return {
          ...job,
          hadith,
        };
      }),
    );

    return {
      success: true,
      data: {
        jobs: jobsWithDetails,
        pagination: {
          page: pageNum,
          perPage: perPageNum,
          total,
          totalPages: Math.ceil(total / perPageNum),
          hasNext: pageNum < Math.ceil(total / perPageNum),
          hasPrev: pageNum > 1,
        },
      },
    };
  }
}
