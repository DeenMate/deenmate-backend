/*
  Global Prayer Sync
  - Iterates all entries in `prayer_locations`
  - For each location, pre-warms prayer times for N days (default 7) including today
  - Calls existing public API flow so persistence happens via services
*/

import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const prisma = new PrismaClient();

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3000/api/v4';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const CONCURRENCY = Number(process.env.PREWARM_CONCURRENCY || 4);
const DAYS = Number(process.env.PREWARM_DAYS || 7);

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function triggerAdminPrewarm(days: number) {
  if (!ADMIN_TOKEN) throw new Error('ADMIN_TOKEN is required');
  const url = `${API_BASE}/admin/sync/prayer/prewarm?days=${days}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${ADMIN_TOKEN}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status} for ${url}: ${text}`);
  }
  return res.json();
}

// No per-location loop needed; backend will iterate all locations/methods/schools

async function run() {
  console.log(`Triggering admin prewarm for ${DAYS} day(s)...`);
  const result = await triggerAdminPrewarm(DAYS);
  console.log('Admin prewarm response:', result);
  await prisma.$disconnect();
  console.log('Global prayer sync complete.');
}

run().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});


