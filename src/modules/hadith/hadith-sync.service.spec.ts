import { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { HadithSyncService } from "./hadith-sync.service";
import { PrismaService } from "../../database/prisma.service";
import { SunnahApiService } from "./sunnah-api.service";
import { TranslationService } from "./translation.service";
import { Queue } from "bullmq";

describe("HadithSyncService", () => {
  let service: HadithSyncService;
  // Note: Dependencies are mocked via providers; no direct references needed here

  const mockPrismaService = {
    hadithCollection: {
      updateMany: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    hadithBook: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
    },
    hadith: {
      upsert: jest.fn(),
    },
  };

  const mockSunnahApiService = {
    getCollections: jest.fn(),
    getCollectionInfo: jest.fn(),
    getBooks: jest.fn(),
    getHadiths: jest.fn(),
  };

  const mockTranslationQueue = {
    add: jest.fn(),
  };

  const mockTranslationService = {
    translateText: jest.fn(),
    getTranslation: jest.fn(),
    processTranslationJob: jest.fn(),
  };

  beforeEach(async () => {
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HadithSyncService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: SunnahApiService,
          useValue: mockSunnahApiService,
        },
        {
          provide: TranslationService,
          useValue: mockTranslationService,
        },
        {
          provide: "BullQueue_translation",
          useValue: mockTranslationQueue,
        },
      ],
    }).compile();

    service = module.get<HadithSyncService>(HadithSyncService);
    module.get<PrismaService>(PrismaService);
    module.get<SunnahApiService>(SunnahApiService);
    module.get<Queue>("BullQueue_translation");
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("syncCollection", () => {
    it("should sync a collection successfully", async () => {
      const collectionName = "bukhari";
      const mockCollection = {
        collectionName: "Sahih al-Bukhari",
        totalHadith: 7563,
        totalAvailableHadith: 7563,
        hasBooks: true,
        collection: [
          { lang: "en", title: "Sahih al-Bukhari" },
          { lang: "ar", title: "صحيح البخاري" }
        ],
      };

      const mockBooks = [
        {
          bookNumber: "1",
          book: [
            { lang: "en", name: "Revelation" },
            { lang: "ar", name: "الوحي" }
          ],
          hadithStartNumber: 1,
          hadithEndNumber: 7,
          numberOfHadith: 7,
        },
      ];

      const mockHadiths = {
        data: [
          {
            hadithNumber: 1,
            englishNarrator: "Narrated by Al-Bara",
            hadithEnglish: "The Prophet said...",
            hadithUrdu: "",
            hadithArabic: "قال النبي...",
            headingArabic: "",
            headingUrdu: "",
            headingEnglish: "",
            chapterNumber: "1",
            bookSlug: "1",
            volume: "1",
            grades: [{ graded_by: "Al-Bukhari", grade: "Sahih" }],
            reference: { book: 1, hadith: 1 },
          },
        ],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalRecords: 1,
          perPage: 50,
        },
      };

      mockSunnahApiService.getCollectionInfo.mockResolvedValue(mockCollection);
      mockSunnahApiService.getBooks.mockResolvedValue(mockBooks);
      mockSunnahApiService.getHadiths.mockResolvedValue(mockHadiths);
      mockPrismaService.hadithCollection.upsert.mockResolvedValue({ id: 1 });
      mockPrismaService.hadithCollection.update.mockResolvedValue({ id: 1 });
      mockPrismaService.hadithBook.findFirst.mockResolvedValue({ id: 1, bookNumber: 1 });
      mockPrismaService.hadithBook.upsert.mockResolvedValue({ id: 1 });
      mockPrismaService.hadith.upsert.mockResolvedValue({ id: 1 });

      await service.syncCollection(collectionName);

      expect(mockSunnahApiService.getCollectionInfo).toHaveBeenCalledWith(
        collectionName,
      );
      expect(mockSunnahApiService.getBooks).toHaveBeenCalledWith(
        collectionName,
      );
      expect(mockSunnahApiService.getHadiths).toHaveBeenCalledWith(
        collectionName,
        1,
        50,
      );
      expect(mockPrismaService.hadithCollection.upsert).toHaveBeenCalled();
      expect(mockPrismaService.hadithBook.upsert).toHaveBeenCalled();
      expect(mockPrismaService.hadith.upsert).toHaveBeenCalled();
    });

    it("should handle sync errors gracefully", async () => {
      const collectionName = "invalid";
      const error = new Error("Collection not found");

      mockSunnahApiService.getCollectionInfo.mockRejectedValue(error);

      await expect(service.syncCollection(collectionName)).rejects.toThrow(
        "Collection not found",
      );
    });
  });

  describe("getSyncStatus", () => {
    it("should return sync status for all collections", async () => {
      const mockCollections = [
        {
          name: "bukhari",
          syncStatus: "ok",
          lastSyncedAt: new Date(),
          totalHadith: 7563,
        },
        {
          name: "muslim",
          syncStatus: "pending",
          lastSyncedAt: null,
          totalHadith: null,
        },
      ];

      mockPrismaService.hadithCollection.findMany.mockResolvedValue(
        mockCollections,
      );

      const result = await service.getSyncStatus();

      expect(result).toEqual({ collections: mockCollections });
      expect(mockPrismaService.hadithCollection.findMany).toHaveBeenCalledWith({
        select: {
          name: true,
          syncStatus: true,
          lastSyncedAt: true,
          totalHadith: true,
        },
        orderBy: { name: "asc" },
      });
    });
  });
});
