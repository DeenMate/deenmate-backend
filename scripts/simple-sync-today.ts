import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import * as dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000/api/v4';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@deenmate.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function getAdminToken(): Promise<string> {
  console.log('🔐 Getting admin token...');
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
  return data.data.accessToken;
}

async function clearAllPrayerTimes() {
  console.log('🗑️  Clearing all prayer time data...');
  
  const deleteResult = await prisma.prayerTimes.deleteMany({});
  console.log(`✅ Deleted ${deleteResult.count} prayer time records`);
  
  return deleteResult.count;
}

async function syncTodayDirectly() {
  try {
    const token = await getAdminToken();
    
    console.log('🔄 Syncing prayer times for today only (2025-09-15)...');
    
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

    // Only sync for today (2025-09-15) and only one method to test
    const today = new Date('2025-09-15');
    const testLocation = locations[0]; // Just test with first location
    const testMethod = methods[0]; // Just test with first method
    const testSchool = 0; // Shafi

    console.log(`🧪 Testing with ${testLocation.city || testLocation.locKey} using ${testMethod.methodName} (${testMethod.methodCode})`);

    // Call the admin sync endpoint for today only
    const url = `${API_BASE}/admin/sync/prayer/times?lat=${testLocation.lat}&lng=${testLocation.lng}&methodCode=${testMethod.methodCode}&school=${testSchool}&days=1&force=true`;
    
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });

    const responseBody = await res.json();
    
    if (!res.ok || !responseBody.success) {
      throw new Error(`HTTP ${res.status}: ${JSON.stringify(responseBody)}`);
    }

    console.log('✅ Test sync successful!');
    console.log('📊 Response:', JSON.stringify(responseBody, null, 2));
    
    return { totalProcessed: 1, totalSuccess: 1, totalFailed: 0 };
    
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
  
  if (prayerTimesCount === 1) {
    console.log('🎉 SUCCESS: Only 1 prayer time record for today (as expected)');
  } else {
    console.log(`⚠️  WARNING: Expected 1 record, but found ${prayerTimesCount} records`);
  }
}

async function main() {
  try {
    console.log('🚀 Starting simple prayer time cleanup and sync for today only...\n');
    
    // Step 1: Clear all existing prayer time data
    const deletedCount = await clearAllPrayerTimes();
    
    // Step 2: Sync only for today (test with single location/method)
    const syncResult = await syncTodayDirectly();
    
    // Step 3: Verify results
    await verifyResults();
    
    console.log('\n🎉 Simple prayer time cleanup and sync completed!');
    console.log(`   Deleted: ${deletedCount} old records`);
    console.log(`   Synced: ${syncResult.totalSuccess} new record for today`);
    
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
