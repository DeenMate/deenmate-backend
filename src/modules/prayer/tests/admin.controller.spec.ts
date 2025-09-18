import { Test, TestingModule } from '@nestjs/testing';
import { AdminController } from '../../admin/admin.controller';
import { AdminService } from '../../admin/admin.service';
import { JwtAuthGuard } from '../../admin/guards/jwt-auth.guard';

describe('AdminController - Prayer Sync', () => {
  let controller: AdminController;
  let adminService: AdminService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [
        {
          provide: AdminService,
          useValue: {
            syncPrayerTimesForLocation: jest.fn(),
            prewarmPrayerTimes: jest.fn(),
            triggerPrayerSync: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminController>(AdminController);
    adminService = module.get<AdminService>(AdminService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('syncPrayerTimes', () => {
    it('should sync exactly 1 day when days=1', async () => {
      const mockResult = {
        success: true,
        message: 'Prayer times sync completed',
        data: {
          success: true,
          resource: 'times',
          recordsProcessed: 1,
          recordsInserted: 1,
          recordsUpdated: 0,
          recordsFailed: 0,
          errors: [],
          durationMs: 1000,
        },
      };

      (adminService.syncPrayerTimesForLocation as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.syncPrayerTimes(
        '23.8103',
        '90.4125',
        'MWL',
        '0',
        '1',
        'false'
      );

      expect(result.success).toBe(true);
      expect((result.data as any)?.data?.recordsProcessed).toBe(1);
      expect(adminService.syncPrayerTimesForLocation).toHaveBeenCalledWith(
        23.8103,
        90.4125,
        'MWL',
        0,
        1,
        false
      );
    });

    it('should sync exactly 7 days when days=7', async () => {
      const mockResult = {
        success: true,
        message: 'Prayer times sync completed',
        data: {
          success: true,
          resource: 'times',
          recordsProcessed: 7,
          recordsInserted: 7,
          recordsUpdated: 0,
          recordsFailed: 0,
          errors: [],
          durationMs: 2000,
        },
      };

      (adminService.syncPrayerTimesForLocation as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.syncPrayerTimes(
        '23.8103',
        '90.4125',
        'MWL',
        '0',
        '7',
        'false'
      );

      expect(result.success).toBe(true);
      expect((result.data as any)?.data?.recordsProcessed).toBe(7);
      expect(adminService.syncPrayerTimesForLocation).toHaveBeenCalledWith(
        23.8103,
        90.4125,
        'MWL',
        0,
        7,
        false
      );
    });

    it('should handle force=true parameter', async () => {
      const mockResult = {
        success: true,
        message: 'Prayer times sync completed',
        data: {
          success: true,
          resource: 'times',
          recordsProcessed: 1,
          recordsInserted: 1,
          recordsUpdated: 0,
          recordsFailed: 0,
          errors: [],
          durationMs: 1000,
        },
      };

      (adminService.syncPrayerTimesForLocation as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.syncPrayerTimes(
        '23.8103',
        '90.4125',
        'MWL',
        '0',
        '1',
        'true'
      );

      expect(result.success).toBe(true);
      expect(adminService.syncPrayerTimesForLocation).toHaveBeenCalledWith(
        23.8103,
        90.4125,
        'MWL',
        0,
        1,
        true
      );
    });

    it('should handle different school parameters', async () => {
      const mockResult = {
        success: true,
        message: 'Prayer times sync completed',
        data: {
          success: true,
          resource: 'times',
          recordsProcessed: 1,
          recordsInserted: 1,
          recordsUpdated: 0,
          recordsFailed: 0,
          errors: [],
          durationMs: 1000,
        },
      };

      (adminService.syncPrayerTimesForLocation as jest.Mock).mockResolvedValue(mockResult);

      // Test with school=1 (Hanafi)
      const result = await controller.syncPrayerTimes(
        '23.8103',
        '90.4125',
        'MWL',
        '1',
        '1',
        'false'
      );

      expect(result.success).toBe(true);
      expect(adminService.syncPrayerTimesForLocation).toHaveBeenCalledWith(
        23.8103,
        90.4125,
        'MWL',
        1,
        1,
        false
      );
    });

    it('should handle sync failures gracefully', async () => {
      const mockResult = {
        success: false,
        message: 'Prayer times sync failed: API error',
        data: {
          success: false,
          resource: 'times',
          recordsProcessed: 0,
          recordsInserted: 0,
          recordsUpdated: 0,
          recordsFailed: 1,
          errors: ['API error'],
          durationMs: 500,
        },
      };

      (adminService.syncPrayerTimesForLocation as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.syncPrayerTimes(
        '23.8103',
        '90.4125',
        'MWL',
        '0',
        '1',
        'false'
      );

      expect(result.success).toBe(false);
      expect(result.message).toContain('failed');
    });
  });

  describe('prewarmPrayer', () => {
    it('should prewarm with default 7 days', async () => {
      const mockResult = {
        success: true,
        resource: 'times',
        recordsProcessed: 140, // 20 locations * 7 days
        recordsInserted: 140,
        recordsUpdated: 0,
        recordsFailed: 0,
        errors: [],
        durationMs: 5000,
      };

      (adminService.prewarmPrayerTimes as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.prewarmPrayer();

      expect(result.success).toBe(true);
      expect(adminService.prewarmPrayerTimes).toHaveBeenCalledWith(7);
    });

    it('should prewarm with custom days parameter', async () => {
      const mockResult = {
        success: true,
        resource: 'times',
        recordsProcessed: 60, // 20 locations * 3 days
        recordsInserted: 60,
        recordsUpdated: 0,
        recordsFailed: 0,
        errors: [],
        durationMs: 3000,
      };

      (adminService.prewarmPrayerTimes as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.prewarmPrayer('3');

      expect(result.success).toBe(true);
      expect(adminService.prewarmPrayerTimes).toHaveBeenCalledWith(3);
    });
  });

  describe('triggerPrayerSync', () => {
    it('should trigger prayer sync successfully', async () => {
      const mockResult = {
        success: true,
        message: 'Prayer sync triggered successfully',
      };

      (adminService.triggerPrayerSync as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.triggerPrayerSync();

      expect(result.success).toBe(true);
      expect(result.message).toContain('successfully');
      expect(adminService.triggerPrayerSync).toHaveBeenCalled();
    });

    it('should handle prayer sync failures', async () => {
      const mockResult = {
        success: false,
        message: 'Prayer sync failed: Database error',
      };

      (adminService.triggerPrayerSync as jest.Mock).mockResolvedValue(mockResult);

      const result = await controller.triggerPrayerSync();

      expect(result.success).toBe(false);
      expect(result.message).toContain('failed');
    });
  });
});