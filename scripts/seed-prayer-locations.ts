import { PrismaClient } from '@prisma/client';
import tzLookup from 'tz-lookup';

const prisma = new PrismaClient();

type SeedLoc = { city: string; country: string; lat: number; lng: number };

const SEED_LOCATIONS: SeedLoc[] = [
  { city: 'Makkah', country: 'Saudi Arabia', lat: 21.4225, lng: 39.8262 },
  { city: 'Madinah', country: 'Saudi Arabia', lat: 24.5247, lng: 39.5692 },
  { city: 'Istanbul', country: 'Turkey', lat: 41.0082, lng: 28.9784 },
  { city: 'Cairo', country: 'Egypt', lat: 30.0444, lng: 31.2357 },
  { city: 'Dhaka', country: 'Bangladesh', lat: 23.8103, lng: 90.4125 },
  { city: 'Jakarta', country: 'Indonesia', lat: -6.2088, lng: 106.8456 },
  { city: 'Karachi', country: 'Pakistan', lat: 24.8607, lng: 67.0011 },
  { city: 'Kuala Lumpur', country: 'Malaysia', lat: 3.139, lng: 101.6869 },
  { city: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278 },
  { city: 'New York', country: 'USA', lat: 40.7128, lng: -74.006 },
];

function generateLocationKey(lat: number, lng: number): string {
  const roundedLat = Math.round(lat * 1000) / 1000;
  const roundedLng = Math.round(lng * 1000) / 1000;
  return require('crypto').createHash('md5').update(`${roundedLat},${roundedLng}`).digest('hex');
}

async function main() {
  let created = 0;
  for (const loc of SEED_LOCATIONS) {
    const locKey = generateLocationKey(loc.lat, loc.lng);
    const tz = (() => { try { return tzLookup(loc.lat, loc.lng); } catch { return null; } })();
    await (prisma as any).prayerLocation.upsert({
      where: { locKey },
      update: { city: loc.city, country: loc.country, timezone: tz },
      create: {
        locKey,
        lat: loc.lat,
        lng: loc.lng,
        city: loc.city,
        country: loc.country,
        timezone: tz,
        elevation: 0,
      },
    });
    created++;
  }
  console.log(`Seeded/updated ${created} prayer_locations.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});


