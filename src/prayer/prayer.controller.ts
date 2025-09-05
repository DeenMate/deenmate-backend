import { Controller, Get, Post, Body, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { PrayerService } from './prayer.service';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

// Define the response types from the service
type ServiceResponse = {
  code: number;
  status: string;
  data?: any;
  headers?: Record<string, string>;
  message?: string;
  error?: any;
};

@ApiTags('Prayer v1')
@Controller({ path: 'prayer', version: '1' })
export class PrayerController {
  constructor(private readonly prayerService: PrayerService) {}

  @Get('methods')
  @ApiOperation({ summary: 'List prayer calculation methods', description: 'Upstream-compatible with aladhan.com/v1/methods' })
  @ApiResponse({ status: 200, description: 'Success' })
  async getCalculationMethods(@Res() res: Response) {
    const result = await this.prayerService.getCalculationMethods() as ServiceResponse;
    
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    if (!res.getHeader('X-DeenMate-Source')) {
      res.setHeader('X-DeenMate-Source', 'live-sync');
      res.setHeader('X-DeenMate-Cache', 'miss');
    }
    return res.json(result);
  }

  @Get('methods/:methodCode')
  @ApiOperation({ summary: 'Get specific calculation method', description: 'Upstream-compatible with aladhan.com/v1/methods/{id}' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async getCalculationMethod(
    @Res() res: Response,
    @Param('methodCode') methodCode: string,
  ) {
    const result = await this.prayerService.getCalculationMethod(methodCode) as ServiceResponse;
    
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    if (!res.getHeader('X-DeenMate-Source')) {
      res.setHeader('X-DeenMate-Source', 'live-sync');
      res.setHeader('X-DeenMate-Cache', 'miss');
    }
    return res.json(result);
  }

  @Get('locations')
  @ApiOperation({ summary: 'List saved locations' })
  @ApiResponse({ status: 200, description: 'Success' })
  async getLocations(@Res() res: Response) {
    const result = await this.prayerService.getLocations() as ServiceResponse;
    
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    if (!res.getHeader('X-DeenMate-Source')) {
      res.setHeader('X-DeenMate-Source', 'live-sync');
      res.setHeader('X-DeenMate-Cache', 'miss');
    }
    return res.json(result);
  }

  @Get('locations/:locKey')
  @ApiOperation({ summary: 'Get location by key' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async getLocation(
    @Res() res: Response,
    @Param('locKey') locKey: string,
  ) {
    const result = await this.prayerService.getLocation(locKey) as ServiceResponse;
    
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    if (!res.getHeader('X-DeenMate-Source')) {
      res.setHeader('X-DeenMate-Source', 'live-sync');
      res.setHeader('X-DeenMate-Cache', 'miss');
    }
    return res.json(result);
  }

  @Post('locations')
  @ApiOperation({ summary: 'Save or update a location' })
  @ApiResponse({ status: 200, description: 'Success' })
  async saveLocation(
    @Body() location: {
      lat: number;
      lng: number;
      city?: string;
      country?: string;
      timezone?: string;
      elevation?: number;
    },
    @Res() res: Response,
  ) {
    const savedLocation = await this.prayerService.saveLocation(location);
    
    res.setHeader('X-DeenMate-Source', 'live-sync');
    return res.json({
      code: 200,
      status: 'OK',
      data: savedLocation,
    });
  }

  @Get('timings')
  @ApiOperation({ summary: 'Get daily prayer times by coordinates', description: 'Upstream-compatible with aladhan.com/v1/timings' })
  @ApiQuery({ name: 'latitude', required: true, description: 'Latitude', example: 23.8103 })
  @ApiQuery({ name: 'longitude', required: true, description: 'Longitude', example: 90.4125 })
  @ApiQuery({ name: 'method', required: false, schema: { type: 'integer', default: 1 }, example: 2 })
  @ApiQuery({ name: 'school', required: false, schema: { type: 'integer', default: 0 }, example: 1 })
  @ApiQuery({ name: 'latitudeAdjustmentMethod', required: false, schema: { type: 'integer', enum: [0,1,2] }, description: '0=None,1=Middle,2=OneSeventh', example: 1 })
  @ApiQuery({ name: 'tune', required: false, description: 'Comma-separated 7 integer minute offsets (Fajr,...,Isha)', example: '1,2,3,4,5,6,7' })
  @ApiQuery({ name: 'timezonestring', required: false, description: 'IANA timezone', example: 'Asia/Dhaka' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async getPrayerTimes(
    @Res() res: Response,
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
    @Query('date') date?: string,
    @Query('method') method: string = '1',
    @Query('school') school: string = '0',
    @Query('latitudeAdjustmentMethod') latitudeAdjustmentMethod?: string,
    @Query('tune') tune?: string,
    @Query('timezonestring') timezonestring?: string,
  ) {
    if (!latitude || !longitude) {
      return res.status(400).json({
        code: 400,
        status: 'Bad Request',
        message: 'Latitude and longitude are required',
      });
    }
    
    const dateObj = date ? new Date(date) : new Date();
    
    const result = await this.prayerService.getDailyPrayerTimes(
      parseFloat(latitude),
      parseFloat(longitude),
      dateObj,
      parseInt(method),
      parseInt(school),
      latitudeAdjustmentMethod ? parseInt(latitudeAdjustmentMethod) : undefined,
      tune,
      timezonestring,
    ) as ServiceResponse;
    
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    if (!res.getHeader('X-DeenMate-Source')) {
      res.setHeader('X-DeenMate-Source', 'live-sync');
      res.setHeader('X-DeenMate-Cache', 'miss');
    }
    return res.json(result);
  }

  @Get('timingsByCity')
  @ApiOperation({ summary: 'Get daily prayer times by city', description: 'Upstream-compatible with aladhan.com/v1/timingsByCity' })
  @ApiQuery({ name: 'city', required: true, description: 'City name', example: 'Dhaka' })
  @ApiQuery({ name: 'country', required: true, description: 'Country name', example: 'Bangladesh' })
  @ApiQuery({ name: 'method', required: false, schema: { type: 'integer', default: 1 }, example: 2 })
  @ApiQuery({ name: 'school', required: false, schema: { type: 'integer', default: 0 }, example: 1 })
  @ApiQuery({ name: 'latitudeAdjustmentMethod', required: false, schema: { type: 'integer', enum: [0,1,2] }, description: '0=None,1=Middle,2=OneSeventh', example: 1 })
  @ApiQuery({ name: 'tune', required: false, description: 'Comma-separated 7 integer minute offsets (Fajr,...,Isha)', example: '1,2,3,4,5,6,7' })
  @ApiQuery({ name: 'timezonestring', required: false, description: 'IANA timezone', example: 'Asia/Dhaka' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async getPrayerTimesByCity(
    @Res() res: Response,
    @Query('city') city: string,
    @Query('country') country: string,
    @Query('date') date?: string,
    @Query('method') method: string = '1',
    @Query('school') school: string = '0',
    @Query('latitudeAdjustmentMethod') latitudeAdjustmentMethod?: string,
    @Query('tune') tune?: string,
    @Query('timezonestring') timezonestring?: string,
  ) {
    if (!city || !country) {
      return res.status(400).json({
        code: 400,
        status: 'Bad Request',
        message: 'City and country are required',
      });
    }
    
    const dateObj = date ? new Date(date) : new Date();
    
    const result = await this.prayerService.getPrayerTimesByCity(
      city,
      country,
      dateObj,
      parseInt(method),
      parseInt(school),
      latitudeAdjustmentMethod ? parseInt(latitudeAdjustmentMethod) : undefined,
      tune,
      timezonestring,
    ) as ServiceResponse;
    
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    if (!res.getHeader('X-DeenMate-Source')) {
      res.setHeader('X-DeenMate-Source', 'live-sync');
      res.setHeader('X-DeenMate-Cache', 'miss');
    }
    return res.json(result);
  }

  @Get('calendar')
  @ApiOperation({ summary: 'Get monthly prayer calendar by coordinates', description: 'Upstream-compatible with aladhan.com/v1/calendar' })
  @ApiQuery({ name: 'latitude', required: true, description: 'Latitude', example: 23.8103 })
  @ApiQuery({ name: 'longitude', required: true, description: 'Longitude', example: 90.4125 })
  @ApiQuery({ name: 'month', required: true, description: 'Month (1-12)', example: 9 })
  @ApiQuery({ name: 'year', required: true, description: 'Year', example: 2025 })
  @ApiQuery({ name: 'method', required: false, schema: { type: 'integer', default: 1 }, example: 2 })
  @ApiQuery({ name: 'school', required: false, schema: { type: 'integer', default: 0 }, example: 1 })
  @ApiQuery({ name: 'latitudeAdjustmentMethod', required: false, schema: { type: 'integer', enum: [0,1,2] }, description: '0=None,1=Middle,2=OneSeventh', example: 1 })
  @ApiQuery({ name: 'tune', required: false, description: 'Comma-separated 7 integer minute offsets (Fajr,...,Isha)', example: '1,2,3,4,5,6,7' })
  @ApiQuery({ name: 'timezonestring', required: false, description: 'IANA timezone', example: 'Asia/Dhaka' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async getPrayerCalendar(
    @Res() res: Response,
    @Query('latitude') latitude: string,
    @Query('longitude') longitude: string,
    @Query('month') month: string,
    @Query('year') year: string,
    @Query('method') method: string = '1',
    @Query('school') school: string = '0',
    @Query('latitudeAdjustmentMethod') latitudeAdjustmentMethod?: string,
    @Query('tune') tune?: string,
    @Query('timezonestring') timezonestring?: string,
  ) {
    if (!latitude || !longitude || !month || !year) {
      return res.status(400).json({
        code: 400,
        status: 'Bad Request',
        message: 'Latitude, longitude, month, and year are required',
      });
    }
    
    const monthNum = parseInt(month);
    const yearNum = parseInt(year);
    
    if (isNaN(monthNum) || isNaN(yearNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        code: 400,
        status: 'Bad Request',
        message: 'Invalid month or year',
      });
    }
    
    const result = await this.prayerService.getPrayerCalendar(
      parseFloat(latitude),
      parseFloat(longitude),
      monthNum,
      yearNum,
      parseInt(method),
      parseInt(school),
      latitudeAdjustmentMethod ? parseInt(latitudeAdjustmentMethod) : undefined,
      tune,
      timezonestring,
    ) as ServiceResponse;
    
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    if (!res.getHeader('X-DeenMate-Source')) {
      res.setHeader('X-DeenMate-Source', 'live-sync');
      res.setHeader('X-DeenMate-Cache', 'miss');
    }
    return res.json(result);
  }

  @Get('times/:locKey/monthly/:year/:month')
  @ApiOperation({
    summary: 'Get monthly prayer calendar',
    description: 'Upstream-compatible with aladhan.com/v1/calendar/{year}/{month}. Example: /prayer/times/loc_23.8103_90.4125/monthly/2025/9?method=2&school=1&lat=23.8103&lng=90.4125&latitudeAdjustmentMethod=1&tune=1,2,3,4,5,6,7&timezonestring=Asia/Dhaka',
  })
  @ApiQuery({ name: 'method', required: false, schema: { type: 'integer', default: 1 }, example: 2 })
  @ApiQuery({ name: 'school', required: false, schema: { type: 'integer', default: 0 }, example: 1 })
  @ApiQuery({ name: 'lat', required: false, description: 'Latitude (for upstream fallback only)', example: 23.8103 })
  @ApiQuery({ name: 'lng', required: false, description: 'Longitude (for upstream fallback only)', example: 90.4125 })
  @ApiQuery({ name: 'latitudeAdjustmentMethod', required: false, schema: { type: 'integer', enum: [0,1,2] }, example: 1 })
  @ApiQuery({ name: 'tune', required: false, description: 'Comma-separated 7 integer minute offsets', example: '1,2,3,4,5,6,7' })
  @ApiQuery({ name: 'timezonestring', required: false, description: 'IANA timezone', example: 'Asia/Dhaka' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async getMonthlyPrayerTimes(
    @Res() res: Response,
    @Param('locKey') locKey: string,
    @Param('year') year: string,
    @Param('month') month: string,
    @Query('method') method: string = '1',
    @Query('school') school: string = '0',
    @Query('lat') lat?: string,
    @Query('lng') lng?: string,
    @Query('latitudeAdjustmentMethod') latitudeAdjustmentMethod?: string,
    @Query('tune') tune?: string,
    @Query('timezonestring') timezonestring?: string,
  ) {
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    
    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({
        code: 400,
        status: 'Bad Request',
        message: 'Invalid year or month',
      });
    }
    
    const result = await this.prayerService.getMonthlyPrayerTimes(
      locKey,
      yearNum,
      monthNum,
      parseInt(method),
      parseInt(school),
      lat ? parseFloat(lat) : undefined,
      lng ? parseFloat(lng) : undefined,
      latitudeAdjustmentMethod ? parseInt(latitudeAdjustmentMethod) : undefined,
      tune,
      timezonestring,
    ) as ServiceResponse;
    
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    if (!res.getHeader('X-DeenMate-Source')) {
      res.setHeader('X-DeenMate-Source', 'live-sync');
      res.setHeader('X-DeenMate-Cache', 'miss');
    }
    return res.json(result);
  }

  @Get('qibla')
  @ApiOperation({ summary: 'Calculate Qibla direction' })
  @ApiQuery({ name: 'lat', required: true, description: 'Latitude' })
  @ApiQuery({ name: 'lng', required: true, description: 'Longitude' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async getQiblaDirection(
    @Query('lat') lat: string,
    @Query('lng') lng: string,
    @Res() res: Response,
  ) {
    if (!lat || !lng) {
      return res.status(400).json({
        code: 400,
        status: 'Bad Request',
        message: 'Latitude and longitude are required',
      });
    }
    
    const qiblaDirection = await this.prayerService.calculateQiblaDirection(
      parseFloat(lat),
      parseFloat(lng),
    );
    
    res.setHeader('X-DeenMate-Source', 'live-sync');
    return res.json({
      code: 200,
      status: 'OK',
      data: {
        qiblaDirection,
        coordinates: {
          lat: parseFloat(lat),
          lng: parseFloat(lng),
        },
      },
    });
  }
}
