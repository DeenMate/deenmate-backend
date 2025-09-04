export interface UpstreamCalculationMethod {
  id: number;
  name: string;
  params: {
    Fajr: number;
    Isha: number;
    Maghrib?: number;
    Midnight?: string;
  };
  location: {
    latitude: number;
    longitude: number;
    elevation: number;
  };
}

export interface UpstreamPrayerTimings {
  Fajr: string;
  Sunrise: string;
  Dhuhr: string;
  Asr: string;
  Sunset: string;
  Maghrib: string;
  Isha: string;
  Imsak?: string;
  Midnight?: string;
  Firstthird?: string;
  Lastthird?: string;
}

export interface UpstreamDateInfo {
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
}

export class PrayerMapper {
  mapCalculationMethodFromUpstream(upstream: UpstreamCalculationMethod) {
    const fajr = upstream.params?.Fajr ?? 18;
    const isha = upstream.params?.Isha ?? 18;
    const maghrib = upstream.params?.Maghrib ?? 0;
    const midnight = upstream.params?.Midnight ?? 'Standard';

    return {
      methodName: upstream.name || `Method_${upstream.id}`,
      methodCode: this.generateMethodCode(upstream.name || `Method_${upstream.id}`),
      description: `Calculation method: ${upstream.name || upstream.id}`,
      fajrAngle: fajr,
      ishaAngle: isha,
      ishaInterval: null,
      maghribAngle: maghrib,
      midnightMode: midnight,
      source: 'aladhan',
      lastSynced: new Date(),
    };
  }

  mapPrayerTimesFromUpstream(
    timings: UpstreamPrayerTimings,
    dateInfo: UpstreamDateInfo,
    latitude: number,
    longitude: number,
    locKey: string
  ) {
    // dateInfo.gregorian.date is typically DD-MM-YYYY or similar; normalize to YYYY-MM-DD
    let date: Date;
    const raw = dateInfo.gregorian?.date || '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
      date = new Date(raw + 'T00:00:00Z');
    } else if (/^\d{2}-\d{2}-\d{4}$/.test(raw)) {
      const [dd, mm, yyyy] = raw.split('-');
      date = new Date(`${yyyy}-${mm}-${dd}T00:00:00Z`);
    } else {
      // fallback to today
      const today = new Date();
      date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    }
    
    return {
      locKey,
      date,
      method: 1, // Default method ID
      school: 0, // Default school (Shafi)
      fajr: this.parseTimeString(timings.Fajr, date),
      sunrise: this.parseTimeString(timings.Sunrise, date),
      dhuhr: this.parseTimeString(timings.Dhuhr, date),
      asr: this.parseTimeString(timings.Asr, date),
      maghrib: this.parseTimeString(timings.Maghrib, date),
      isha: this.parseTimeString(timings.Isha, date),
      imsak: timings.Imsak ? this.parseTimeString(timings.Imsak, date) : null,
      midnight: timings.Midnight ? this.parseTimeString(timings.Midnight, date) : null,
      qiblaDirection: this.calculateQiblaDirection(latitude, longitude),
      source: 'aladhan',
      lastSynced: new Date(),
      rawResponse: {
        timings: timings as any,
        dateInfo: dateInfo as any,
        coordinates: { latitude, longitude },
      },
    };
  }

  private generateMethodCode(methodName: string): string {
    // Map common method names to codes
    const methodMap: Record<string, string> = {
      'Muslim World League': 'MWL',
      'Islamic Society of North America': 'ISNA',
      'Egyptian General Authority of Survey': 'EGYPT',
      'Umm Al-Qura University, Makkah': 'UMM_AL_QURA',
      'University Of Islamic Sciences, Karachi': 'KARACHI',
      'Institute of Geophysics, Tehran University': 'TEHRAN',
      'Shia Ithna-Ashari, Leva Research Institute, Qum': 'JAFARI',
      'Gulf Region': 'GULF',
      'Kuwait': 'KUWAIT',
      'Qatar': 'QATAR',
      'Majlis Ugama Islam Singapura, Singapore': 'SINGAPORE',
      'Union Organization islamic de France': 'FRANCE',
      'Diyanet İşleri Başkanlığı, Turkey': 'TURKEY',
      'Spiritual Administration of Muslims of Russia': 'RUSSIA',
      'Moonsighting Committee Worldwide': 'MOON',
      'Dubai (UAE)': 'DUBAI',
    };

    return methodMap[methodName] || this.generateCustomMethodCode(methodName);
  }

  private generateCustomMethodCode(methodName: string): string {
    // Generate a custom code for unknown methods
    return methodName
      .replace(/[^a-zA-Z0-9]/g, '_')
      .toUpperCase()
      .substring(0, 10);
  }

  private parseTimeString(timeStr: string, baseDate: Date): Date {
    // Parse time string like "05:30" and combine with base date
    const [hours, minutes] = timeStr.split(':').map(Number);
    const date = new Date(baseDate);
    date.setHours(hours, minutes, 0, 0);
    return date;
  }

  private calculateQiblaDirection(latitude: number, longitude: number): number {
    // Calculate Qibla direction (simplified)
    // Mecca coordinates: 21.4225° N, 39.8262° E
    const meccaLat = 21.4225;
    const meccaLng = 39.8262;
    
    const latDiff = meccaLat - latitude;
    const lngDiff = meccaLng - longitude;
    
    // Simple calculation - in production, use proper spherical trigonometry
    const angle = Math.atan2(latDiff, lngDiff) * (180 / Math.PI);
    return (angle + 360) % 360;
  }

  mapCalculationMethodToUpstreamFormat(method: any) {
    return {
      id: method.id,
      name: method.methodName,
      params: {
        Fajr: method.fajrAngle,
        Isha: method.ishaAngle,
        Maghrib: method.maghribAngle,
        Midnight: method.midnightMode,
      },
      location: {
        latitude: 0, // Not stored in our DB
        longitude: 0,
        elevation: 0,
      },
    };
  }

  mapPrayerTimesToUpstreamFormat(times: any) {
    const date = new Date(times.date);
    
    return {
      timings: {
        Fajr: this.formatTimeForUpstream(times.fajr),
        Sunrise: this.formatTimeForUpstream(times.sunrise),
        Dhuhr: this.formatTimeForUpstream(times.dhuhr),
        Asr: this.formatTimeForUpstream(times.asr),
        Sunset: this.formatTimeForUpstream(times.maghrib), // Approximate
        Maghrib: this.formatTimeForUpstream(times.maghrib),
        Isha: this.formatTimeForUpstream(times.isha),
        Imsak: times.imsak ? this.formatTimeForUpstream(times.imsak) : undefined,
        Midnight: times.midnight ? this.formatTimeForUpstream(times.midnight) : undefined,
      },
      date: {
        readable: date.toDateString(),
        timestamp: date.getTime().toString(),
        gregorian: {
          date: date.toISOString().split('T')[0],
          format: 'DD-MM-YYYY',
          day: date.getDate().toString(),
          weekday: {
            en: date.toLocaleDateString('en-US', { weekday: 'long' }),
            ar: '', // Not available
          },
          month: {
            number: date.getMonth() + 1,
            en: date.toLocaleDateString('en-US', { month: 'long' }),
            ar: '', // Not available
          },
          year: date.getFullYear().toString(),
        },
        hijri: {
          date: '', // Not calculated
          format: 'DD-MM-YYYY',
          day: '',
          weekday: {
            en: '',
            ar: '',
          },
          month: {
            number: 0,
            en: '',
            ar: '',
          },
          year: '',
        },
      },
    };
  }

  private formatTimeForUpstream(date: Date): string {
    return date.toTimeString().substring(0, 5); // Format as "HH:MM"
  }
}
