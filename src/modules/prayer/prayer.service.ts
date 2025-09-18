import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { CommonHttpService } from "../../common/common.module";
import { PrayerMapper } from "./prayer.mapper";
import { generateLocationKey } from "../../common/utils/hash.util";
import tzLookup from "tz-lookup";

@Injectable()
export class PrayerService {
  private readonly logger = new Logger(PrayerService.name);
  private readonly upstreamBaseUrl = "https://api.aladhan.com/v1";
  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: CommonHttpService,
    private readonly mapper: PrayerMapper,
  ) {
    this.logger.log("PrayerService initialized");
  }

  async getCalculationMethods() {
    try {
      const methods = await (
        this.prisma as any
      ).prayerCalculationMethod.findMany({
        where: {
          methodName: {
            not: null,
          },
          methodCode: {
            not: null,
          },
        },
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
          methodName: "asc",
        },
      });

      if (methods.length === 0) {
        this.logger.warn(
          "No calculation methods found in database, falling back to upstream API",
        );
        return await this.fallbackToUpstream("methods", {});
      }

      return {
        code: 200,
        status: "Success",
        data: methods,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get calculation methods from database: ${error.message}`,
      );
      return await this.fallbackToUpstream("methods", {});
    }
  }

  async getCalculationMethod(methodCode: string) {
    try {
      const method = await (
        this.prisma as any
      ).prayerCalculationMethod.findUnique({
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
        this.logger.warn(
          `Calculation method ${methodCode} not found in database, falling back to upstream API`,
        );
        return await this.fallbackToUpstream("method", { methodCode });
      }

      return {
        code: 200,
        status: "Success",
        data: method,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get calculation method ${methodCode} from database: ${error.message}`,
      );
      return await this.fallbackToUpstream("method", { methodCode });
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
          city: "asc",
        },
      });

      if (locations.length === 0) {
        this.logger.warn(
          "No locations found in database, falling back to upstream API",
        );
        return await this.fallbackToUpstream("locations", {});
      }

      return {
        code: 200,
        status: "Success",
        data: locations,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get locations from database: ${error.message}`,
      );
      return await this.fallbackToUpstream("locations", {});
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
        this.logger.warn(
          `Location ${locKey} not found in database, falling back to upstream API`,
        );
        return await this.fallbackToUpstream("location", { locKey });
      }

      return {
        code: 200,
        status: "Success",
        data: location,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get location ${locKey} from database: ${error.message}`,
      );
      return await this.fallbackToUpstream("location", { locKey });
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
        this.logger.warn(
          `Prayer times not found for ${locKey} on ${date}, falling back to upstream API`,
        );
        return await this.fallbackToUpstream("timings", {
          locKey,
          date,
          method,
          school,
        });
      }

      return {
        code: 200,
        status: "Success",
        data: prayerTimes,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get prayer times from database: ${error.message}`,
      );
      return await this.fallbackToUpstream("timings", {
        locKey,
        date,
        method,
        school,
      });
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
          date: "asc",
        },
      });

      if (prayerTimes.length === 0) {
        this.logger.warn(
          `No monthly prayer times found for ${locKey} in ${year}-${month}, falling back to upstream API`,
        );
        return await this.fallbackToUpstream("calendar", {
          locKey,
          year,
          month,
          method,
          school,
          lat,
          lng,
          latitudeAdjustmentMethod,
          tune,
          timezonestring,
        });
      }

      return {
        code: 200,
        status: "Success",
        data: prayerTimes,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get monthly prayer times from database: ${error.message}`,
      );
      return await this.fallbackToUpstream("calendar", {
        locKey,
        year,
        month,
        method,
        school,
        lat,
        lng,
        latitudeAdjustmentMethod,
        tune,
        timezonestring,
      });
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
    const x =
      Math.cos(latRad) * Math.tan(kaabaLatRad) -
      Math.sin(latRad) * Math.cos(kaabaLngRad - lngRad);

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

      // Map external method ID to internal method ID
      const internalMethodId = await this.mapExternalMethodToInternal(method);

      // Ensure a location row exists for this lat/lng (auto-create)
      try {
        const existing = await (this.prisma as any).prayerLocation.findUnique({
          where: { locKey },
          select: { id: true },
        });
        if (!existing) {
          let timezone: string | null = null;
          try {
            timezone = tzLookup(lat, lng);
          } catch (_) {
            timezone = null;
          }
          // Try a very light reverse geocode (best-effort)
          let city: string | undefined;
          let country: string | undefined;
          try {
            const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=10&addressdetails=1`;
            const res = await this.httpService.get(url, {
              headers: { "User-Agent": "DeenMate/1.0 (contact@deenmate.app)" },
              timeout: 5000,
            } as any);
            const addr = res.data?.address || {};
            city = addr.city || addr.town || addr.village;
            country = addr.country;
          } catch (_) {
            // ignore reverse geocode errors
          }

          await (this.prisma as any).prayerLocation.upsert({
            where: { locKey },
            update: {},
            create: {
              locKey,
              lat,
              lng,
              city: city ?? null,
              country: country ?? null,
              timezone: timezone ?? null,
              elevation: 0,
            },
          });
        }
      } catch (autoErr) {
        this.logger.warn(`Auto-create location failed: ${String(autoErr)}`);
      }

      // Try to get from database first
      const prayerTimes = await this.getPrayerTimes(
        locKey,
        date,
        internalMethodId,
        school,
      );

      if (!prayerTimes || prayerTimes.code !== 200) {
        // If not in database, fallback to upstream API
        this.logger.warn(
          `Prayer times not found for ${lat},${lng} on ${date}, falling back to upstream API`,
        );
        return await this.fallbackToUpstream("timings", {
          lat,
          lng,
          date,
          method,
          school,
          latitudeAdjustmentMethod,
          tune,
          timezonestring,
        });
      }

      return {
        code: 200,
        status: "Success",
        data: {
          prayerTimes: prayerTimes.data,
          location: { lat, lng },
          method,
          date: date.toISOString().split("T")[0],
        },
      };
    } catch (error) {
      this.logger.error(`Failed to get daily prayer times: ${error.message}`);
      return await this.fallbackToUpstream("timings", {
        lat,
        lng,
        date,
        method,
        school,
        latitudeAdjustmentMethod,
        tune,
        timezonestring,
      });
    }
  }

  private async fallbackToUpstream(endpoint: string, params: any) {
    try {
      this.logger.log(`Falling back to upstream API for ${endpoint}`);

      let url = `${this.upstreamBaseUrl}`;

      switch (endpoint) {
        case "methods":
          url += "/methods";
          break;
        case "method":
          url += `/methods/${params.methodCode}`;
          break;
        case "locations":
          url += "/locations";
          break;
        case "location":
          url += `/locations/${params.locKey}`;
          break;
        case "timings": {
          const date = params.date || new Date();
          const dateStr = `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;
          const qp: string[] = [];
          qp.push(`latitude=${params.lat || 0}`);
          qp.push(`longitude=${params.lng || 0}`);
          qp.push(`method=${params.method || 1}`);
          qp.push(`school=${params.school || 0}`);
          if (typeof params.latitudeAdjustmentMethod === "number")
            qp.push(
              `latitudeAdjustmentMethod=${params.latitudeAdjustmentMethod}`,
            );
          if (params.tune) qp.push(`tune=${encodeURIComponent(params.tune)}`);
          if (params.timezonestring)
            qp.push(
              `timezonestring=${encodeURIComponent(params.timezonestring)}`,
            );
          url += `/timings/${dateStr}?${qp.join("&")}`;
          break;
        }
        case "timingsByCity": {
          const date = params.date || new Date();
          const dateStr = `${date.getDate().toString().padStart(2, '0')}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getFullYear()}`;
          const qp: string[] = [];
          qp.push(`city=${encodeURIComponent(params.city)}`);
          qp.push(`country=${encodeURIComponent(params.country)}`);
          qp.push(`method=${params.method || 1}`);
          qp.push(`school=${params.school || 0}`);
          if (typeof params.latitudeAdjustmentMethod === "number")
            qp.push(
              `latitudeAdjustmentMethod=${params.latitudeAdjustmentMethod}`,
            );
          if (params.tune) qp.push(`tune=${encodeURIComponent(params.tune)}`);
          if (params.timezonestring)
            qp.push(
              `timezonestring=${encodeURIComponent(params.timezonestring)}`,
            );
          url += `/timingsByCity/${dateStr}?${qp.join("&")}`;
          break;
        }
        case "calendar": {
          const qp: string[] = [];
          qp.push(`latitude=${params.lat || 0}`);
          qp.push(`longitude=${params.lng || 0}`);
          qp.push(`method=${params.method || 1}`);
          qp.push(`school=${params.school || 0}`);
          if (typeof params.latitudeAdjustmentMethod === "number")
            qp.push(
              `latitudeAdjustmentMethod=${params.latitudeAdjustmentMethod}`,
            );
          if (params.tune) qp.push(`tune=${encodeURIComponent(params.tune)}`);
          if (params.timezonestring)
            qp.push(
              `timezonestring=${encodeURIComponent(params.timezonestring)}`,
            );
          url += `/calendar/${params.year}/${params.month}?${qp.join("&")}`;
          break;
        }
        default:
          throw new Error(`Unknown endpoint: ${endpoint}`);
      }

      const response = await this.httpService.get(url);

      // Add fallback header
      const data = response.data;
      if (data && typeof data === "object") {
        data._fallback = true;
        data._source = "upstream";
      }

      return {
        code: 200,
        status: "Success (Fallback)",
        data: data,
        headers: {
          "X-DeenMate-Source": "upstream-fallback",
          "X-DeenMate-Cache": "miss",
        },
      };
    } catch (error) {
      this.logger.error(
        `Fallback to upstream API failed for ${endpoint}: ${error.message}`,
      );

      return {
        code: 503,
        status: "Service Unavailable",
        message: "Both local database and upstream API are unavailable",
        error: error.message,
      };
    }
  }

  private calculatePrayerTimes(
    _date: Date,
    _lat: number,
    _lng: number,
    _method: number,
    _school: number,
  ) {
    // Prevent unused parameter lints until implemented
    void _date;
    void _lat;
    void _lng;
    void _method;
    void _school;
    // This method should be implemented with actual prayer time calculation
    // For now, throw an error to indicate this needs proper implementation
    throw new Error(
      "Prayer time calculation not implemented. Use database or upstream API.",
    );
  }

  async getPrayerTimesByCity(
    city: string,
    country: string,
    date: Date = new Date(),
    method: number = 1,
    school: number = 0,
    latitudeAdjustmentMethod?: number,
    tune?: string,
    timezonestring?: string,
  ) {
    try {
      this.logger.log(`Getting prayer times for ${city}, ${country}`);

      // For city-based requests, we'll always fallback to upstream API
      // as we don't store city-based prayer times in our database
      return await this.fallbackToUpstream("timingsByCity", {
        city,
        country,
        date,
        method,
        school,
        latitudeAdjustmentMethod,
        tune,
        timezonestring,
      });
    } catch (error) {
      this.logger.error(`Failed to get prayer times by city: ${error.message}`);
      return await this.fallbackToUpstream("timingsByCity", {
        city,
        country,
        date,
        method,
        school,
        latitudeAdjustmentMethod,
        tune,
        timezonestring,
      });
    }
  }

  async getPrayerCalendar(
    lat: number,
    lng: number,
    month: number,
    year: number,
    method: number = 1,
    school: number = 0,
    latitudeAdjustmentMethod?: number,
    tune?: string,
    timezonestring?: string,
  ) {
    try {
      this.logger.log(
        `Getting prayer calendar for ${lat},${lng} - ${month}/${year}`,
      );

      // For calendar requests, we'll always fallback to upstream API
      // as we don't store monthly calendar data in our database
      return await this.fallbackToUpstream("calendar", {
        lat,
        lng,
        month,
        year,
        method,
        school,
        latitudeAdjustmentMethod,
        tune,
        timezonestring,
      });
    } catch (error) {
      this.logger.error(`Failed to get prayer calendar: ${error.message}`);
      return await this.fallbackToUpstream("calendar", {
        lat,
        lng,
        month,
        year,
        method,
        school,
        latitudeAdjustmentMethod,
        tune,
        timezonestring,
      });
    }
  }

  /**
   * Map external API method ID to internal database method ID
   * This handles the mismatch between Aladhan API method IDs and our database IDs
   */
  private async mapExternalMethodToInternal(externalMethodId: number): Promise<number> {
    try {
      // Common method mappings based on Aladhan API
      const methodMappings: Record<number, string> = {
        0: 'JAFARI',
        1: 'KARACHI', 
        2: 'ISNA',
        3: 'MWL',
        4: 'MAKKAH',
        5: 'EGYPT',
        7: 'TEHRAN',
        8: 'GULF',
        9: 'KUWAIT',
        10: 'QATAR',
        11: 'SINGAPORE',
        12: 'FRANCE',
        13: 'TURKEY',
        14: 'RUSSIA',
        15: 'MOONSIGHTING',
        16: 'DUBAI',
        17: 'JAKIM',
        18: 'TUNISIA',
        19: 'ALGERIA',
        20: 'KEMENAG',
        21: 'MOROCCO',
        22: 'PORTUGAL',
        23: 'JORDAN',
        99: 'CUSTOM'
      };

      const methodCode = methodMappings[externalMethodId];
      if (!methodCode) {
        this.logger.warn(`Unknown external method ID: ${externalMethodId}, using default method 1`);
        return 1; // Default to KARACHI method
      }

      // Find the internal method ID by method code
      const method = await (this.prisma as any).prayerCalculationMethod.findUnique({
        where: { methodCode },
        select: { id: true }
      });

      if (!method) {
        this.logger.warn(`Method code ${methodCode} not found in database, using default method 1`);
        return 1; // Default to first method
      }

      return method.id;
    } catch (error) {
      this.logger.error(`Failed to map external method ID ${externalMethodId}: ${error.message}`);
      return 1; // Default fallback
    }
  }
}
