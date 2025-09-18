import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

type City = { city: string; country: string; lat: number; lng: number; timezone?: string; methodCode?: string; school?: number };

const cities: City[] = [
  // Middle East
  { city: 'Mecca', country: 'Saudi Arabia', lat: 21.4225, lng: 39.8262, timezone: 'Asia/Riyadh', methodCode: 'MAKKAH', school: 0 },
  { city: 'Medina', country: 'Saudi Arabia', lat: 24.5247, lng: 39.5692, timezone: 'Asia/Riyadh', methodCode: 'MAKKAH', school: 0 },
  { city: 'Riyadh', country: 'Saudi Arabia', lat: 24.7136, lng: 46.6753, timezone: 'Asia/Riyadh', methodCode: 'MAKKAH', school: 0 },
  { city: 'Jeddah', country: 'Saudi Arabia', lat: 21.4858, lng: 39.1925, timezone: 'Asia/Riyadh', methodCode: 'MAKKAH', school: 0 },
  { city: 'Cairo', country: 'Egypt', lat: 30.0444, lng: 31.2357, timezone: 'Africa/Cairo', methodCode: 'EGYPT', school: 0 },
  { city: 'Alexandria', country: 'Egypt', lat: 31.2001, lng: 29.9187, timezone: 'Africa/Cairo', methodCode: 'EGYPT', school: 0 },
  { city: 'Istanbul', country: 'Turkey', lat: 41.0082, lng: 28.9784, timezone: 'Europe/Istanbul', methodCode: 'TURKEY', school: 0 },
  { city: 'Ankara', country: 'Turkey', lat: 39.9334, lng: 32.8597, timezone: 'Europe/Istanbul', methodCode: 'TURKEY', school: 0 },
  { city: 'Tehran', country: 'Iran', lat: 35.6892, lng: 51.3890, timezone: 'Asia/Tehran', methodCode: 'TEHRAN', school: 0 },
  { city: 'Isfahan', country: 'Iran', lat: 32.6546, lng: 51.6680, timezone: 'Asia/Tehran', methodCode: 'TEHRAN', school: 0 },
  { city: 'Baghdad', country: 'Iraq', lat: 33.3152, lng: 44.3661, timezone: 'Asia/Baghdad', methodCode: 'MWL', school: 0 },
  { city: 'Damascus', country: 'Syria', lat: 33.5138, lng: 36.2765, timezone: 'Asia/Damascus', methodCode: 'MWL', school: 0 },
  { city: 'Amman', country: 'Jordan', lat: 31.9454, lng: 35.9284, timezone: 'Asia/Amman', methodCode: 'MWL', school: 0 },
  { city: 'Kuwait City', country: 'Kuwait', lat: 29.3759, lng: 47.9774, timezone: 'Asia/Kuwait', methodCode: 'KUWAIT', school: 0 },
  { city: 'Doha', country: 'Qatar', lat: 25.2854, lng: 51.5310, timezone: 'Asia/Qatar', methodCode: 'QATAR', school: 0 },
  { city: 'Dubai', country: 'United Arab Emirates', lat: 25.2048, lng: 55.2708, timezone: 'Asia/Dubai', methodCode: 'DUBAI', school: 0 },
  { city: 'Abu Dhabi', country: 'United Arab Emirates', lat: 24.4539, lng: 54.3773, timezone: 'Asia/Dubai', methodCode: 'DUBAI', school: 0 },
  { city: 'Muscat', country: 'Oman', lat: 23.5880, lng: 58.3829, timezone: 'Asia/Muscat', methodCode: 'MWL', school: 0 },
  { city: 'Manama', country: 'Bahrain', lat: 26.0667, lng: 50.5577, timezone: 'Asia/Bahrain', methodCode: 'MWL', school: 0 },
  
  // South & Southeast Asia
  { city: 'Jakarta', country: 'Indonesia', lat: -6.2088, lng: 106.8456, timezone: 'Asia/Jakarta', methodCode: 'MOON_SIGHTING', school: 0 },
  { city: 'Surabaya', country: 'Indonesia', lat: -7.2504, lng: 112.7688, timezone: 'Asia/Jakarta', methodCode: 'MOON_SIGHTING', school: 0 },
  { city: 'Bandung', country: 'Indonesia', lat: -6.9175, lng: 107.6191, timezone: 'Asia/Jakarta', methodCode: 'MOON_SIGHTING', school: 0 },
  { city: 'Kuala Lumpur', country: 'Malaysia', lat: 3.1390, lng: 101.6869, timezone: 'Asia/Kuala_Lumpur', methodCode: 'SINGAPORE', school: 0 },
  { city: 'Karachi', country: 'Pakistan', lat: 24.8607, lng: 67.0011, timezone: 'Asia/Karachi', methodCode: 'KARACHI', school: 1 },
  { city: 'Lahore', country: 'Pakistan', lat: 31.5204, lng: 74.3587, timezone: 'Asia/Karachi', methodCode: 'KARACHI', school: 1 },
  { city: 'Islamabad', country: 'Pakistan', lat: 33.6844, lng: 73.0479, timezone: 'Asia/Karachi', methodCode: 'KARACHI', school: 1 },
  { city: 'Dhaka', country: 'Bangladesh', lat: 23.8103, lng: 90.4125, timezone: 'Asia/Dhaka', methodCode: 'KARACHI', school: 1 },
  { city: 'Chittagong', country: 'Bangladesh', lat: 22.3569, lng: 91.7832, timezone: 'Asia/Dhaka', methodCode: 'KARACHI', school: 1 },
  { city: 'Delhi', country: 'India', lat: 28.6139, lng: 77.2090, timezone: 'Asia/Kolkata', methodCode: 'KARACHI', school: 1 },
  { city: 'Mumbai', country: 'India', lat: 19.0760, lng: 72.8777, timezone: 'Asia/Kolkata', methodCode: 'KARACHI', school: 1 },
  { city: 'Hyderabad', country: 'India', lat: 17.3850, lng: 78.4867, timezone: 'Asia/Kolkata', methodCode: 'KARACHI', school: 1 },
  { city: 'Kolkata', country: 'India', lat: 22.5726, lng: 88.3639, timezone: 'Asia/Kolkata', methodCode: 'KARACHI', school: 1 },
  
  // Africa
  { city: 'Casablanca', country: 'Morocco', lat: 33.5731, lng: -7.5898, timezone: 'Africa/Casablanca', methodCode: 'MWL', school: 0 },
  { city: 'Rabat', country: 'Morocco', lat: 34.0209, lng: -6.8416, timezone: 'Africa/Casablanca', methodCode: 'MWL', school: 0 },
  { city: 'Algiers', country: 'Algeria', lat: 36.7538, lng: 3.0588, timezone: 'Africa/Algiers', methodCode: 'MWL', school: 0 },
  { city: 'Tunis', country: 'Tunisia', lat: 36.8065, lng: 10.1815, timezone: 'Africa/Tunis', methodCode: 'MWL', school: 0 },
  { city: 'Khartoum', country: 'Sudan', lat: 15.5007, lng: 32.5599, timezone: 'Africa/Khartoum', methodCode: 'MWL', school: 0 },
  { city: 'Addis Ababa', country: 'Ethiopia', lat: 9.1450, lng: 38.7667, timezone: 'Africa/Addis_Ababa', methodCode: 'MWL', school: 0 },
  { city: 'Lagos', country: 'Nigeria', lat: 6.5244, lng: 3.3792, timezone: 'Africa/Lagos', methodCode: 'MWL', school: 0 },
  { city: 'Kano', country: 'Nigeria', lat: 12.0022, lng: 8.5919, timezone: 'Africa/Lagos', methodCode: 'MWL', school: 0 },
  { city: 'Dakar', country: 'Senegal', lat: 14.6928, lng: -17.4467, timezone: 'Africa/Dakar', methodCode: 'MWL', school: 0 },
  
  // North America
  { city: 'New York', country: 'United States', lat: 40.7128, lng: -74.0060, timezone: 'America/New_York', methodCode: 'ISNA', school: 0 },
  { city: 'Los Angeles', country: 'United States', lat: 34.0522, lng: -118.2437, timezone: 'America/Los_Angeles', methodCode: 'ISNA', school: 0 },
  { city: 'Chicago', country: 'United States', lat: 41.8781, lng: -87.6298, timezone: 'America/Chicago', methodCode: 'ISNA', school: 0 },
  { city: 'Detroit', country: 'United States', lat: 42.3314, lng: -83.0458, timezone: 'America/Detroit', methodCode: 'ISNA', school: 0 },
  { city: 'Houston', country: 'United States', lat: 29.7604, lng: -95.3698, timezone: 'America/Chicago', methodCode: 'ISNA', school: 0 },
  { city: 'Toronto', country: 'Canada', lat: 43.6532, lng: -79.3832, timezone: 'America/Toronto', methodCode: 'ISNA', school: 0 },
  { city: 'Montreal', country: 'Canada', lat: 45.5017, lng: -73.5673, timezone: 'America/Toronto', methodCode: 'ISNA', school: 0 },
  
  // Europe
  { city: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278, timezone: 'Europe/London', methodCode: 'FRANCE', school: 0 },
  { city: 'Birmingham', country: 'United Kingdom', lat: 52.4862, lng: -1.8904, timezone: 'Europe/London', methodCode: 'FRANCE', school: 0 },
  { city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522, timezone: 'Europe/Paris', methodCode: 'FRANCE', school: 0 },
  { city: 'Marseille', country: 'France', lat: 43.2965, lng: 5.3698, timezone: 'Europe/Paris', methodCode: 'FRANCE', school: 0 },
  { city: 'Berlin', country: 'Germany', lat: 52.5200, lng: 13.4050, timezone: 'Europe/Berlin', methodCode: 'FRANCE', school: 0 },
  { city: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lng: 4.9041, timezone: 'Europe/Amsterdam', methodCode: 'FRANCE', school: 0 },
  { city: 'Brussels', country: 'Belgium', lat: 50.8503, lng: 4.3517, timezone: 'Europe/Brussels', methodCode: 'FRANCE', school: 0 },
  { city: 'Stockholm', country: 'Sweden', lat: 59.3293, lng: 18.0686, timezone: 'Europe/Stockholm', methodCode: 'FRANCE', school: 0 },
  { city: 'Oslo', country: 'Norway', lat: 59.9139, lng: 10.7522, timezone: 'Europe/Oslo', methodCode: 'FRANCE', school: 0 },
  
  // Central Asia & Others
  { city: 'Tashkent', country: 'Uzbekistan', lat: 41.2995, lng: 69.2401, timezone: 'Asia/Tashkent', methodCode: 'MWL', school: 0 },
  { city: 'Almaty', country: 'Kazakhstan', lat: 43.2220, lng: 76.8512, timezone: 'Asia/Almaty', methodCode: 'MWL', school: 0 },
  { city: 'Baku', country: 'Azerbaijan', lat: 40.4093, lng: 49.8671, timezone: 'Asia/Baku', methodCode: 'MWL', school: 0 },
  { city: 'Sarajevo', country: 'Bosnia and Herzegovina', lat: 43.8563, lng: 18.4131, timezone: 'Europe/Sarajevo', methodCode: 'FRANCE', school: 0 },
  { city: 'Skopje', country: 'North Macedonia', lat: 41.9981, lng: 21.4254, timezone: 'Europe/Skopje', methodCode: 'FRANCE', school: 0 },
  { city: 'Sydney', country: 'Australia', lat: -33.8688, lng: 151.2093, timezone: 'Australia/Sydney', methodCode: 'MWL', school: 0 },
  { city: 'Melbourne', country: 'Australia', lat: -37.8136, lng: 144.9631, timezone: 'Australia/Melbourne', methodCode: 'MWL', school: 0 },
];

function toLocKey(lat: number, lng: number): string {
  const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;
  // Simple hash substitute; DB already ensures uniqueness on locKey
  return require('crypto').createHash('md5').update(key).digest('hex');
}

async function run() {
  let upserts = 0;
  for (const c of cities) {
    const locKey = toLocKey(c.lat, c.lng);
    await (prisma as any).prayerLocation.upsert({
      where: { locKey },
      update: { city: c.city, country: c.country, timezone: c.timezone, source: 'seed' },
      create: {
        locKey,
        lat: c.lat,
        lng: c.lng,
        city: c.city,
        country: c.country,
        timezone: c.timezone,
        elevation: 0,
        source: 'seed',
      },
    });
    upserts++;
  }
  console.log(`Seeded/updated ${upserts} prayer locations.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});


