import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { ConfigService } from "@nestjs/config";
import { QuranSyncService } from "../modules/quran/quran.sync.service";
import { PrayerSyncService } from "../modules/prayer/prayer.sync.service";

@Injectable()
export class SyncCronService {
  private readonly logger = new Logger(SyncCronService.name);
  private readonly isSyncEnabled: boolean;

  constructor(
    private readonly quranSyncService: QuranSyncService,
    private readonly prayerSyncService: PrayerSyncService,
    private readonly configService: ConfigService,
  ) {
    this.isSyncEnabled =
      this.configService.get("SYNC_ENABLED", "true") === "true";
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDailyQuranSync() {
    if (!this.isSyncEnabled) {
      this.logger.log("Daily Quran sync is disabled");
      return;
    }

    this.logger.log("Starting daily Quran sync...");

    try {
      // Sync chapters first
      const chaptersResult = await this.quranSyncService.syncChapters();
      this.logger.log(
        `Quran chapters sync result: ${JSON.stringify(chaptersResult)}`,
      );

      // Sync verses
      const versesResult = await this.quranSyncService.syncVerses();
      this.logger.log(
        `Quran verses sync result: ${JSON.stringify(versesResult)}`,
      );

      // Sync translation resources
      const translationsResult =
        await this.quranSyncService.syncTranslationResources();
      this.logger.log(
        `Quran translations sync result: ${JSON.stringify(translationsResult)}`,
      );

      this.logger.log("Daily Quran sync completed successfully");
    } catch (error) {
      this.logger.error(`Daily Quran sync failed: ${error.message}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async handleDailyPrayerSync() {
    if (!this.isSyncEnabled) {
      this.logger.log("Daily prayer sync is disabled");
      return;
    }

    this.logger.log("Starting daily prayer sync...");

    try {
      // Sync calculation methods
      const methodsResult =
        await this.prayerSyncService.syncCalculationMethods();
      this.logger.log(
        `Prayer methods sync result: ${JSON.stringify(methodsResult)}`,
      );

      // Sync prayer times for major cities
      await this.syncMajorCitiesPrayerTimes();

      this.logger.log("Daily prayer sync completed successfully");
    } catch (error) {
      this.logger.error(`Daily prayer sync failed: ${error.message}`);
    }
  }

  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async handlePrayerTimesPreWarm() {
    if (!this.isSyncEnabled) {
      this.logger.log("Prayer times pre-warm is disabled");
      return;
    }

    this.logger.log("Starting prayer times pre-warm...");

    try {
      // Pre-warm prayer times for major cities to ensure they're available
      await this.syncMajorCitiesPrayerTimes();

      this.logger.log("Prayer times pre-warm completed successfully");
    } catch (error) {
      this.logger.error(`Prayer times pre-warm failed: ${error.message}`);
    }
  }

  // Midnight UTC pre-warm to ensure day-start availability
  @Cron("0 0 * * *")
  async handlePrayerTimesPreWarmMidnight() {
    if (!this.isSyncEnabled) {
      this.logger.log("Prayer times pre-warm (midnight) is disabled");
      return;
    }

    this.logger.log("Starting prayer times pre-warm (midnight UTC)...");
    try {
      await this.syncMajorCitiesPrayerTimes();
      this.logger.log(
        "Prayer times pre-warm (midnight UTC) completed successfully",
      );
    } catch (error) {
      this.logger.error(
        `Prayer times pre-warm (midnight UTC) failed: ${error.message}`,
      );
    }
  }

  private async syncMajorCitiesPrayerTimes() {
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

    for (const city of majorCities) {
      try {
        this.logger.log(`Syncing prayer times for ${city.name}...`);

        const result = await this.prayerSyncService.syncPrayerTimes(
          city.lat,
          city.lng,
          { force: false },
        );

        this.logger.log(
          `Prayer times sync for ${city.name}: ${JSON.stringify(result)}`,
        );

        // Small delay between cities to be respectful
        await this.delay(500);
      } catch (error) {
        this.logger.error(
          `Failed to sync prayer times for ${city.name}: ${error.message}`,
        );
      }
    }
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Manual sync methods for admin use
  async manualQuranSync(force = false) {
    this.logger.log(`Starting manual Quran sync (force: ${force})...`);

    try {
      const chaptersResult = await this.quranSyncService.syncChapters({
        force,
      });
      const versesResult = await this.quranSyncService.syncVerses({ force });
      const translationsResult =
        await this.quranSyncService.syncTranslationResources({ force });

      return {
        chapters: chaptersResult,
        verses: versesResult,
        translations: translationsResult,
      };
    } catch (error) {
      this.logger.error(`Manual Quran sync failed: ${error.message}`);
      throw error;
    }
  }

  async manualPrayerSync(force = false) {
    this.logger.log(`Starting manual prayer sync (force: ${force})...`);

    try {
      const methodsResult = await this.prayerSyncService.syncCalculationMethods(
        { force },
      );

      // Sync prayer times for a few major cities
      const cities = [
        { name: "Mecca", lat: 21.4225, lng: 39.8262 },
        { name: "Medina", lat: 24.5247, lng: 39.5692 },
        { name: "Istanbul", lat: 41.0082, lng: 28.9784 },
      ];

      const prayerTimesResults = [];
      for (const city of cities) {
        try {
          const result = await this.prayerSyncService.syncPrayerTimes(
            city.lat,
            city.lng,
            { force },
          );
          prayerTimesResults.push({ city: city.name, result });
        } catch (error) {
          prayerTimesResults.push({ city: city.name, error: error.message });
        }
      }

      return {
        methods: methodsResult,
        prayerTimes: prayerTimesResults,
      };
    } catch (error) {
      this.logger.error(`Manual prayer sync failed: ${error.message}`);
      throw error;
    }
  }
}
