import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { CommonHttpService } from '../common/common.module';
import { PrayerMapper } from './prayer.mapper';
import { generateLocationKey } from '../common/utils/hash.util';

@Injectable()
export class PrayerService {
  private readonly logger = new Logger(PrayerService.name);
  private readonly upstreamBaseUrl = 'https://api.aladhan.com/v1';

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: CommonHttpService,
    private readonly mapper: PrayerMapper,
  ) {}

  async getCalculationMethods() {
    try {
      const methods = await (this.prisma as any).prayerCalculationMethod.findMany({
        select: {
          id: true,
          methodName: true,
          methodCode: true,
          description: true,
          fajrAngle: true,
          ishaAngle: true,
          ishaInterval: true,
          maghribAngle: true,
          midnightMode: true,
          createdAt: true,
        },
        orderBy: {
          methodName: 'asc',
        },
      });

      if (methods.length === 0) {
        this.logger.warn('No calculation methods found in database, falling back to upstream API');
        return await this.fallbackToUpstream('methods', {});
      }

      return {
        code: 200,
        status: 'Success',
        data: methods,
      };
    } catch (error) {
      this.logger.error(`Failed to get calculation methods from database: ${error.message}`);
      return await this.fallbackToUpstream('methods', {});
    }
  }

  async getCalculationMethod(methodCode: string) {
    try {
      const method = await (this.prisma as any).prayerCalculationMethod.findUnique({
        where: { methodCode },
        select: {
          id: true,
          methodName: true,
          methodCode: true,
          description: true,
          fajrAngle: true,
          ishaAngle: true,
          ishaInterval: true,
          maghribAngle: true,
          midnightMode: true,
          createdAt: true,
        },
      });

      if (!method) {
        this.logger.warn(`Calculation method ${methodCode} not found in database, falling back to upstream API`);
        return await this.fallbackToUpstream('method', { methodCode });
      }

      return {
        code: 200,
        status: 'Success',
        data: method,
      };
    } catch (error) {
      this.logger.error(`Failed to get calculation method ${methodCode} from database: ${error.message}`);
      return await this.fallbackToUpstream('method', { methodCode });
    }
  }

  async getLocations() {
    try {
      const locations = await (this.prisma as any).prayerLocation.findMany({
        select: {
          id: true,
          locKey: true,
          lat: true,
          lng: true,
          city: true,
          country: true,
          timezone: true,
          elevation: true,
          createdAt: true,
        },
        orderBy: {
          city: 'asc',
        },
      });

      if (locations.length === 0) {
        this.logger.warn('No locations found in database, falling back to upstream API');
        return await this.fallbackToUpstream('locations', {});
      }

      return {
        code: 200,
        status: 'Success',
        data: locations,
      };
    } catch (error) {
      this.logger.error(`Failed to get locations from database: ${error.message}`);
      return await this.fallbackToUpstream('locations', {});
    }
  }

  async getLocation(locKey: string) {
    try {
      const location = await (this.prisma as any).prayerLocation.findUnique({
        where: { locKey },
        select: {
          id: true,
          locKey: true,
          lat: true,
          lng: true,
          city: true,
          country: true,
          timezone: true,
          elevation: true,
          createdAt: true,
        },
      });

      if (!location) {
        this.logger.warn(`Location ${locKey} not found in database, falling back to upstream API`);
        return await this.fallbackToUpstream('location', { locKey });
      }

      return {
        code: 200,
        status: 'Success',
        data: location,
      };
    } catch (error) {
      this.logger.error(`Failed to get location ${locKey} from database: ${error.message}`);
      return await this.fallbackToUpstream('location', { locKey });
    }
  }

  async saveLocation(location: {
    lat: number;
    lng: number;
    city?: string;
    country?: string;
    timezone?: string;
    elevation?: number;
  }) {
    const locKey = generateLocationKey(location.lat, location.lng);
    
    return (this.prisma as any).prayerLocation.upsert({
      where: { locKey },
      update: {
        city: location.city,
        country: location.country,
        timezone: location.timezone,
        elevation: location.elevation || 0,
      },
      create: {
        locKey,
        lat: location.lat,
        lng: location.lng,
        city: location.city,
        country: location.country,
        timezone: location.timezone,
        elevation: location.elevation || 0,
      },
    });
  }

  async getPrayerTimes(
    locKey: string,
    date: Date,
    method: number = 1,
    school: number = 0,
  ) {
    try {
      const prayerTimes = await (this.prisma as any).prayerTimes.findUnique({
        where: {
          locKey_date_method_school: {
            locKey,
            date,
            method,
            school,
          },
        },
        select: {
          id: true,
          locKey: true,
          date: true,
          method: true,
          school: true,
          fajr: true,
          sunrise: true,
          dhuhr: true,
          asr: true,
          maghrib: true,
          isha: true,
          imsak: true,
          midnight: true,
          qiblaDirection: true,
          source: true,
          lastSynced: true,
          createdAt: true,
        },
      });

      if (!prayerTimes) {
        this.logger.warn(`Prayer times not found for ${locKey} on ${date}, falling back to upstream API`);
        return await this.fallbackToUpstream('timings', { locKey, date, method, school });
      }

      return {
        code: 200,
        status: 'Success',
        data: prayerTimes,
      };
    } catch (error) {
      this.logger.error(`Failed to get prayer times from database: ${error.message}`);
      return await this.fallbackToUpstream('timings', { locKey, date, method, school });
    }
  }

  async savePrayerTimes(prayerTimes: {
    locKey: string;
    date: Date;
    method: number;
    school: number;
    fajr: Date;
    sunrise: Date;
    dhuhr: Date;
    asr: Date;
    maghrib: Date;
    isha: Date;
    imsak?: Date;
    midnight?: Date;
    qiblaDirection?: number;
    source: string;
    rawResponse?: any;
  }) {
    return (this.prisma as any).prayerTimes.upsert({
      where: {
        locKey_date_method_school: {
          locKey: prayerTimes.locKey,
          date: prayerTimes.date,
          method: prayerTimes.method,
          school: prayerTimes.school,
        },
      },
      update: {
        fajr: prayerTimes.fajr,
        sunrise: prayerTimes.sunrise,
        dhuhr: prayerTimes.dhuhr,
        asr: prayerTimes.asr,
        maghrib: prayerTimes.maghrib,
        isha: prayerTimes.isha,
        imsak: prayerTimes.imsak,
        midnight: prayerTimes.midnight,
        qiblaDirection: prayerTimes.qiblaDirection,
        source: prayerTimes.source,
        rawResponse: prayerTimes.rawResponse,
        lastSynced: new Date(),
      },
      create: {
        locKey: prayerTimes.locKey,
        date: prayerTimes.date,
        method: prayerTimes.method,
        school: prayerTimes.school,
        fajr: prayerTimes.fajr,
        sunrise: prayerTimes.sunrise,
        dhuhr: prayerTimes.dhuhr,
        asr: prayerTimes.asr,
        maghrib: prayerTimes.maghrib,
        isha: prayerTimes.isha,
        imsak: prayerTimes.imsak,
        midnight: prayerTimes.midnight,
        qiblaDirection: prayerTimes.qiblaDirection,
        source: prayerTimes.source,
        rawResponse: prayerTimes.rawResponse,
      },
    });
  }

  async getMonthlyPrayerTimes(
    locKey: string,
    year: number,
    month: number,
    method: number = 1,
    school: number = 0,
    lat?: number,
    lng?: number,
    latitudeAdjustmentMethod?: number,
    tune?: string,
    timezonestring?: string,
  ) {
    try {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const prayerTimes = await (this.prisma as any).prayerTimes.findMany({
        where: {
          locKey,
          method,
          school,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        select: {
          id: true,
          date: true,
          fajr: true,
          sunrise: true,
          dhuhr: true,
          asr: true,
          maghrib: true,
          isha: true,
          imsak: true,
          midnight: true,
          qiblaDirection: true,
        },
        orderBy: {
          date: 'asc',
        },
      });

      if (prayerTimes.length === 0) {
        this.logger.warn(`No monthly prayer times found for ${locKey} in ${year}-${month}, falling back to upstream API`);
        return await this.fallbackToUpstream('calendar', { locKey, year, month, method, school, lat, lng, latitudeAdjustmentMethod, tune, timezonestring });
      }

      return {
        code: 200,
        status: 'Success',
        data: prayerTimes,
      };
    } catch (error) {
      this.logger.error(`Failed to get monthly prayer times from database: ${error.message}`);
      return await this.fallbackToUpstream('calendar', { locKey, year, month, method, school, lat, lng, latitudeAdjustmentMethod, tune, timezonestring });
    }
  }

  async calculateQiblaDirection(lat: number, lng: number): Promise<number> {
    // Kaaba coordinates
    const kaabaLat = 21.4225;
    const kaabaLng = 39.8262;
    
    // Convert to radians
    const latRad = (lat * Math.PI) / 180;
    const lngRad = (lng * Math.PI) / 180;
    const kaabaLatRad = (kaabaLat * Math.PI) / 180;
    const kaabaLngRad = (kaabaLng * Math.PI) / 180;
    
    // Calculate Qibla direction
    const y = Math.sin(kaabaLngRad - lngRad);
    const x = Math.cos(latRad) * Math.tan(kaabaLatRad) - Math.sin(latRad) * Math.cos(kaabaLngRad - lngRad);
    
    let qiblaDirection = (Math.atan2(y, x) * 180) / Math.PI;
    
    // Normalize to 0-360 degrees
    qiblaDirection = (qiblaDirection + 360) % 360;
    
    return Math.round(qiblaDirection * 1000) / 1000; // Round to 3 decimal places
  }

  async getDailyPrayerTimes(
    lat: number,
    lng: number,
    date: Date = new Date(),
    method: number = 1,
    school: number = 0,
    latitudeAdjustmentMethod?: number,
    tune?: string,
    timezonestring?: string,
  ) {
    try {
      // Generate location key
      const locKey = generateLocationKey(lat, lng);
      
      // Try to get from database first
      let prayerTimes = await this.getPrayerTimes(locKey, date, method, school);
      
      if (!prayerTimes || prayerTimes.code !== 200) {
        // If not in database, fallback to upstream API
        this.logger.warn(`Prayer times not found for ${lat},${lng} on ${date}, falling back to upstream API`);
        return await this.fallbackToUpstream('timings', { lat, lng, date, method, school, latitudeAdjustmentMethod, tune, timezonestring });
      }
      
      return {
        code: 200,
        status: 'Success',
        data: {
          prayerTimes: prayerTimes.data,
          location: { lat, lng },
          method,
          date: date.toISOString().split('T')[0],
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get daily prayer times: ${error.message}`);
      return await this.fallbackToUpstream('timings', { lat, lng, date, method, school, latitudeAdjustmentMethod, tune, timezonestring });
    }
  }

  private async fallbackToUpstream(endpoint: string, params: any) {
    try {
      this.logger.log(`Falling back to upstream API for ${endpoint}`);
      
      let url = `${this.upstreamBaseUrl}`;
      
      switch (endpoint) {
        case 'methods':
          url += '/methods';
          break;
        case 'method':
          url += `/methods/${params.methodCode}`;
          break;
        case 'locations':
          url += '/locations';
          break;
        case 'location':
          url += `/locations/${params.locKey}`;
          break;
        case 'timings': {
          const dateStr = params.date ? params.date.toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
          const qp: string[] = [];
          qp.push(`latitude=${params.lat || 0}`);
          qp.push(`longitude=${params.lng || 0}`);
          qp.push(`method=${params.method || 1}`);
          qp.push(`school=${params.school || 0}`);
          if (typeof params.latitudeAdjustmentMethod === 'number') qp.push(`latitudeAdjustmentMethod=${params.latitudeAdjustmentMethod}`);
          if (params.tune) qp.push(`tune=${encodeURIComponent(params.tune)}`);
          if (params.timezonestring) qp.push(`timezonestring=${encodeURIComponent(params.timezonestring)}`);
          url += `/timings/${dateStr}?${qp.join('&')}`;
          break;
        }
        case 'calendar': {
          const qp: string[] = [];
          qp.push(`latitude=${params.lat || 0}`);
          qp.push(`longitude=${params.lng || 0}`);
          qp.push(`method=${params.method || 1}`);
          qp.push(`school=${params.school || 0}`);
          if (typeof params.latitudeAdjustmentMethod === 'number') qp.push(`latitudeAdjustmentMethod=${params.latitudeAdjustmentMethod}`);
          if (params.tune) qp.push(`tune=${encodeURIComponent(params.tune)}`);
          if (params.timezonestring) qp.push(`timezonestring=${encodeURIComponent(params.timezonestring)}`);
          url += `/calendar/${params.year}/${params.month}?${qp.join('&')}`;
          break;
        }
        default:
          throw new Error(`Unknown endpoint: ${endpoint}`);
      }

      const response = await this.httpService.get(url);
      
      // Add fallback header
      const data = response.data;
      if (data && typeof data === 'object') {
        data._fallback = true;
        data._source = 'upstream';
      }

      return {
        code: 200,
        status: 'Success (Fallback)',
        data: data,
        headers: {
          'X-DeenMate-Source': 'upstream-fallback',
          'X-DeenMate-Cache': 'miss',
        },
      };
    } catch (error) {
      this.logger.error(`Fallback to upstream API failed for ${endpoint}: ${error.message}`);
      
      return {
        code: 503,
        status: 'Service Unavailable',
        message: 'Both local database and upstream API are unavailable',
        error: error.message,
      };
    }
  }

  private calculateMockPrayerTimes(
    date: Date,
    lat: number,
    lng: number,
    method: number,
    school: number,
  ) {
    // Mock calculation - this will be replaced with actual prayer time calculation
    const baseTime = new Date(date);
    baseTime.setHours(0, 0, 0, 0);
    
    return {
      fajr: new Date(baseTime.getTime() + 5 * 60 * 60 * 1000), // 5:00 AM
      sunrise: new Date(baseTime.getTime() + 6 * 60 * 60 * 1000), // 6:00 AM
      dhuhr: new Date(baseTime.getTime() + 12 * 60 * 60 * 1000), // 12:00 PM
      asr: new Date(baseTime.getTime() + 15 * 60 * 60 * 1000), // 3:00 PM
      maghrib: new Date(baseTime.getTime() + 18 * 60 * 60 * 1000), // 6:00 PM
      isha: new Date(baseTime.getTime() + 19 * 60 * 60 * 1000), // 7:00 PM
      imsak: new Date(baseTime.getTime() + 4 * 60 * 60 * 1000), // 4:00 AM
      midnight: new Date(baseTime.getTime() + 24 * 60 * 60 * 1000), // 12:00 AM next day
    };
  }
}
