import { Controller, Get, Param, Query, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { PrayerService } from '../services/prayer.service';

@Controller('prayer')
export class PrayerController {
  constructor(private readonly prayerService: PrayerService) {}

  /**
   * GET /api/v1/prayer/timings
   * Get prayer timings by coordinates
   */
  @Get('timings')
  async getTimings(
    @Res() res: Response,
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
    @Query('date') date?: string,
    @Query('method') method?: string,
    @Query('school') school?: string,
    @Query('latitudeAdjustmentMethod') latitudeAdjustmentMethod?: string,
    @Query('midnightMode') midnightMode?: string,
    @Query('timezonestring') timezonestring?: string,
    @Query('adjustments') adjustments?: string,
    @Query('iso8601') iso8601?: string,
  ) {
    try {
      if (!latitude || !longitude) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - Latitude and longitude are required',
          data: null
        });
      }

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - Invalid latitude or longitude',
          data: null
        });
      }

      const result = await this.prayerService.getTimings(
        lat,
        lng,
        date,
        method ? parseInt(method, 10) : undefined,
        school ? parseInt(school, 10) : undefined,
        latitudeAdjustmentMethod ? parseInt(latitudeAdjustmentMethod, 10) : undefined,
        midnightMode ? parseInt(midnightMode, 10) : undefined,
        timezonestring,
        adjustments ? parseInt(adjustments, 10) : undefined,
        iso8601 === 'true',
      );
      
      // Add source header for debugging
      res.setHeader('X-DeenMate-Source', result.source);
      
      // Return the exact same structure as upstream API
      return res.status(HttpStatus.OK).json(result.data);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 500,
        status: 'Internal Server Error',
        data: null
      });
    }
  }

  /**
   * GET /api/v1/prayer/timingsByCity
   * Get prayer timings by city
   */
  @Get('timingsByCity')
  async getTimingsByCity(
    @Res() res: Response,
    @Query('city') city: string,
    @Query('country') country: string,
    @Query('state') state?: string,
    @Query('date') date?: string,
    @Query('method') method?: string,
    @Query('school') school?: string,
    @Query('latitudeAdjustmentMethod') latitudeAdjustmentMethod?: string,
    @Query('midnightMode') midnightMode?: string,
    @Query('timezonestring') timezonestring?: string,
    @Query('adjustments') adjustments?: string,
    @Query('iso8601') iso8601?: string,
  ) {
    try {
      if (!city || !country) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - City and country are required',
          data: null
        });
      }

      const result = await this.prayerService.getTimingsByCity(
        city,
        country,
        state,
        date,
        method ? parseInt(method, 10) : undefined,
        school ? parseInt(school, 10) : undefined,
        latitudeAdjustmentMethod ? parseInt(latitudeAdjustmentMethod, 10) : undefined,
        midnightMode ? parseInt(midnightMode, 10) : undefined,
        timezonestring,
        adjustments ? parseInt(adjustments, 10) : undefined,
        iso8601 === 'true',
      );
      
      // Add source header for debugging
      res.setHeader('X-DeenMate-Source', result.source);
      
      // Return the exact same structure as upstream API
      return res.status(HttpStatus.OK).json(result.data);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 500,
        status: 'Internal Server Error',
        data: null
      });
    }
  }

  /**
   * GET /api/v1/prayer/calendar
   * Get prayer calendar by coordinates
   */
  @Get('calendar')
  async getCalendar(
    @Res() res: Response,
    
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('method') method?: string,
    @Query('school') school?: string,
    @Query('latitudeAdjustmentMethod') latitudeAdjustmentMethod?: string,
    @Query('midnightMode') midnightMode?: string,
    @Query('timezonestring') timezonestring?: string,
    @Query('adjustments') adjustments?: string,
    @Query('iso8601') iso8601?: string,
  ) {
    try {
      if (!latitude || !longitude || !month || !year) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - Latitude, longitude, month, and year are required',
          data: null
        });
      }

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);
      
      if (isNaN(lat) || isNaN(lng) || isNaN(monthNum) || isNaN(yearNum)) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - Invalid latitude, longitude, month, or year',
          data: null
        });
      }

      if (monthNum < 1 || monthNum > 12) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - Month must be between 1 and 12',
          data: null
        });
      }

      const result = await this.prayerService.getCalendar(
        lat,
        lng,
        monthNum,
        yearNum,
        method ? parseInt(method, 10) : undefined,
        school ? parseInt(school, 10) : undefined,
        latitudeAdjustmentMethod ? parseInt(latitudeAdjustmentMethod, 10) : undefined,
        midnightMode ? parseInt(midnightMode, 10) : undefined,
        timezonestring,
        adjustments ? parseInt(adjustments, 10) : undefined,
        iso8601 === 'true',
      );
      
      // Add source header for debugging
      res.setHeader('X-DeenMate-Source', result.source);
      
      // Return the exact same structure as upstream API
      return res.status(HttpStatus.OK).json(result.data);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 500,
        status: 'Internal Server Error',
        data: null
      });
    }
  }

  /**
   * GET /api/v1/prayer/calendarByCity
   * Get prayer calendar by city
   */
  @Get('calendarByCity')
  async getCalendarByCity(
    @Res() res: Response,
    @Query('city') city: string,
    @Query('country') country: string,
    @Query('state') state: string,
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('method') method?: string,
    @Query('school') school?: string,
    @Query('latitudeAdjustmentMethod') latitudeAdjustmentMethod?: string,
    @Query('midnightMode') midnightMode?: string,
    @Query('timezonestring') timezonestring?: string,
    @Query('adjustments') adjustments?: string,
    @Query('iso8601') iso8601?: string,
    
  ) {
    try {
      if (!city || !country || !state || !month || !year) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - City, country, state, month, and year are required',
          data: null
        });
      }

      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);
      
      if (isNaN(monthNum) || isNaN(yearNum)) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - Invalid month or year',
          data: null
        });
      }

      if (monthNum < 1 || monthNum > 12) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - Month must be between 1 and 12',
          data: null
        });
      }

      const result = await this.prayerService.getCalendarByCity(
        city,
        country,
        state,
        monthNum,
        yearNum,
        method ? parseInt(method, 10) : undefined,
        school ? parseInt(school, 10) : undefined,
        latitudeAdjustmentMethod ? parseInt(latitudeAdjustmentMethod, 10) : undefined,
        midnightMode ? parseInt(midnightMode, 10) : undefined,
        timezonestring,
        adjustments ? parseInt(adjustments, 10) : undefined,
        iso8601 === 'true',
      );
      
      // Add source header for debugging
      res.setHeader('X-DeenMate-Source', result.source);
      
      // Return the exact same structure as upstream API
      return res.status(HttpStatus.OK).json(result.data);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 500,
        status: 'Internal Server Error',
        data: null
      });
    }
  }

  /**
   * GET /api/v1/prayer/qibla
   * Get qibla direction
   */
  @Get('qibla')
  async getQibla(
    @Res() res: Response,
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
    
  ) {
    try {
      if (!latitude || !longitude) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - Latitude and longitude are required',
          data: null
        });
      }

      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);
      
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - Invalid latitude or longitude',
          data: null
        });
      }

      const result = await this.prayerService.getQibla(lat, lng);
      
      // Add source header for debugging
      res.setHeader('X-DeenMate-Source', result.source);
      
      // Return the exact same structure as upstream API
      return res.status(HttpStatus.OK).json(result.data);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 500,
        status: 'Internal Server Error',
        data: null
      });
    }
  }

  /**
   * GET /api/v1/prayer/methods
   * Get prayer calculation methods
   */
  @Get('methods')
  async getMethods(@Res() res: Response) {
    try {
      const result = await this.prayerService.getMethods();
      
      // Add source header for debugging
      res.setHeader('X-DeenMate-Source', result.source);
      
      // Return the exact same structure as upstream API
      return res.status(HttpStatus.OK).json(result.data);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 500,
        status: 'Internal Server Error',
        data: null
      });
    }
  }

  /**
   * GET /api/v1/prayer/hijriCalendar
   * Get hijri calendar
   */
  @Get('hijriCalendar')
  async getHijriCalendar(
    @Res() res: Response,
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('baseDate') baseDate?: string,
    @Query('adjustment') adjustment?: string,
    
  ) {
    try {
      if (!month || !year) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - Month and year are required',
          data: null
        });
      }

      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);
      
      if (isNaN(monthNum) || isNaN(yearNum)) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - Invalid month or year',
          data: null
        });
      }

      if (monthNum < 1 || monthNum > 12) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - Month must be between 1 and 12',
          data: null
        });
      }

      const result = await this.prayerService.getHijriCalendar(
        monthNum,
        yearNum,
        baseDate,
        adjustment ? parseInt(adjustment, 10) : undefined,
      );
      
      // Add source header for debugging
      res.setHeader('X-DeenMate-Source', result.source);
      
      // Return the exact same structure as upstream API
      return res.status(HttpStatus.OK).json(result.data);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 500,
        status: 'Internal Server Error',
        data: null
      });
    }
  }

  /**
   * GET /api/v1/prayer/gregorianCalendar
   * Get gregorian calendar
   */
  @Get('gregorianCalendar')
  async getGregorianCalendar(
    @Res() res: Response,
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('baseDate') baseDate?: string,
    @Query('adjustment') adjustment?: string,
    
  ) {
    try {
      if (!month || !year) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - Month and year are required',
          data: null
        });
      }

      const monthNum = parseInt(month, 10);
      const yearNum = parseInt(year, 10);
      
      if (isNaN(monthNum) || isNaN(yearNum)) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - Invalid month or year',
          data: null
        });
      }

      if (monthNum < 1 || monthNum > 12) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - Month must be between 1 and 12',
          data: null
        });
      }

      const result = await this.prayerService.getGregorianCalendar(
        monthNum,
        yearNum,
        baseDate,
        adjustment ? parseInt(adjustment, 10) : undefined,
      );
      
      // Add source header for debugging
      res.setHeader('X-DeenMate-Source', result.source);
      
      // Return the exact same structure as upstream API
      return res.status(HttpStatus.OK).json(result.data);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 500,
        status: 'Internal Server Error',
        data: null
      });
    }
  }

  /**
   * GET /api/v1/prayer/currentTime
   * Get current time
   */
  @Get('currentTime')
  async getCurrentTime(@Res() res: Response) {
    try {
      const result = await this.prayerService.getCurrentTime();
      
      // Add source header for debugging
      res.setHeader('X-DeenMate-Source', result.source);
      
      // Return the exact same structure as upstream API
      return res.status(HttpStatus.OK).json(result.data);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 500,
        status: 'Internal Server Error',
        data: null
      });
    }
  }

  /**
   * GET /api/v1/prayer/dateConversion
   * Convert date between gregorian and hijri
   */
  @Get('dateConversion')
  async getDateConversion(
    @Res() res: Response,
    @Query('date') date: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('adjustment') adjustment?: string,
    
  ) {
    try {
      if (!date || !from || !to) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - Date, from, and to are required',
          data: null
        });
      }

      if (!['gregorian', 'hijri'].includes(from) || !['gregorian', 'hijri'].includes(to)) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - From and to must be either "gregorian" or "hijri"',
          data: null
        });
      }

      const result = await this.prayerService.getDateConversion(
        date,
        from as 'gregorian' | 'hijri',
        to as 'gregorian' | 'hijri',
        adjustment ? parseInt(adjustment, 10) : undefined,
      );
      
      // Add source header for debugging
      res.setHeader('X-DeenMate-Source', result.source);
      
      // Return the exact same structure as upstream API
      return res.status(HttpStatus.OK).json(result.data);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 500,
        status: 'Internal Server Error',
        data: null
      });
    }
  }
}
