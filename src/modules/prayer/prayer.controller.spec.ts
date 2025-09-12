import { TestingModule } from "@nestjs/testing";
import { Test } from "@nestjs/testing";
import { PrayerController } from "./prayer.controller";
import { PrayerService } from "./prayer.service";

describe("PrayerController", () => {
  let controller: PrayerController;
  let service: PrayerService;

  const mockPrayerService = {
    getDailyPrayerTimes: jest.fn(),
    getMonthlyPrayerTimes: jest.fn(),
    getYearlyPrayerTimes: jest.fn(),
    getPrayerTimesByCity: jest.fn(),
    getCalculationMethods: jest.fn(),
    saveLocation: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PrayerController],
      providers: [
        {
          provide: PrayerService,
          useValue: mockPrayerService,
        },
      ],
    }).compile();

    controller = module.get<PrayerController>(PrayerController);
    service = module.get<PrayerService>(PrayerService);
  });

  it("should be defined", () => {
    expect(controller).toBeDefined();
  });

  describe("getPrayerTimes", () => {
    it("should return daily prayer times", async () => {
      const mockPrayerTimes = {
        Fajr: "05:30",
        Sunrise: "06:45",
        Dhuhr: "12:15",
        Asr: "15:30",
        Maghrib: "18:00",
        Isha: "19:30",
      };

      mockPrayerService.getDailyPrayerTimes.mockResolvedValue({
        code: 200,
        status: "success",
        data: {
          timings: mockPrayerTimes,
          date: { readable: "15 Jan 2025" },
          meta: { method: { name: "Umm al-Qura" } },
        },
      });

      const mockRes = {
        setHeader: jest.fn(),
        getHeader: jest.fn().mockReturnValue(null),
        json: jest.fn().mockReturnValue({}),
        status: jest.fn().mockReturnThis(),
      };

      const result = await controller.getPrayerTimes(
        mockRes as any,
        "23.8103",
        "90.4125",
        "2025-01-15",
        "1",
        "0",
      );

      expect(result).toBeDefined();
      expect(service.getDailyPrayerTimes).toHaveBeenCalledWith(
        23.8103,
        90.4125,
        new Date("2025-01-15T00:00:00.000Z"),
        1,
        0,
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe("getMonthlyPrayerTimes", () => {
    it("should return monthly prayer times", async () => {
      const mockMonthlyTimes = [
        {
          date: { readable: "01 Jan 2025" },
          timings: {
            Fajr: "05:30",
            Sunrise: "06:45",
            Dhuhr: "12:15",
            Asr: "15:30",
            Maghrib: "18:00",
            Isha: "19:30",
          },
        },
      ];

      mockPrayerService.getMonthlyPrayerTimes.mockResolvedValue({
        code: 200,
        status: "success",
        data: mockMonthlyTimes,
      });

      const mockRes = {
        setHeader: jest.fn(),
        getHeader: jest.fn().mockReturnValue(null),
        json: jest.fn().mockReturnValue({}),
        status: jest.fn().mockReturnThis(),
      };

      const result = await controller.getMonthlyPrayerTimes(
        mockRes as any,
        "loc_23.8103_90.4125",
        "2025",
        "1",
        "1",
        "0",
        "23.8103",
        "90.4125",
      );

      expect(result).toBeDefined();
      expect(service.getMonthlyPrayerTimes).toHaveBeenCalledWith(
        "loc_23.8103_90.4125",
        2025,
        1,
        1,
        0,
        23.8103,
        90.4125,
        undefined,
        undefined,
        undefined,
      );
    });
  });

  describe("getCalculationMethods", () => {
    it("should return calculation methods", async () => {
      const mockMethods = [
        { id: 1, name: "Umm al-Qura", params: { Fajr: 18.5, Isha: 90 } },
        { id: 2, name: "Muslim World League", params: { Fajr: 18, Isha: 17 } },
      ];

      mockPrayerService.getCalculationMethods.mockResolvedValue({
        code: 200,
        status: "success",
        data: mockMethods,
      });

      const mockRes = {
        setHeader: jest.fn(),
        getHeader: jest.fn().mockReturnValue(null),
        json: jest.fn().mockReturnValue({}),
        status: jest.fn().mockReturnThis(),
      };

      const result = await controller.getCalculationMethods(mockRes as any);

      expect(result).toBeDefined();
      expect(service.getCalculationMethods).toHaveBeenCalled();
    });
  });

  describe("saveLocation", () => {
    it("should save a location", async () => {
      const mockLocation = {
        lat: 23.8103,
        lng: 90.4125,
        city: "Dhaka",
        country: "Bangladesh",
        timezone: "Asia/Dhaka",
        elevation: 10,
      };

      mockPrayerService.saveLocation.mockResolvedValue({
        code: 200,
        status: "success",
        data: { id: 1, ...mockLocation },
      });

      const mockRes = {
        setHeader: jest.fn(),
        getHeader: jest.fn().mockReturnValue(null),
        json: jest.fn().mockReturnValue({}),
        status: jest.fn().mockReturnThis(),
      };

      const result = await controller.saveLocation(
        mockLocation,
        mockRes as any,
      );

      expect(result).toBeDefined();
      expect(service.saveLocation).toHaveBeenCalledWith(mockLocation);
    });
  });
});
