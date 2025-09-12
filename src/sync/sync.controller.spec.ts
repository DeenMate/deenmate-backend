import { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { SyncController } from "./sync.controller";
import { SyncCronService } from "./sync.cron.service";
import { QuranSyncService } from "../modules/quran/quran.sync.service";
import { PrayerSyncService } from "../modules/prayer/prayer.sync.service";
import { AudioSyncService } from "../modules/audio/audio.sync.service";
import { AudioSeedService } from "../modules/audio/audio.seed.service";

describe("SyncController", () => {
  let controller: SyncController;
  // Note: services are mocked and accessed via module providers only
  let quranSyncService: QuranSyncService;
  let prayerSyncService: PrayerSyncService;
  // Note: audio services are mocked and not referenced directly

  const mockSyncCronService = {
    handleDailyQuranSync: jest.fn(),
    handleDailyPrayerSync: jest.fn(),
    handleDailyAudioSync: jest.fn(),
  };

  const mockQuranSyncService = {
    syncChapters: jest.fn(),
    syncVerses: jest.fn(),
    syncTranslationResources: jest.fn(),
  };

  const mockPrayerSyncService = {
    syncCalculationMethods: jest.fn(),
    syncPrayerTimes: jest.fn(),
  };

  const mockAudioSyncService = {
    syncReciters: jest.fn(),
    syncAudioFiles: jest.fn(),
  };

  const mockAudioSeedService = {
    seedReciters: jest.fn(),
    seedAudioFiles: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SyncController],
      providers: [
        {
          provide: SyncCronService,
          useValue: mockSyncCronService,
        },
        {
          provide: QuranSyncService,
          useValue: mockQuranSyncService,
        },
        {
          provide: PrayerSyncService,
          useValue: mockPrayerSyncService,
        },
        {
          provide: AudioSyncService,
          useValue: mockAudioSyncService,
        },
        {
          provide: AudioSeedService,
          useValue: mockAudioSeedService,
        },
      ],
    }).compile();

    controller = module.get<SyncController>(SyncController);
    module.get<SyncCronService>(SyncCronService);
    quranSyncService = module.get<QuranSyncService>(QuranSyncService);
    prayerSyncService = module.get<PrayerSyncService>(PrayerSyncService);
    module.get<AudioSyncService>(AudioSyncService);
    module.get<AudioSeedService>(AudioSeedService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("syncQuran", () => {
    it("should trigger Quran sync", async () => {
      const mockResult = {
        chapters: { processed: 114, errors: 0 },
        verses: { processed: 6236, errors: 0 },
        translations: { processed: 50, errors: 0 },
      };

      mockQuranSyncService.syncChapters.mockResolvedValue(mockResult.chapters);
      mockQuranSyncService.syncVerses.mockResolvedValue(mockResult.verses);
      mockQuranSyncService.syncTranslationResources.mockResolvedValue(
        mockResult.translations,
      );

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnValue({}),
      };

      const result = await controller.syncQuran(
        mockRes as any,
        "false",
        "true",
      );

      expect(result).toBeDefined();
      expect(quranSyncService.syncChapters).toHaveBeenCalledWith({ dryRun: true });
      expect(quranSyncService.syncVerses).toHaveBeenCalledWith({ dryRun: true });
      expect(quranSyncService.syncTranslationResources).toHaveBeenCalledWith({ dryRun: true });
    });
  });

  describe("syncPrayer", () => {
    it("should trigger Prayer sync", async () => {
      const mockResult = {
        methods: { processed: 15, errors: 0 },
        times: { processed: 100, errors: 0 },
      };

      mockPrayerSyncService.syncCalculationMethods.mockResolvedValue(
        mockResult.methods,
      );
      mockPrayerSyncService.syncPrayerTimes.mockResolvedValue(mockResult.times);

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnValue({}),
      };

      const result = await controller.syncPrayer(
        mockRes as any,
        "false",
        "true",
      );

      expect(result).toBeDefined();
      expect(prayerSyncService.syncCalculationMethods).toHaveBeenCalledWith({ dryRun: true });
      expect(prayerSyncService.syncPrayerTimes).toHaveBeenCalledWith(21.4225, 39.8262, { dryRun: true });
    });
  });

  describe("getSyncStatus", () => {
    it("should return sync status", async () => {
      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnValue({}),
      };

      const result = await controller.getSyncStatus(mockRes as any);

      expect(result).toBeDefined();
    });
  });

  describe("syncAll", () => {
    it("should trigger all sync operations", async () => {
      const mockResults = {
        quran: { processed: 6400, errors: 0 },
        prayer: { processed: 115, errors: 0 },
        audio: { processed: 1000, errors: 0 },
      };
      void mockResults;

      mockQuranSyncService.syncChapters.mockResolvedValue({
        processed: 114,
        errors: 0,
      });
      mockQuranSyncService.syncVerses.mockResolvedValue({
        processed: 6236,
        errors: 0,
      });
      mockQuranSyncService.syncTranslationResources.mockResolvedValue({
        processed: 50,
        errors: 0,
      });
      mockPrayerSyncService.syncCalculationMethods.mockResolvedValue({
        processed: 15,
        errors: 0,
      });
      mockPrayerSyncService.syncPrayerTimes.mockResolvedValue({
        processed: 100,
        errors: 0,
      });
      mockAudioSyncService.syncReciters.mockResolvedValue({
        processed: 50,
        errors: 0,
      });
      mockAudioSyncService.syncAudioFiles.mockResolvedValue({
        processed: 950,
        errors: 0,
      });

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnValue({}),
      };

      const result = await controller.syncAll(mockRes as any, "false", "false");

      expect(result).toBeDefined();
    });
  });
});
