import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrayerSyncService } from '../prayer.sync.service';
import { PrismaService } from '../../../database/prisma.service';
import { CommonHttpService } from '../../../common/common.module';
import { PrayerMapper } from '../prayer.mapper';
import { RedisService } from '../../../redis/redis.service';

describe('PrayerSyncService', () => {
  let service: PrayerSyncService;
  let prismaService: PrismaService;
  let httpService: CommonHttpService;
  let mapper: PrayerMapper;
  let configService: ConfigService;
  let redisService: RedisService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrayerSyncService,
        {
          provide: PrismaService,
          useValue: {
            prayerTimes: {
              create: jest.fn(),
              update: jest.fn(),
              findUnique: jest.fn(),
              upsert: jest.fn(),
            },
            prayerLocation: {
              upsert: jest.fn(),
              findFirst: jest.fn(),
            },
            prayerCalculationMethod: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
            },
            syncJobLog: {
              create: jest.fn(),
              findFirst: jest.fn(),
            },
          },
        },
        {
          provide: CommonHttpService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: PrayerMapper,
          useValue: {
            mapCalculationMethodFromUpstream: jest.fn(),
            mapPrayerTimesFromUpstream: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn(),
          },
        },
        {
          provide: RedisService,
          useValue: {
            set: jest.fn(),
            ping: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<PrayerSyncService>(PrayerSyncService);
    prismaService = module.get<PrismaService>(PrismaService);
    httpService = module.get<CommonHttpService>(CommonHttpService);
    mapper = module.get<PrayerMapper>(PrayerMapper);
    configService = module.get<ConfigService>(ConfigService);
    redisService = module.get<RedisService>(RedisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getDefaultDateRange', () => {
    it('should return correct date range for 1 day', () => {
      const result = (service as any).getDefaultDateRange(1);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      expect(result.start).toEqual(today);
      expect(result.end).toEqual(today);
    });

    it('should return correct date range for 7 days', () => {
      const result = (service as any).getDefaultDateRange(7);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 6);
      
      expect(result.start).toEqual(today);
      expect(result.end).toEqual(endDate);
    });

    it('should return correct date range for 30 days', () => {
      const result = (service as any).getDefaultDateRange(30);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 29);
      
      expect(result.start).toEqual(today);
      expect(result.end).toEqual(endDate);
    });

    it('should handle month boundaries correctly', () => {
      // Test with a date at the end of a month
      const testDate = new Date(2025, 0, 31); // January 31, 2025
      jest.spyOn(global, 'Date').mockImplementation(() => testDate);
      
      const result = (service as any).getDefaultDateRange(3);
      const start = new Date(testDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 2);
      
      expect(result.start).toEqual(start);
      expect(result.end).toEqual(end);
      
      jest.restoreAllMocks();
    });

    it('should handle leap year correctly', () => {
      // Test with February 29 in a leap year
      const testDate = new Date(2024, 1, 29); // February 29, 2024
      jest.spyOn(global, 'Date').mockImplementation(() => testDate);
      
      const result = (service as any).getDefaultDateRange(2);
      const start = new Date(testDate);
      start.setHours(0, 0, 0, 0);
      const end = new Date(start);
      end.setDate(start.getDate() + 1);
      
      expect(result.start).toEqual(start);
      expect(result.end).toEqual(end);
      
      jest.restoreAllMocks();
    });
  });

  describe('validateDateRange', () => {
    it('should accept valid day ranges', () => {
      expect((service as any).validateDateRange(1)).toBe(1);
      expect((service as any).validateDateRange(7)).toBe(7);
      expect((service as any).validateDateRange(30)).toBe(30);
      expect((service as any).validateDateRange(365)).toBe(365);
    });

    it('should reject invalid day ranges', () => {
      expect(() => (service as any).validateDateRange(0)).toThrow('Invalid days parameter: 0. Must be between 1 and 365.');
      expect(() => (service as any).validateDateRange(-1)).toThrow('Invalid days parameter: -1. Must be between 1 and 365.');
      expect(() => (service as any).validateDateRange(366)).toThrow('Invalid days parameter: 366. Must be between 1 and 365.');
    });
  });

  describe('syncPrayerTimesForMethod', () => {
    it('should use custom date range when provided', async () => {
      const customDateRange = {
        start: new Date('2025-09-15'),
        end: new Date('2025-09-15'),
      };

      const mockLocation = { lat: 23.8103, lng: 90.4125 };
      const mockMethod = { id: 1, methodCode: 'MWL' };

      (prismaService as any).prayerCalculationMethod.findUnique.mockResolvedValue(mockMethod);
      (prismaService as any).prayerLocation.upsert.mockResolvedValue({});
      (httpService.get as jest.Mock).mockResolvedValue({
        data: {
          timings: {
            Fajr: '05:00',
            Sunrise: '06:00',
            Dhuhr: '12:00',
            Asr: '15:00',
            Maghrib: '18:00',
            Isha: '19:00',
          },
          date: { readable: '15-09-2025' },
        },
      });
      (mapper.mapPrayerTimesFromUpstream as jest.Mock).mockReturnValue({
        locKey: 'test-key',
        date: '2025-09-15',
        method: 1,
        school: 0,
        fajr: new Date('2025-09-15T05:00:00'),
        sunrise: new Date('2025-09-15T06:00:00'),
        dhuhr: new Date('2025-09-15T12:00:00'),
        asr: new Date('2025-09-15T15:00:00'),
        maghrib: new Date('2025-09-15T18:00:00'),
        isha: new Date('2025-09-15T19:00:00'),
        source: 'aladhan',
      });
      (prismaService as any).prayerTimes.create.mockResolvedValue({});

      const result = await service.syncPrayerTimesForMethod(
        23.8103,
        90.4125,
        1,
        0,
        { dateRange: customDateRange }
      );

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(1);
    });

    it('should use default date range when not provided', async () => {
      const mockLocation = { lat: 23.8103, lng: 90.4125 };
      const mockMethod = { id: 1, methodCode: 'MWL' };

      (prismaService as any).prayerCalculationMethod.findUnique.mockResolvedValue(mockMethod);
      (prismaService as any).prayerLocation.upsert.mockResolvedValue({});
      (httpService.get as jest.Mock).mockResolvedValue({
        data: {
          timings: {
            Fajr: '05:00',
            Sunrise: '06:00',
            Dhuhr: '12:00',
            Asr: '15:00',
            Maghrib: '18:00',
            Isha: '19:00',
          },
          date: { readable: '15-09-2025' },
        },
      });
      (mapper.mapPrayerTimesFromUpstream as jest.Mock).mockReturnValue({
        locKey: 'test-key',
        date: '2025-09-15',
        method: 1,
        school: 0,
        fajr: new Date('2025-09-15T05:00:00'),
        sunrise: new Date('2025-09-15T06:00:00'),
        dhuhr: new Date('2025-09-15T12:00:00'),
        asr: new Date('2025-09-15T15:00:00'),
        maghrib: new Date('2025-09-15T18:00:00'),
        isha: new Date('2025-09-15T19:00:00'),
        source: 'aladhan',
      });
      (prismaService as any).prayerTimes.create.mockResolvedValue({});

      const result = await service.syncPrayerTimesForMethod(
        23.8103,
        90.4125,
        1,
        0,
        {} // No dateRange provided
      );

      expect(result.success).toBe(true);
      expect(result.recordsProcessed).toBe(1); // Should be 1 day, not 15
    });
  });

  describe('idempotency', () => {
    it('should handle duplicate records gracefully', async () => {
      const mockLocation = { lat: 23.8103, lng: 90.4125 };
      const mockMethod = { id: 1, methodCode: 'MWL' };

      (prismaService as any).prayerCalculationMethod.findUnique.mockResolvedValue(mockMethod);
      (prismaService as any).prayerLocation.upsert.mockResolvedValue({});
      (httpService.get as jest.Mock).mockResolvedValue({
        data: {
          timings: {
            Fajr: '05:00',
            Sunrise: '06:00',
            Dhuhr: '12:00',
            Asr: '15:00',
            Maghrib: '18:00',
            Isha: '19:00',
          },
          date: { readable: '15-09-2025' },
        },
      });
      (mapper.mapPrayerTimesFromUpstream as jest.Mock).mockReturnValue({
        locKey: 'test-key',
        date: '2025-09-15',
        method: 1,
        school: 0,
        fajr: new Date('2025-09-15T05:00:00'),
        sunrise: new Date('2025-09-15T06:00:00'),
        dhuhr: new Date('2025-09-15T12:00:00'),
        asr: new Date('2025-09-15T15:00:00'),
        maghrib: new Date('2025-09-15T18:00:00'),
        isha: new Date('2025-09-15T19:00:00'),
        source: 'aladhan',
      });

      // Mock successful creation for both calls
      (prismaService as any).prayerTimes.create.mockResolvedValue({});

      const result1 = await service.syncPrayerTimesForMethod(
        23.8103,
        90.4125,
        1,
        0,
        { force: true }
      );

      const result2 = await service.syncPrayerTimesForMethod(
        23.8103,
        90.4125,
        1,
        0,
        { force: true }
      );

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.recordsProcessed).toBe(1);
      expect(result2.recordsProcessed).toBe(1);
    });
  });
});