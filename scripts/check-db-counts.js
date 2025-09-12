#!/usr/bin/env node

/**
 * DeenMate Database Counts & Coverage Checker
 * Usage: node scripts/check-db-counts.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function getTableCounts() {
  console.log('📊 DeenMate Database Statistics');
  console.log('================================\n');

  try {
    // Get counts for all major tables
    const counts = await Promise.all([
      prisma.quranChapter.count(),
      prisma.quranVerse.count(),
      prisma.verseTranslation.count(),
      prisma.translationResource.count(),
      prisma.hadithCollection.count(),
      prisma.hadith.count(),
      prisma.prayerLocation.count(),
      prisma.prayerTimes.count(),
      prisma.goldPrice.count(),
      prisma.quranReciter.count(),
      prisma.quranAudioFile.count(),
      prisma.adminUser.count(),
      prisma.syncJobLog.count(),
    ]);

    const tables = [
      'Quran Chapters',
      'Quran Verses', 
      'Verse Translations',
      'Translation Resources',
      'Hadith Collections',
      'Hadith Items',
      'Prayer Locations',
      'Prayer Times',
      'Gold Prices',
      'Quran Reciters',
      'Quran Audio Files',
      'Admin Users',
      'Sync Job Logs',
    ];

    console.log('📈 Table Counts:');
    console.log('----------------');
    tables.forEach((table, i) => {
      const count = counts[i];
      const status = getCountStatus(table, count);
      console.log(`${status} ${table.padEnd(25)}: ${count.toLocaleString()}`);
    });

    // Check translation coverage
    console.log('\n🌐 Translation Coverage:');
    console.log('------------------------');
    
    const hadithWithBn = await prisma.hadith.count({
      where: { textBn: { not: null } }
    });
    const totalHadith = await prisma.hadith.count();
    const bnCoverage = totalHadith > 0 ? ((hadithWithBn / totalHadith) * 100).toFixed(2) : 0;
    
    console.log(`📝 Hadith Bangla Coverage: ${bnCoverage}% (${hadithWithBn}/${totalHadith})`);
    
    // Check recent sync activity
    console.log('\n🔄 Recent Sync Activity:');
    console.log('------------------------');
    
    const recentSyncs = await prisma.syncJobLog.findMany({
      where: {
        startedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      orderBy: { startedAt: 'desc' },
      take: 10
    });
    
    if (recentSyncs.length > 0) {
      recentSyncs.forEach(job => {
        const duration = job.finishedAt ? 
          Math.round((new Date(job.finishedAt) - new Date(job.startedAt)) / 1000) : 'N/A';
        const status = getJobStatus(job.status);
        console.log(`${status} ${job.jobName}: ${job.status} (${duration}s, ${job.recordsProcessed || 0} records)`);
      });
    } else {
      console.log('⚠️  No sync activity in the last 24 hours');
    }
    
    // Check for stuck jobs
    const stuckJobs = await prisma.syncJobLog.findMany({
      where: {
        status: 'in_progress',
        startedAt: {
          lt: new Date(Date.now() - 30 * 60 * 1000) // 30 minutes ago
        }
      },
      orderBy: { startedAt: 'desc' },
      take: 5
    });
    
    if (stuckJobs.length > 0) {
      console.log('\n🚨 Stuck Sync Jobs:');
      console.log('-------------------');
      stuckJobs.forEach(job => {
        const duration = Math.round((new Date() - new Date(job.startedAt)) / 1000 / 60);
        console.log(`❌ ${job.jobName}: running for ${duration} minutes`);
      });
    }
    
    // Check prayer times for today
    const today = new Date().toISOString().split('T')[0];
    const todayPrayerTimes = await prisma.prayerTimes.count({
      where: {
        date: new Date(today)
      }
    });
    
    console.log('\n🕌 Prayer Times Status:');
    console.log('----------------------');
    if (todayPrayerTimes > 0) {
      console.log(`✅ Prayer times for today (${today}): ${todayPrayerTimes} records`);
    } else {
      console.log(`❌ No prayer times for today (${today})`);
    }

  } catch (error) {
    console.error('❌ Error checking database:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

function getCountStatus(table, count) {
  switch (table) {
    case 'Quran Chapters':
      return count === 114 ? '✅' : '❌';
    case 'Quran Verses':
      return count === 6236 ? '✅' : '❌';
    case 'Verse Translations':
      return count > 0 ? '✅' : '❌';
    case 'Hadith Collections':
      return count >= 15 ? '✅' : '❌';
    case 'Hadith Items':
      return count >= 40000 ? '✅' : '❌';
    case 'Prayer Locations':
      return count > 0 ? '✅' : '❌';
    case 'Prayer Times':
      return count > 0 ? '✅' : '❌';
    case 'Gold Prices':
      return count > 0 ? '✅' : '❌';
    case 'Quran Reciters':
      return count > 0 ? '✅' : '❌';
    case 'Quran Audio Files':
      return count > 0 ? '✅' : '❌';
    case 'Admin Users':
      return count > 0 ? '✅' : '❌';
    default:
      return count > 0 ? '✅' : '⚠️';
  }
}

function getJobStatus(status) {
  switch (status) {
    case 'success':
      return '✅';
    case 'failed':
      return '❌';
    case 'in_progress':
      return '🔄';
    default:
      return '⚠️';
  }
}

// Run the check
getTableCounts().catch(console.error);