import { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { QuranController } from "./quran.controller";
import { QuranService } from "./quran.service";

describe("QuranController", () => {
  let controller: QuranController;
  let service: QuranService;

  const mockQuranService = {
    getChapters: jest.fn(),
    getChapter: jest.fn(),
    getVersesByChapter: jest.fn(),
    getVerse: jest.fn(),
    getTranslationResourcesFiltered: jest.fn(),
    getReciters: jest.fn(),
    searchQuran: jest.fn(),
    getJuz: jest.fn(),
    getHizb: jest.fn(),
    getPage: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QuranController],
      providers: [
        {
          provide: QuranService,
          useValue: mockQuranService,
        },
      ],
    }).compile();

    controller = module.get<QuranController>(QuranController);
    service = module.get<QuranService>(QuranService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getChapters", () => {
    it("should return chapters", async () => {
      const mockChapters = [
        { id: 1, name_arabic: "الفاتحة", name_simple: "Al-Fatihah" },
        { id: 2, name_arabic: "البقرة", name_simple: "Al-Baqarah" },
      ];

      mockQuranService.getChapters.mockResolvedValue({
        code: 200,
        status: "success",
        data: mockChapters,
      });

      const mockRes = {
        setHeader: jest.fn(),
        getHeader: jest.fn().mockReturnValue(null),
        json: jest.fn().mockReturnValue(mockChapters),
      };

      const result = await controller.getChapters(1, 10, mockRes as any);

      expect(result).toBeDefined();
      expect(service.getChapters).toHaveBeenCalledWith(1, 10);
    });
  });

  describe("getChapter", () => {
    it("should return a specific chapter", async () => {
      const mockChapter = {
        id: 1,
        name_arabic: "الفاتحة",
        name_simple: "Al-Fatihah",
        verses_count: 7,
      };

      mockQuranService.getChapter.mockResolvedValue({
        code: 200,
        status: "success",
        data: mockChapter,
      });

      const mockRes = {
        setHeader: jest.fn(),
        getHeader: jest.fn().mockReturnValue(null),
        json: jest.fn().mockReturnValue(mockChapter),
      };

      const result = await controller.getChapter("1", mockRes as any);

      expect(result).toBeDefined();
      expect(service.getChapter).toHaveBeenCalledWith(1);
    });
  });

  describe("getChapterVerses", () => {
    it("should return verses for a chapter", async () => {
      const mockVerses = [
        {
          id: 1,
          verse_number: 1,
          text_uthmani: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
        },
        {
          id: 2,
          verse_number: 2,
          text_uthmani: "الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ",
        },
      ];

      mockQuranService.getVersesByChapter.mockResolvedValue({
        code: 200,
        status: "success",
        data: mockVerses,
      });

      const mockRes = {
        setHeader: jest.fn(),
        getHeader: jest.fn().mockReturnValue(null),
        json: jest.fn().mockReturnValue(mockVerses),
      };

      const result = await controller.getChapterVerses(
        "1",
        "en",
        "",
        1,
        10,
        mockRes as any,
      );

      expect(result).toBeDefined();
      expect(service.getVersesByChapter).toHaveBeenCalledWith(1, 1, 10);
    });
  });

  describe("getTranslations", () => {
    it("should return translation resources", async () => {
      const mockResources = [
        { id: 1, name: "English Translation", language_name: "English" },
        { id: 2, name: "Bengali Translation", language_name: "Bengali" },
      ];

      mockQuranService.getTranslationResourcesFiltered.mockResolvedValue({
        code: 200,
        status: "success",
        data: mockResources,
      });

      const mockRes = {
        setHeader: jest.fn(),
        getHeader: jest.fn().mockReturnValue(null),
        json: jest.fn().mockReturnValue(mockResources),
      };

      const result = await controller.getTranslations("en", "1", "50", mockRes as any);

      expect(result).toBeDefined();
      expect(service.getTranslationResourcesFiltered).toHaveBeenCalledWith(
        "en",
        1,
        50,
      );
    });
  });
});
