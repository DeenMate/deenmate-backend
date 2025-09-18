import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000/api/v4';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@deenmate.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

async function getAdminToken(): Promise<string> {
  console.log('Getting admin token...');
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
  console.log('Admin token obtained successfully');
  return data.data.accessToken;
}

async function testPrayerSync() {
  try {
    const token = await getAdminToken();
    
    // Test with Mecca (21.4225, 39.8262) using MWL method, Shafi school, for just today
    const url = `${API_BASE}/admin/sync/prayer/times?lat=21.4225&lng=39.8262&methodCode=MWL&school=0&days=1&force=true`;
    
    console.log(`Testing prayer sync for Mecca today...`);
    console.log(`URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    
    const result = await response.text();
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${result}`);
    }
    
    console.log('✅ Prayer sync test successful!');
    console.log('Result:', result);
    
  } catch (error) {
    console.error('❌ Prayer sync test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testPrayerSync();
