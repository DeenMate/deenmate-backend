import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { firstValueFrom } from 'rxjs';

export interface PrayerTimings {
  code: number;
  status: string;
  data: {
    timings: {
      Fajr: string;
      Sunrise: string;
      Dhuhr: string;
      Asr: string;
      Sunset: string;
      Maghrib: string;
      Isha: string;
      Imsak: string;
      Midnight: string;
      Firstthird: string;
      Lastthird: string;
    };
    date: {
      readable: string;
      timestamp: string;
      gregorian: {
        date: string;
        format: string;
        day: string;
        weekday: {
          en: string;
          ar: string;
        };
        month: {
          number: number;
          en: string;
          ar: string;
        };
        year: string;
      };
      hijri: {
        date: string;
        format: string;
        day: string;
        weekday: {
          en: string;
          ar: string;
        };
        month: {
          number: number;
          en: string;
          ar: string;
        };
        year: string;
      };
    };
    meta: {
      latitude: number;
      longitude: number;
      timezone: string;
      method: {
        id: number;
        name: string;
        params: {
          Fajr: number;
          Isha: number;
        };
        location: {
          latitude: number;
          longitude: number;
        };
      };
      latitudeAdjustmentMethod: string;
      midnightMode: string;
      school: string;
      offset: Record<string, number>;
    };
  };
}

export interface PrayerCalendar {
  code: number;
  status: string;
  data: PrayerTimings[];
}

export interface QiblaDirection {
  code: number;
  status: string;
  data: {
    direction: number;
    qibla_degrees: number;
  };
}

export interface PrayerMethods {
  code: number;
  status: string;
  data: {
    id: number;
    name: string;
    params: {
      Fajr: number;
      Isha: number;
    };
    location: {
      latitude: number;
      longitude: number;
    };
  }[];
}

@Injectable()
export class PrayerService {
  private readonly logger = new Logger(PrayerService.name);
  private readonly prayerApiBase: string;
  private readonly cacheEnabled: boolean;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.prayerApiBase = this.configService.get<string>('PRAYER_API_BASE', 'https://api.aladhan.com/v1');
    this.cacheEnabled = this.configService.get<boolean>('REDIS_ENABLED', false);
    this.logger.log(`Prayer API Base: ${this.prayerApiBase}`);
  }

  /**
   * Get prayer timings by coordinates
   */
  async getTimings(
    latitude: number,
    longitude: number,
    date?: string,
    method?: number,
    school?: number,
    latitudeAdjustmentMethod?: number,
    midnightMode?: number,
    timezonestring?: string,
    adjustments?: number,
    iso8601?: boolean,
  ): Promise<{ data: PrayerTimings; source: string }> {
    const cacheKey = `prayer:timings:${latitude}:${longitude}:${date || 'today'}:${method || 1}:${school || 1}:${latitudeAdjustmentMethod || 3}:${midnightMode || 0}:${timezonestring || 'auto'}:${adjustments || 0}:${iso8601 || false}`;
    
    try {
      // Check cache first if enabled
      if (this.cacheEnabled) {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          this.logger.log(`Returning prayer timings for ${latitude},${longitude} from cache`);
          return { data: JSON.parse(cached), source: 'cache' };
        }
      }

      // Build query parameters
      const params = new URLSearchParams();
      params.append('latitude', latitude.toString());
      params.append('longitude', longitude.toString());
      if (date) params.append('date', date);
      if (method) params.append('method', method.toString());
      if (school) params.append('school', school.toString());
      if (latitudeAdjustmentMethod) params.append('latitudeAdjustmentMethod', latitudeAdjustmentMethod.toString());
      if (midnightMode) params.append('midnightMode', midnightMode.toString());
      if (timezonestring) params.append('timezonestring', timezonestring);
      if (adjustments) params.append('adjustments', adjustments.toString());
      if (iso8601) params.append('iso8601', iso8601.toString());

      const url = `${this.prayerApiBase}/timings?${params.toString()}`;
      
      // Fetch from upstream API
      this.logger.log(`Fetching prayer timings for ${latitude},${longitude} from upstream API`);
      const response = await firstValueFrom(
        this.httpService.get(url)
      );

      const timings = response.data;
      
      // Cache the response if enabled (shorter TTL for prayer times)
      if (this.cacheEnabled) {
        const ttl = this.getPrayerTimeCacheTTL(date);
        await this.redisService.set(cacheKey, JSON.stringify(timings));
      }

      this.logger.log(`Fetched prayer timings for ${latitude},${longitude} from upstream`);
      return { data: timings, source: 'upstream' };
    } catch (error) {
      this.logger.error(`Error fetching prayer timings for ${latitude},${longitude}:`, error.message);
      throw new HttpException(
        'Failed to fetch prayer timings',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get prayer timings by city
   */
  async getTimingsByCity(
    city: string,
    country: string,
    state?: string,
    date?: string,
    method?: number,
    school?: number,
    latitudeAdjustmentMethod?: number,
    midnightMode?: number,
    timezonestring?: string,
    adjustments?: number,
    iso8601?: boolean,
  ): Promise<{ data: PrayerTimings; source: string }> {
    const cacheKey = `prayer:timingsByCity:${city}:${country}:${state || 'none'}:${date || 'today'}:${method || 1}:${school || 1}:${latitudeAdjustmentMethod || 3}:${midnightMode || 0}:${timezonestring || 'auto'}:${adjustments || 0}:${iso8601 || false}`;
    
    try {
      // Check cache first if enabled
      if (this.cacheEnabled) {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          this.logger.log(`Returning prayer timings for ${city},${country} from cache`);
          return { data: JSON.parse(cached), source: 'cache' };
        }
      }

      // Build query parameters
      const params = new URLSearchParams();
      params.append('city', city);
      params.append('country', country);
      if (state) params.append('state', state);
      if (date) params.append('date', date);
      if (method) params.append('method', method.toString());
      if (school) params.append('school', school.toString());
      if (latitudeAdjustmentMethod) params.append('latitudeAdjustmentMethod', latitudeAdjustmentMethod.toString());
      if (midnightMode) params.append('midnightMode', midnightMode.toString());
      if (timezonestring) params.append('timezonestring', timezonestring);
      if (adjustments) params.append('adjustments', adjustments.toString());
      if (iso8601) params.append('iso8601', iso8601.toString());

      const url = `${this.prayerApiBase}/timingsByCity?${params.toString()}`;
      
      // Fetch from upstream API
      this.logger.log(`Fetching prayer timings for ${city},${country} from upstream API`);
      const response = await firstValueFrom(
        this.httpService.get(url)
      );

      const timings = response.data;
      
      // Cache the response if enabled (shorter TTL for prayer times)
      if (this.cacheEnabled) {
        const ttl = this.getPrayerTimeCacheTTL(date);
        await this.redisService.set(cacheKey, JSON.stringify(timings));
      }

      this.logger.log(`Fetched prayer timings for ${city},${country} from upstream`);
      return { data: timings, source: 'upstream' };
    } catch (error) {
      this.logger.error(`Error fetching prayer timings for ${city},${country}:`, error.message);
      throw new HttpException(
        'Failed to fetch prayer timings by city',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get prayer calendar by coordinates
   */
  async getCalendar(
    latitude: number,
    longitude: number,
    month: number,
    year: number,
    method?: number,
    school?: number,
    latitudeAdjustmentMethod?: number,
    midnightMode?: number,
    timezonestring?: string,
    adjustments?: number,
    iso8601?: boolean,
  ): Promise<{ data: PrayerCalendar; source: string }> {
    const cacheKey = `prayer:calendar:${latitude}:${longitude}:${month}:${year}:${method || 1}:${school || 1}:${latitudeAdjustmentMethod || 3}:${midnightMode || 0}:${timezonestring || 'auto'}:${adjustments || 0}:${iso8601 || false}`;
    
    try {
      // Check cache first if enabled
      if (this.cacheEnabled) {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          this.logger.log(`Returning prayer calendar for ${month}/${year} at ${latitude},${longitude} from cache`);
          return { data: JSON.parse(cached), source: 'cache' };
        }
      }

      // Build query parameters
      const params = new URLSearchParams();
      params.append('latitude', latitude.toString());
      params.append('longitude', longitude.toString());
      params.append('month', month.toString());
      params.append('year', year.toString());
      if (method) params.append('method', method.toString());
      if (school) params.append('school', school.toString());
      if (latitudeAdjustmentMethod) params.append('latitudeAdjustmentMethod', latitudeAdjustmentMethod.toString());
      if (midnightMode) params.append('midnightMode', midnightMode.toString());
      if (timezonestring) params.append('timezonestring', timezonestring);
      if (adjustments) params.append('adjustments', adjustments.toString());
      if (iso8601) params.append('iso8601', iso8601.toString());

      const url = `${this.prayerApiBase}/calendar?${params.toString()}`;
      
      // Fetch from upstream API
      this.logger.log(`Fetching prayer calendar for ${month}/${year} at ${latitude},${longitude} from upstream API`);
      const response = await firstValueFrom(
        this.httpService.get(url)
      );

      const calendar = response.data;
      
      // Cache the response if enabled (longer TTL for calendar data)
      if (this.cacheEnabled) {
        await this.redisService.set(cacheKey, JSON.stringify(calendar), 86400); // 24 hours
      }

      this.logger.log(`Fetched prayer calendar for ${month}/${year} at ${latitude},${longitude} from upstream`);
      return { data: calendar, source: 'upstream' };
    } catch (error) {
      this.logger.error(`Error fetching prayer calendar for ${month}/${year} at ${latitude},${longitude}:`, error.message);
      throw new HttpException(
        'Failed to fetch prayer calendar',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get prayer calendar by city
   */
  async getCalendarByCity(
    city: string,
    country: string,
    state: string,
    month: number,
    year: number,
    method?: number,
    school?: number,
    latitudeAdjustmentMethod?: number,
    midnightMode?: number,
    timezonestring?: string,
    adjustments?: number,
    iso8601?: boolean,
  ): Promise<{ data: PrayerCalendar; source: string }> {
    const cacheKey = `prayer:calendarByCity:${city}:${country}:${state}:${month}:${year}:${method || 1}:${school || 1}:${latitudeAdjustmentMethod || 3}:${midnightMode || 0}:${timezonestring || 'auto'}:${adjustments || 0}:${iso8601 || false}`;
    
    try {
      // Check cache first if enabled
      if (this.cacheEnabled) {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          this.logger.log(`Returning prayer calendar for ${city},${country} ${month}/${year} from cache`);
          return { data: JSON.parse(cached), source: 'cache' };
        }
      }

      // Build query parameters
      const params = new URLSearchParams();
      params.append('city', city);
      params.append('country', country);
      params.append('state', state);
      params.append('month', month.toString());
      params.append('year', year.toString());
      if (method) params.append('method', method.toString());
      if (school) params.append('school', school.toString());
      if (latitudeAdjustmentMethod) params.append('latitudeAdjustmentMethod', latitudeAdjustmentMethod.toString());
      if (midnightMode) params.append('midnightMode', midnightMode.toString());
      if (timezonestring) params.append('timezonestring', timezonestring);
      if (adjustments) params.append('adjustments', adjustments.toString());
      if (iso8601) params.append('iso8601', iso8601.toString());

      const url = `${this.prayerApiBase}/calendarByCity?${params.toString()}`;
      
      // Fetch from upstream API
      this.logger.log(`Fetching prayer calendar for ${city},${country} ${month}/${year} from upstream API`);
      const response = await firstValueFrom(
        this.httpService.get(url)
      );

      const calendar = response.data;
      
      // Cache the response if enabled (longer TTL for calendar data)
      if (this.cacheEnabled) {
        await this.redisService.set(cacheKey, JSON.stringify(calendar), 86400); // 24 hours
      }

      this.logger.log(`Fetched prayer calendar for ${city},${country} ${month}/${year} from upstream`);
      return { data: calendar, source: 'upstream' };
    } catch (error) {
      this.logger.error(`Error fetching prayer calendar for ${city},${country} ${month}/${year}:`, error.message);
      throw new HttpException(
        'Failed to fetch prayer calendar by city',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get qibla direction
   */
  async getQibla(
    latitude: number,
    longitude: number,
  ): Promise<{ data: QiblaDirection; source: string }> {
    const cacheKey = `prayer:qibla:${latitude}:${longitude}`;
    
    try {
      // Check cache first if enabled
      if (this.cacheEnabled) {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          this.logger.log(`Returning qibla direction for ${latitude},${longitude} from cache`);
          return { data: JSON.parse(cached), source: 'cache' };
        }
      }

      // Build query parameters
      const params = new URLSearchParams();
      params.append('latitude', latitude.toString());
      params.append('longitude', longitude.toString());

      const url = `${this.prayerApiBase}/qibla?${params.toString()}`;
      
      // Fetch from upstream API
      this.logger.log(`Fetching qibla direction for ${latitude},${longitude} from upstream API`);
      const response = await firstValueFrom(
        this.httpService.get(url)
      );

      const qibla = response.data;
      
      // Cache the response if enabled (longer TTL for qibla data)
      if (this.cacheEnabled) {
        await this.redisService.set(cacheKey, JSON.stringify(qibla), 86400); // 24 hours
      }

      this.logger.log(`Fetched qibla direction for ${latitude},${longitude} from upstream`);
      return { data: qibla, source: 'upstream' };
    } catch (error) {
      this.logger.error(`Error fetching qibla direction for ${latitude},${longitude}:`, error.message);
      throw new HttpException(
        'Failed to fetch qibla direction',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get prayer calculation methods
   */
  async getMethods(): Promise<{ data: PrayerMethods; source: string }> {
    const cacheKey = 'prayer:methods';
    
    try {
      // Check cache first if enabled
      if (this.cacheEnabled) {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          this.logger.log('Returning prayer methods from cache');
          return { data: JSON.parse(cached), source: 'cache' };
        }
      }

      // Fetch from upstream API
      this.logger.log('Fetching prayer methods from upstream API');
      const response = await firstValueFrom(
        this.httpService.get(`${this.prayerApiBase}/methods`)
      );

      const methods = response.data;
      
      // Cache the response if enabled (longer TTL for methods data)
      if (this.cacheEnabled) {
        await this.redisService.set(cacheKey, JSON.stringify(methods), 86400); // 24 hours
      }

      this.logger.log(`Fetched prayer methods from upstream`);
      return { data: methods, source: 'upstream' };
    } catch (error) {
      this.logger.error('Error fetching prayer methods:', error.message);
      throw new HttpException(
        'Failed to fetch prayer methods',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get hijri calendar
   */
  async getHijriCalendar(
    month: number,
    year: number,
    baseDate?: string,
    adjustment?: number,
  ): Promise<{ data: any; source: string }> {
    const cacheKey = `prayer:hijriCalendar:${month}:${year}:${baseDate || 'today'}:${adjustment || 0}`;
    
    try {
      // Check cache first if enabled
      if (this.cacheEnabled) {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          this.logger.log(`Returning hijri calendar for ${month}/${year} from cache`);
          return { data: JSON.parse(cached), source: 'cache' };
        }
      }

      // Build query parameters
      const params = new URLSearchParams();
      params.append('month', month.toString());
      params.append('year', year.toString());
      if (baseDate) params.append('baseDate', baseDate);
      if (adjustment) params.append('adjustment', adjustment.toString());

      const url = `${this.prayerApiBase}/hijriCalendar?${params.toString()}`;
      
      // Fetch from upstream API
      this.logger.log(`Fetching hijri calendar for ${month}/${year} from upstream API`);
      const response = await firstValueFrom(
        this.httpService.get(url)
      );

      const hijriCalendar = response.data;
      
      // Cache the response if enabled (longer TTL for calendar data)
      if (this.cacheEnabled) {
        await this.redisService.set(cacheKey, JSON.stringify(hijriCalendar), 86400); // 24 hours
      }

      this.logger.log(`Fetched hijri calendar for ${month}/${year} from upstream`);
      return { data: hijriCalendar, source: 'upstream' };
    } catch (error) {
      this.logger.error(`Error fetching hijri calendar for ${month}/${year}:`, error.message);
      throw new HttpException(
        'Failed to fetch hijri calendar',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get gregorian calendar
   */
  async getGregorianCalendar(
    month: number,
    year: number,
    baseDate?: string,
    adjustment?: number,
  ): Promise<{ data: any; source: string }> {
    const cacheKey = `prayer:gregorianCalendar:${month}:${year}:${baseDate || 'today'}:${adjustment || 0}`;
    
    try {
      // Check cache first if enabled
      if (this.cacheEnabled) {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          this.logger.log(`Returning gregorian calendar for ${month}/${year} from cache`);
          return { data: JSON.parse(cached), source: 'cache' };
        }
      }

      // Build query parameters
      const params = new URLSearchParams();
      params.append('month', month.toString());
      params.append('year', year.toString());
      if (baseDate) params.append('baseDate', baseDate);
      if (adjustment) params.append('adjustment', adjustment.toString());

      const url = `${this.prayerApiBase}/gregorianCalendar?${params.toString()}`;
      
      // Fetch from upstream API
      this.logger.log(`Fetching gregorian calendar for ${month}/${year} from upstream API`);
      const response = await firstValueFrom(
        this.httpService.get(url)
      );

      const gregorianCalendar = response.data;
      
      // Cache the response if enabled (longer TTL for calendar data)
      if (this.cacheEnabled) {
        await this.redisService.set(cacheKey, JSON.stringify(gregorianCalendar), 86400); // 24 hours
      }

      this.logger.log(`Fetched gregorian calendar for ${month}/${year} from upstream`);
      return { data: gregorianCalendar, source: 'upstream' };
    } catch (error) {
      this.logger.error(`Error fetching gregorian calendar for ${month}/${year}:`, error.message);
      throw new HttpException(
        'Failed to fetch gregorian calendar',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get current time
   */
  async getCurrentTime(): Promise<{ data: any; source: string }> {
    const cacheKey = 'prayer:currentTime';
    
    try {
      // Check cache first if enabled
      if (this.cacheEnabled) {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          this.logger.log('Returning current time from cache');
          return { data: JSON.parse(cached), source: 'cache' };
        }
      }

      // Fetch from upstream API
      this.logger.log('Fetching current time from upstream API');
      const response = await firstValueFrom(
        this.httpService.get(`${this.prayerApiBase}/currentTime`)
      );

      const currentTime = response.data;
      
      // Cache the response if enabled (shorter TTL for current time)
      if (this.cacheEnabled) {
        await this.redisService.set(cacheKey, JSON.stringify(currentTime), 60); // 1 minute
      }

      this.logger.log('Fetched current time from upstream');
      return { data: currentTime, source: 'upstream' };
    } catch (error) {
      this.logger.error('Error fetching current time:', error.message);
      throw new HttpException(
        'Failed to fetch current time',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get date conversion
   */
  async getDateConversion(
    date: string,
    from: 'gregorian' | 'hijri',
    to: 'gregorian' | 'hijri',
    adjustment?: number,
  ): Promise<{ data: any; source: string }> {
    const cacheKey = `prayer:dateConversion:${date}:${from}:${to}:${adjustment || 0}`;
    
    try {
      // Check cache first if enabled
      if (this.cacheEnabled) {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          this.logger.log(`Returning date conversion for ${date} from cache`);
          return { data: JSON.parse(cached), source: 'cache' };
        }
      }

      // Build query parameters
      const params = new URLSearchParams();
      params.append('date', date);
      params.append('from', from);
      params.append('to', to);
      if (adjustment) params.append('adjustment', adjustment.toString());

      const url = `${this.prayerApiBase}/dateConversion?${params.toString()}`;
      
      // Fetch from upstream API
      this.logger.log(`Fetching date conversion for ${date} from upstream API`);
      const response = await firstValueFrom(
        this.httpService.get(url)
      );

      const dateConversion = response.data;
      
      // Cache the response if enabled (longer TTL for conversion data)
      if (this.cacheEnabled) {
        await this.redisService.set(cacheKey, JSON.stringify(dateConversion), 86400); // 24 hours
      }

      this.logger.log(`Fetched date conversion for ${date} from upstream`);
      return { data: dateConversion, source: 'upstream' };
    } catch (error) {
      this.logger.error(`Error fetching date conversion for ${date}:`, error.message);
      throw new HttpException(
        'Failed to fetch date conversion',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Helper method to determine cache TTL for prayer times
   */
  private getPrayerTimeCacheTTL(date?: string): number {
    if (!date) {
      // For today's prayer times, cache until next prayer time
      const now = new Date();
      const currentHour = now.getHours();
      
      // Approximate prayer times (simplified)
      if (currentHour < 5) return 3600; // Until Fajr
      if (currentHour < 12) return 3600; // Until Dhuhr
      if (currentHour < 15) return 3600; // Until Asr
      if (currentHour < 18) return 3600; // Until Maghrib
      if (currentHour < 20) return 3600; // Until Isha
      return 3600; // Until next day
    }
    
    // For specific dates, cache until midnight
    const targetDate = new Date(date);
    const now = new Date();
    const midnight = new Date(targetDate);
    midnight.setHours(24, 0, 0, 0);
    
    return Math.floor((midnight.getTime() - now.getTime()) / 1000);
  }
}
