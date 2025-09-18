import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000/api/v4';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@deenmate.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

let adminToken: string = '';
let tokenExpiry: number = 0;

async function getAdminToken(): Promise<string> {
  console.log('🔐 Getting fresh admin token...');
  const loginUrl = `${API_BASE}/admin/auth/login`;
  const response = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get admin token: HTTP ${response.status} - ${errorText}`);
  }
  
  const data: any = await response.json();
  const token = data.data.accessToken;
  
  // Set expiry to 50 minutes from now (tokens typically last 1 hour)
  tokenExpiry = Date.now() + (50 * 60 * 1000);
  
  console.log('✅ Admin token obtained successfully');
  return token;
}

async function ensureValidToken(): Promise<string> {
  // Check if we have a token and it's not expired
  if (adminToken && Date.now() < tokenExpiry) {
    return adminToken;
  }
  
  // Get a fresh token
  adminToken = await getAdminToken();
  return adminToken;
}

async function clearAllPrayerTimes() {
  console.log('🗑️  Clearing all prayer time data...');
  
  const deleteResult = await prisma.prayerTimes.deleteMany({});
  console.log(`✅ Deleted ${deleteResult.count} prayer time records`);
  
  return deleteResult.count;
}

async function syncTodayOnly() {
  try {
    await ensureValidToken();

    console.log('🔄 Starting prayer sync for today only (2025-09-15)...');
    
    // Get all prayer locations
    const locations = await prisma.prayerLocation.findMany({
      select: { id: true, lat: true, lng: true, locKey: true, city: true, country: true },
      orderBy: { id: 'asc' },
    });
    
    // Get all prayer calculation methods
    const methods = await prisma.prayerCalculationMethod.findMany({
      select: { id: true, methodCode: true, methodName: true },
      orderBy: { methodName: 'asc' },
    });

    console.log(`📍 Found ${locations.length} locations`);
    console.log(`📊 Found ${methods.length} calculation methods`);
    
    let totalProcessed = 0;
    let totalSuccess = 0;
    let totalFailed = 0;

    for (const location of locations) {
      for (const method of methods) {
        for (const school of [0, 1]) {
          try {
            const started = Date.now();
            
            // Call the admin sync endpoint for today only
            const url = `${API_BASE}/admin/sync/prayer/times?lat=${location.lat}&lng=${location.lng}&methodCode=${method.methodCode}&school=${school}&days=1&force=true`;
            
            const res = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`,
              },
            });

            const responseBody = await res.json();
            
            if (!res.ok || !responseBody.success) {
              throw new Error(`HTTP ${res.status}: ${JSON.stringify(responseBody)}`);
            }

            const ms = Date.now() - started;
            const schoolName = school === 0 ? 'Shafi' : 'Hanafi';
            console.log(`✅ ${location.city || location.locKey} ${method.methodCode}/${schoolName} in ${ms}ms`);
            
            totalSuccess++;
          } catch (error) {
            const schoolName = school === 0 ? 'Shafi' : 'Hanafi';
            console.error(`❌ ${location.city || location.locKey} ${method.methodCode}/${schoolName}:`, (error as Error).message);
            totalFailed++;
          }
          
          totalProcessed++;
          
          // Small delay to avoid overwhelming the API
          await new Promise((r) => setTimeout(r, 100));
        }
      }
    }

    console.log('\n📊 Sync Summary:');
    console.log(`   Total processed: ${totalProcessed}`);
    console.log(`   Successful: ${totalSuccess}`);
    console.log(`   Failed: ${totalFailed}`);
    
    return { totalProcessed, totalSuccess, totalFailed };
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
    throw error;
  }
}

async function verifyResults() {
  console.log('\n🔍 Verifying results...');
  
  // Check prayer times count for today
  const today = new Date('2025-09-15');
  today.setHours(0, 0, 0, 0);
  
  const prayerTimesCount = await prisma.prayerTimes.count({
    where: {
      date: today
    }
  });
  
  console.log(`📅 Prayer times for today (2025-09-15): ${prayerTimesCount}`);
  
  // Check total prayer times count
  const totalCount = await prisma.prayerTimes.count();
  console.log(`📊 Total prayer times in DB: ${totalCount}`);
  
  // Sample a few records
  const sampleTimes = await prisma.prayerTimes.findMany({
    where: {
      date: today
    },
    take: 3
  });
  
  console.log('\n📋 Sample Prayer Times for Today:');
  sampleTimes.forEach((time, i) => {
    console.log(`${i + 1}. Location Key: ${time.locKey}`);
    console.log(`   Method ID: ${time.method}, School: ${time.school === 0 ? 'Shafi' : 'Hanafi'}`);
    console.log(`   Fajr: ${time.fajr}, Dhuhr: ${time.dhuhr}, Asr: ${time.asr}, Maghrib: ${time.maghrib}, Isha: ${time.isha}`);
    console.log('');
  });
}

async function main() {
  try {
    console.log('🚀 Starting prayer time cleanup and sync for today only...\n');
    
    // Step 1: Clear all existing prayer time data
    const deletedCount = await clearAllPrayerTimes();
    
    // Step 2: Sync only for today
    const syncResult = await syncTodayOnly();
    
    // Step 3: Verify results
    await verifyResults();
    
    console.log('\n🎉 Prayer time cleanup and sync completed successfully!');
    console.log(`   Deleted: ${deletedCount} old records`);
    console.log(`   Synced: ${syncResult.totalSuccess} new records for today`);
    
  } catch (error) {
    console.error('❌ Script failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
