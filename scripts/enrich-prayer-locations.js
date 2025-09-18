/*
 Backfill missing city, country, timezone, and elevation for prayer locations.
 - Uses Nominatim (OpenStreetMap) for reverse geocoding (city,country)
 - Uses tz-lookup for timezone by lat/long
 - Uses open-elevation for elevation

 Usage:
   node scripts/enrich-prayer-locations.js [--limit=50]
*/

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');
const tzLookup = require('tz-lookup');

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const result = { limit: 100 };
  for (const a of args) {
    if (a.startsWith('--limit=')) {
      const n = parseInt(a.split('=')[1], 10);
      if (!Number.isNaN(n)) result.limit = n;
    }
  }
  return result;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function reverseGeocode(lat, lon) {
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&addressdetails=1`;
    const res = await axios.get(url, {
      headers: { 'User-Agent': 'DeenMate/1.0 (contact@deenmate.app)' },
      timeout: 15000,
    });
    const addr = res.data && res.data.address ? res.data.address : {};
    const city = addr.city || addr.town || addr.village || addr.state || null;
    const country = addr.country || null;
    return { city, country };
  } catch (err) {
    return { city: null, country: null };
  }
}

async function getElevation(lat, lon) {
  try {
    const url = `https://api.open-elevation.com/api/v1/lookup?locations=${lat},${lon}`;
    const res = await axios.get(url, { timeout: 15000 });
    const results = res.data && res.data.results ? res.data.results : [];
    if (results.length > 0 && typeof results[0].elevation === 'number') {
      return results[0].elevation;
    }
    return null;
  } catch (err) {
    return null;
  }
}

async function main() {
  const { limit } = parseArgs();
  console.log(`[enrich-prayer-locations] starting. limit=${limit}`);

  // Select table name and fields according to Prisma model names
  // Expected model: PrayerLocation with fields: id, lat, lng, city, country, timezone, elevation, source
  const targets = await prisma.prayerLocation.findMany({
    where: {
      OR: [
        { city: null },
        { country: null },
        { timezone: null },
        { elevation: 0 },
      ],
    },
    take: limit,
  });

  console.log(`[enrich-prayer-locations] rows needing enrichment: ${targets.length}`);

  let updated = 0;
  for (const row of targets) {
    const { id, lat, lng } = row;
    if (lat == null || lng == null) {
      continue;
    }

    let city = row.city;
    let country = row.country;
    let timezone = row.timezone;
    let elevation = row.elevation;

    if (!city || !country) {
      const geo = await reverseGeocode(lat, lng);
      city = city || geo.city;
      country = country || geo.country;
      // be polite to Nominatim
      await sleep(1200);
    }

    if (!timezone) {
      try {
        timezone = tzLookup(lat, lng);
      } catch (_) {
        timezone = null;
      }
    }

    if (elevation == null || elevation === 0) {
      elevation = await getElevation(lat, lng);
      // Rate limit open-elevation slightly
      await sleep(500);
    }

    const data = {};
    if (city) data.city = city;
    if (country) data.country = country;
    if (timezone) data.timezone = timezone;
    if (typeof elevation === 'number') data.elevation = elevation;

    if (Object.keys(data).length > 0) {
      await prisma.prayerLocation.update({ where: { id }, data });
      updated += 1;
      console.log(`[enrich] id=${id} -> ${JSON.stringify(data)}`);
    }
  }

  await prisma.$disconnect();
  console.log(`[enrich-prayer-locations] done. updated=${updated}`);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});


