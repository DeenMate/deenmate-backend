import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { PrayerSyncService } from './prayer.sync.service';

export interface PrerequisiteCheckResult {
  isValid: boolean;
  missingPrerequisites: string[];
  autoFixable: boolean;
  message: string;
}

@Injectable()
export class PrayerPrerequisitesService {
  private readonly logger = new Logger(PrayerPrerequisitesService.name);

  constructor(
    private prisma: PrismaService,
    private prayerSyncService: PrayerSyncService,
  ) {}

  async checkPrerequisites(): Promise<PrerequisiteCheckResult> {
    const missingPrerequisites: string[] = [];
    let autoFixable = true;

    try {
      // Check if prayer calculation methods exist
      const methodCount = await this.prisma.prayerCalculationMethod.count();
      if (methodCount === 0) {
        missingPrerequisites.push('Prayer calculation methods');
      }

      // Check if we have at least one prayer location
      const locationCount = await this.prisma.prayerLocation.count();
      if (locationCount === 0) {
        missingPrerequisites.push('Prayer locations');
      }

      // Check if we have madhab data (schools)
      const schoolCount = await this.prisma.prayerCalculationMethod.count({
        where: {
          OR: [
            { methodCode: 'MWL' },
            { methodCode: 'ISNA' },
            { methodCode: 'EGYPT' },
            { methodCode: 'MAKKAH' },
            { methodCode: 'KARACHI' },
            { methodCode: 'TEHRAN' },
            { methodCode: 'JAFARI' },
          ],
        },
      });
      if (schoolCount < 3) {
        missingPrerequisites.push('Prayer calculation methods (need at least 3)');
      }

      const isValid = missingPrerequisites.length === 0;
      const message = isValid
        ? 'All prerequisites are met for prayer sync'
        : `Missing prerequisites: ${missingPrerequisites.join(', ')}`;

      return {
        isValid,
        missingPrerequisites,
        autoFixable,
        message,
      };
    } catch (error) {
      this.logger.error('Failed to check prayer prerequisites:', error);
      return {
        isValid: false,
        missingPrerequisites: ['Error checking prerequisites'],
        autoFixable: false,
        message: `Error checking prerequisites: ${error.message}`,
      };
    }
  }

  async fixPrerequisites(): Promise<{
    success: boolean;
    message: string;
    results: any[];
  }> {
    const results: any[] = [];
    let success = true;
    let message = '';

    try {
      this.logger.log('Starting prayer prerequisites auto-fix...');

      // Fix prayer calculation methods
      try {
        const methodsResult = await this.prayerSyncService.syncCalculationMethods({
          force: true,
        });
        results.push({
          type: 'calculation_methods',
          result: methodsResult,
        });
        this.logger.log('Prayer calculation methods synced successfully');
      } catch (error) {
        this.logger.error('Failed to sync prayer calculation methods:', error);
        results.push({
          type: 'calculation_methods',
          error: error.message,
        });
        success = false;
      }

      // Fix prayer locations by syncing major cities
      try {
        const majorCities = [
          { name: 'Mecca', lat: 21.4225, lng: 39.8262 },
          { name: 'Medina', lat: 24.5247, lng: 39.5692 },
          { name: 'Istanbul', lat: 41.0082, lng: 28.9784 },
          { name: 'Cairo', lat: 30.0444, lng: 31.2357 },
          { name: 'Jakarta', lat: -6.2088, lng: 106.8456 },
          { name: 'Lahore', lat: 31.5204, lng: 74.3587 },
          { name: 'Tehran', lat: 35.6892, lng: 51.389 },
          { name: 'Dubai', lat: 25.2048, lng: 55.2708 },
          { name: 'Kuala Lumpur', lat: 3.139, lng: 101.6869 },
          { name: 'London', lat: 51.5074, lng: -0.1278 },
          { name: 'New York', lat: 40.7128, lng: -74.006 },
          { name: 'Toronto', lat: 43.6532, lng: -79.3832 },
          { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
        ];

        const locationResults = [];
        for (const city of majorCities) {
          try {
            const result = await this.prayerSyncService.syncPrayerTimes(
              city.lat,
              city.lng,
              {
                force: true,
                dateRange: {
                  start: new Date(),
                  end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
                },
              },
            );
            locationResults.push({
              city: city.name,
              result,
            });
          } catch (error) {
            this.logger.warn(`Failed to sync location ${city.name}:`, error);
            locationResults.push({
              city: city.name,
              error: error.message,
            });
          }
        }

        results.push({
          type: 'locations',
          results: locationResults,
        });
        this.logger.log('Prayer locations synced successfully');
      } catch (error) {
        this.logger.error('Failed to sync prayer locations:', error);
        results.push({
          type: 'locations',
          error: error.message,
        });
        success = false;
      }

      message = success
        ? 'All prayer prerequisites fixed successfully'
        : 'Some prayer prerequisites failed to fix';

      this.logger.log(`Prayer prerequisites auto-fix completed: ${message}`);
      return { success, message, results };
    } catch (error) {
      this.logger.error('Failed to fix prayer prerequisites:', error);
      return {
        success: false,
        message: `Failed to fix prerequisites: ${error.message}`,
        results,
      };
    }
  }

  async validateAndFixPrerequisites(): Promise<{
    success: boolean;
    message: string;
    wasFixed: boolean;
    results?: any[];
  }> {
    try {
      // First check prerequisites
      const checkResult = await this.checkPrerequisites();

      if (checkResult.isValid) {
        return {
          success: true,
          message: 'All prerequisites are already met',
          wasFixed: false,
        };
      }

      if (!checkResult.autoFixable) {
        return {
          success: false,
          message: checkResult.message,
          wasFixed: false,
        };
      }

      // Auto-fix prerequisites
      const fixResult = await this.fixPrerequisites();

      return {
        success: fixResult.success,
        message: fixResult.message,
        wasFixed: true,
        results: fixResult.results,
      };
    } catch (error) {
      this.logger.error('Failed to validate and fix prerequisites:', error);
      return {
        success: false,
        message: `Failed to validate and fix prerequisites: ${error.message}`,
        wasFixed: false,
      };
    }
  }
}
