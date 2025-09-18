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
    
    // Test with a single location and method for today only
    const testLocation = { lat: 21.4225, lng: 39.8262, city: 'Mecca', country: 'Saudi Arabia' };
    const testMethodCode = 'MAKKAH';
    const testSchool = 0; // Shafi

    console.log(`🧪 Testing with ${testLocation.city} using ${testMethodCode} method`);

    // Call the admin sync endpoint for today only
    const url = `${API_BASE}/admin/sync/prayer/times?lat=${testLocation.lat}&lng=${testLocation.lng}&methodCode=${testMethodCode}&school=${testSchool}&days=1&force=true`;
    
    console.log(`📡 Calling: ${url}`);
    
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
    
    return { success: true };
    
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
    console.log('🚀 Starting direct prayer time cleanup and sync for today only...\n');
    
    // Step 1: Clear all existing prayer time data
    const deletedCount = await clearAllPrayerTimes();
    
    // Step 2: Sync only for today (test with single location/method)
    const syncResult = await syncTodayDirectly();
    
    // Step 3: Verify results
    await verifyResults();
    
    console.log('\n🎉 Direct prayer time cleanup and sync completed!');
    console.log(`   Deleted: ${deletedCount} old records`);
    console.log(`   Synced: ${syncResult.success ? '1' : '0'} new record for today`);
    
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
