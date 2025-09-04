import { Controller, Post, Get, Query, Res, HttpStatus, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { SyncCronService } from './sync.cron.service';
import { QuranSyncService } from '../quran/quran.sync.service';
import { PrayerSyncService } from '../prayer/prayer.sync.service';
import { AdminApiKeyGuard } from '../common/guards/admin-api-key.guard';

@Controller('admin/sync')
@UseGuards(AdminApiKeyGuard)
export class SyncController {
  constructor(
    private readonly syncCronService: SyncCronService,
    private readonly quranSyncService: QuranSyncService,
    private readonly prayerSyncService: PrayerSyncService,
  ) {}

  @Post('quran')
  async syncQuran(
    @Res() res: Response,
    @Query('force') force?: string,
    @Query('dryRun') dryRun?: string,
  ) {
    try {
      const forceSync = force === 'true';
      const isDryRun = dryRun === 'true';

      if (isDryRun) {
        const chaptersResult = await this.quranSyncService.syncChapters({ dryRun: true });
        const versesResult = await this.quranSyncService.syncVerses({ dryRun: true });
        const translationsResult = await this.quranSyncService.syncTranslationResources({ dryRun: true });

        return res.status(HttpStatus.OK).json({
          success: true,
          message: 'Quran sync dry run completed',
          results: {
            chapters: chaptersResult,
            verses: versesResult,
            translations: translationsResult,
          },
        });
      }

      const result = await this.syncCronService.manualQuranSync(forceSync);

      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Quran sync completed successfully',
        results: result,
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Quran sync failed',
        error: error.message,
      });
    }
  }

  @Post('prayer')
  async syncPrayer(
    @Res() res: Response,
    @Query('force') force?: string,
    @Query('dryRun') dryRun?: string,
  ) {
    try {
      const forceSync = force === 'true';
      const isDryRun = dryRun === 'true';

      if (isDryRun) {
        const methodsResult = await this.prayerSyncService.syncCalculationMethods({ dryRun: true });
        
        // Dry run for prayer times (just one city)
        const prayerTimesResult = await this.prayerSyncService.syncPrayerTimes(
          21.4225, // Mecca
          39.8262,
          { dryRun: true }
        );

        return res.status(HttpStatus.OK).json({
          success: true,
          message: 'Prayer sync dry run completed',
          results: {
            methods: methodsResult,
            prayerTimes: prayerTimesResult,
          },
        });
      }

      const result = await this.syncCronService.manualPrayerSync(forceSync);

      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Prayer sync completed successfully',
        results: result,
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Prayer sync failed',
        error: error.message,
      });
    }
  }

  @Post('all')
  async syncAll(
    @Res() res: Response,
    @Query('force') force?: string,
    @Query('dryRun') dryRun?: string,
  ) {
    try {
      const forceSync = force === 'true';
      const isDryRun = dryRun === 'true';

      if (isDryRun) {
        const quranResult = await this.syncCronService.manualQuranSync(forceSync);
        const prayerResult = await this.syncCronService.manualPrayerSync(forceSync);

        return res.status(HttpStatus.OK).json({
          success: true,
          message: 'Full sync dry run completed',
          results: {
            quran: quranResult,
            prayer: prayerResult,
          },
        });
      }

      // Run both syncs in parallel
      const [quranResult, prayerResult] = await Promise.all([
        this.syncCronService.manualQuranSync(forceSync),
        this.syncCronService.manualPrayerSync(forceSync),
      ]);

      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Full sync completed successfully',
        results: {
          quran: quranResult,
          prayer: prayerResult,
        },
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Full sync failed',
        error: error.message,
      });
    }
  }

  @Get('status')
  async getSyncStatus(@Res() res: Response) {
    try {
      // Get recent sync job logs
      // This would require accessing the database directly or creating a service method
      // For now, return basic status
      
      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Sync status retrieved',
        status: {
          lastQuranSync: 'Not implemented yet', // TODO: Implement
          lastPrayerSync: 'Not implemented yet', // TODO: Implement
          nextScheduledSync: '03:00 UTC daily',
          syncEnabled: true,
        },
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Failed to get sync status',
        error: error.message,
      });
    }
  }

  @Post('quran/chapters')
  async syncQuranChapters(
    @Res() res: Response,
    @Query('force') force?: string,
    @Query('dryRun') dryRun?: string,
  ) {
    try {
      const forceSync = force === 'true';
      const isDryRun = dryRun === 'true';

      const result = await this.quranSyncService.syncChapters({ force: forceSync, dryRun: isDryRun });

      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Quran chapters sync completed',
        result,
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Quran chapters sync failed',
        error: error.message,
      });
    }
  }

  @Post('quran/verses')
  async syncQuranVerses(
    @Res() res: Response,
    @Query('force') force?: string,
    @Query('dryRun') dryRun?: string,
  ) {
    try {
      const forceSync = force === 'true';
      const isDryRun = dryRun === 'true';

      const result = await this.quranSyncService.syncVerses({ force: forceSync, dryRun: isDryRun });

      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Quran verses sync completed',
        result,
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Quran verses sync failed',
        error: error.message,
      });
    }
  }

  @Post('prayer/methods')
  async syncPrayerMethods(
    @Res() res: Response,
    @Query('force') force?: string,
    @Query('dryRun') dryRun?: string,
  ) {
    try {
      const forceSync = force === 'true';
      const isDryRun = dryRun === 'true';

      const result = await this.prayerSyncService.syncCalculationMethods({ force: forceSync, dryRun: isDryRun });

      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Prayer methods sync completed',
        result,
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Prayer methods sync failed',
        error: error.message,
      });
    }
  }

  @Post('prayer/times')
  async syncPrayerTimes(
    @Res() res: Response,
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('force') force?: string,
    @Query('dryRun') dryRun?: string,
  ) {
    try {
      if (!lat || !lng) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Latitude and longitude are required',
        });
      }

      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      const forceSync = force === 'true';
      const isDryRun = dryRun === 'true';

      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          success: false,
          message: 'Invalid latitude or longitude values',
        });
      }

      const result = await this.prayerSyncService.syncPrayerTimes(
        latitude,
        longitude,
        { force: forceSync, dryRun: isDryRun }
      );

      return res.status(HttpStatus.OK).json({
        success: true,
        message: 'Prayer times sync completed',
        result,
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: 'Prayer times sync failed',
        error: error.message,
      });
    }
  }
}
