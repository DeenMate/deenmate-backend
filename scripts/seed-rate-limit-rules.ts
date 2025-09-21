import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function seedRateLimitRules() {
  console.log('🌱 Seeding default rate limit rules...');

  const defaultRules = [
    {
      endpoint: '/',
      method: 'ALL',
      limitCount: 1000,
      windowSeconds: 3600, // 1 hour
    },
    {
      endpoint: '/api/v4/admin/*',
      method: 'ALL',
      limitCount: 100,
      windowSeconds: 3600, // 1 hour
    },
    {
      endpoint: '/api/v4/quran/*',
      method: 'GET',
      limitCount: 500,
      windowSeconds: 3600, // 1 hour
    },
    {
      endpoint: '/api/v4/hadith/*',
      method: 'GET',
      limitCount: 200,
      windowSeconds: 3600, // 1 hour
    },
    {
      endpoint: '/api/v4/prayer/*',
      method: 'GET',
      limitCount: 300,
      windowSeconds: 3600, // 1 hour
    },
    {
      endpoint: '/api/v4/audio/*',
      method: 'GET',
      limitCount: 100,
      windowSeconds: 3600, // 1 hour
    },
    {
      endpoint: '/api/v4/gold/*',
      method: 'GET',
      limitCount: 50,
      windowSeconds: 3600, // 1 hour
    },
  ];

  for (const rule of defaultRules) {
    try {
      await prisma.rateLimitRule.upsert({
        where: { endpoint: rule.endpoint },
        update: {
          method: rule.method,
          limitCount: rule.limitCount,
          windowSeconds: rule.windowSeconds,
          enabled: true,
        },
        create: {
          endpoint: rule.endpoint,
          method: rule.method,
          limitCount: rule.limitCount,
          windowSeconds: rule.windowSeconds,
          enabled: true,
        },
      });
      console.log(`✅ Rate limit rule created/updated: ${rule.endpoint} (${rule.method})`);
    } catch (error) {
      console.error(`❌ Error creating rate limit rule for ${rule.endpoint}:`, error);
    }
  }

  console.log('🎉 Rate limit rules seeding completed!');
}

async function main() {
  try {
    await seedRateLimitRules();
  } catch (error) {
    console.error('❌ Error seeding rate limit rules:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
