import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import * as fs from 'fs';

const prisma = new PrismaClient();

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000/api/v4';
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@deenmate.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const DAYS = Number(process.env.PREWARM_DAYS || 7);
const CONCURRENCY = Number(process.env.PREWARM_CONCURRENCY || 2);

let adminToken: string = '';
let tokenExpiry: number = 0;

type Method = { id: number; methodCode: string };

function qs(params: Record<string, string | number | boolean | undefined>) {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

async function getAdminToken(): Promise<string> {
  console.log('Getting fresh admin token...');
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
  
  console.log('Admin token obtained successfully');
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

async function triggerTimes(lat: number, lng: number, methodCode: string, school: number, days: number) {
  const token = await ensureValidToken();
  const url = `${API_BASE}/admin/sync/prayer/times?${qs({ lat, lng, methodCode, school, days, force: true })}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}: ${text}`);
  return text;
}

async function worker(name: string, locations: any[], methods: Method[]) {
  for (const loc of locations) {
    for (const method of methods) {
      for (const school of [0, 1]) {
        try {
          const started = Date.now();
          const out = await triggerTimes(loc.lat, loc.lng, method.methodCode, school, DAYS);
          const ms = Date.now() - started;
          console.log(`[ok] ${name} ${loc.city || loc.locKey} ${method.methodCode}/school${school} in ${ms}ms -> ${out}`);
        } catch (e) {
          console.error(`[fail] ${name} ${loc.city || loc.locKey} ${method.methodCode}/school${school}:`, (e as Error).message);
        }
        await new Promise((r) => setTimeout(r, 75));
      }
    }
  }
}

async function main() {
  // Get initial token
  await ensureValidToken();

  const locations = await prisma.prayerLocation.findMany({
    select: { id: true, lat: true, lng: true, locKey: true, city: true },
    orderBy: { id: 'asc' },
  });
  const methods: Method[] = await prisma.prayerCalculationMethod.findMany({
    select: { id: true, methodCode: true },
    orderBy: { methodName: 'asc' },
  });

  console.log(`Foreground prewarm: ${locations.length} locations x ${methods.length} methods x 2 schools x ${DAYS} day(s)`);

  // Split locations for basic concurrency
  const batches: any[][] = Array.from({ length: CONCURRENCY }, () => []);
  locations.forEach((loc, i) => batches[i % CONCURRENCY].push(loc));

  await Promise.all(batches.map((batch, i) => worker(`W${i + 1}`, batch, methods)));

  await prisma.$disconnect();
  console.log('Foreground prewarm complete.');
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});


