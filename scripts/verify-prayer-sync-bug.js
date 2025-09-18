#!/usr/bin/env node

/**
 * Prayer Sync Bug Verification Script
 * 
 * This script verifies the current prayer sync behavior to demonstrate
 * the over-syncing issue where requesting 1 day results in 15 days synced.
 * 
 * Usage: node scripts/verify-prayer-sync-bug.js
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function verifyPrayerSyncBug() {
  console.log('🕌 DeenMate Prayer Sync Bug Verification');
  console.log('==========================================\n');

  try {
    // Check current prayer times count
    const totalPrayerTimes = await prisma.prayerTimes.count();
    console.log(`📊 Total prayer times in database: ${totalPrayerTimes}`);

    // Check recent sync job logs
    const recentSyncJobs = await prisma.syncJobLog.findMany({
      where: {
        jobName: {
          contains: 'prayer'
        }
      },
      orderBy: {
        startedAt: 'desc'
      },
      take: 5
    });

    console.log('\n📋 Recent Prayer Sync Jobs:');
    console.log('----------------------------');
    
    if (recentSyncJobs.length === 0) {
      console.log('❌ No recent prayer sync jobs found');
    } else {
      recentSyncJobs.forEach((job, index) => {
        console.log(`${index + 1}. Job: ${job.jobName}`);
        console.log(`   Status: ${job.status}`);
        console.log(`   Records Processed: ${job.recordsProcessed || 'N/A'}`);
        console.log(`   Started: ${job.startedAt.toISOString()}`);
        console.log(`   Duration: ${job.durationMs || 'N/A'}ms`);
        if (job.error) {
          console.log(`   Error: ${job.error}`);
        }
        console.log('');
      });
    }

    // Check prayer times by date for a specific location
    const testLocation = await prisma.prayerLocation.findFirst({
      where: {
        OR: [
          { city: 'Mecca' },
          { city: 'Makkah' },
          { lat: 21.4225, lng: 39.8262 }
        ]
      }
    });

    if (testLocation) {
      console.log(`📍 Test Location: ${testLocation.city || 'Unknown'} (${testLocation.lat}, ${testLocation.lng})`);
      
      const prayerTimesForLocation = await prisma.prayerTimes.findMany({
        where: {
          locKey: testLocation.locKey
        },
        orderBy: {
          date: 'desc'
        },
        take: 20
      });

      console.log(`\n🕐 Recent Prayer Times for Test Location:`);
      console.log('----------------------------------------');
      
      if (prayerTimesForLocation.length === 0) {
        console.log('❌ No prayer times found for test location');
      } else {
        const dateCounts = {};
        prayerTimesForLocation.forEach(pt => {
          const dateStr = pt.date.toISOString().split('T')[0];
          dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
        });

        Object.keys(dateCounts).sort().reverse().forEach(date => {
          console.log(`${date}: ${dateCounts[date]} records`);
        });

        console.log(`\n📈 Analysis:`);
        console.log(`   Total unique dates: ${Object.keys(dateCounts).length}`);
        console.log(`   Total records: ${prayerTimesForLocation.length}`);
        
        if (Object.keys(dateCounts).length > 7) {
          console.log(`   ⚠️  WARNING: More than 7 days found - possible over-syncing detected!`);
        }
      }
    } else {
      console.log('❌ No test location found (Mecca/Makkah)');
    }

    // Check for the specific bug pattern
    console.log('\n🔍 Bug Pattern Analysis:');
    console.log('------------------------');
    
    const today = new Date();
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 7);
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setDate(today.getDate() + 7);

    const prayerTimesInRange = await prisma.prayerTimes.count({
      where: {
        date: {
          gte: sevenDaysAgo,
          lte: sevenDaysFromNow
        }
      }
    });

    console.log(`   Prayer times in 15-day range (7 days back + 7 days forward): ${prayerTimesInRange}`);
    
    if (prayerTimesInRange > 0) {
      console.log(`   ⚠️  This suggests the default 15-day range is being used`);
      console.log(`   💡 Expected: Only today's prayer times should be present for recent syncs`);
    }

    // Check unique constraints
    console.log('\n🔒 Database Constraints Check:');
    console.log('-------------------------------');
    
    const duplicateCheck = await prisma.$queryRaw`
      SELECT "locKey", date, method, school, COUNT(*) as count
      FROM prayer_times 
      GROUP BY "locKey", date, method, school
      HAVING COUNT(*) > 1
      LIMIT 5
    `;

    if (duplicateCheck.length === 0) {
      console.log('✅ No duplicate prayer times found - unique constraints working');
    } else {
      console.log('❌ Duplicate prayer times found:');
      duplicateCheck.forEach(dup => {
        console.log(`   ${dup.locKey} - ${dup.date} - Method: ${dup.method} - School: ${dup.school} - Count: ${dup.count}`);
      });
    }

  } catch (error) {
    console.error('❌ Error during verification:', error.message);
    console.error(error.stack);
  } finally {
    await prisma.$disconnect();
  }

  console.log('\n🎯 Summary:');
  console.log('============');
  console.log('This script helps verify the prayer sync over-syncing bug.');
  console.log('If you see more than 1-7 days of prayer times for recent syncs,');
  console.log('the bug is confirmed. The fix should limit syncs to the requested');
  console.log('number of days only.');
  console.log('\n📝 Next Steps:');
  console.log('1. Apply the fix patch: patches/prayer-fix-2025-09-15.diff');
  console.log('2. Run the test script: ./scripts/test-sync-prayer.sh');
  console.log('3. Verify the fix resolves the over-syncing issue');
}

// Run the verification
verifyPrayerSyncBug().catch(console.error);
