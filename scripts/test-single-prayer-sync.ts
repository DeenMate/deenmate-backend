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

async function testSinglePrayerSync() {
  try {
    const token = await getAdminToken();
    
    // Test with a single location and method for today only
    const testLocation = { lat: 21.4225, lng: 39.8262, city: 'Mecca', country: 'Saudi Arabia' };
    const testMethodCode = 'MAKKAH';
    const testSchool = 0; // Shafi
    const testDays = 1; // Only today

    console.log(`🧪 Testing prayer sync for ${testLocation.city} for ${testDays} day(s)...`);

    const url = `${API_BASE}/admin/sync/prayer/times?lat=${testLocation.lat}&lng=${testLocation.lng}&methodCode=${testMethodCode}&school=${testSchool}&days=${testDays}&force=true`;
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
    
    // Check how many prayer times were created for today
    const today = new Date('2025-09-15');
    today.setHours(0, 0, 0, 0);
    
    const prayerTimesCount = await prisma.prayerTimes.count({
      where: {
        date: today,
        locKey: `${testLocation.lat.toFixed(3)},${testLocation.lng.toFixed(3)}`
      }
    });
    
    console.log(`📅 Prayer times for today (${today.toISOString().split('T')[0]}): ${prayerTimesCount}`);
    
    if (prayerTimesCount === 1) {
      console.log('🎉 SUCCESS: Only 1 prayer time record for today (as expected)');
    } else {
      console.log(`⚠️  WARNING: Expected 1 record, but found ${prayerTimesCount} records`);
    }
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testSinglePrayerSync().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
