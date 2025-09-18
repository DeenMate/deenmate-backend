import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPrayerData() {
  try {
    // Check prayer locations count
    const locationCount = await prisma.prayerLocation.count();
    console.log(`📍 Prayer Locations: ${locationCount}`);
    
    // Check prayer times for today and recent days
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const prayerTimesCount = await prisma.prayerTimes.count({
      where: {
        date: {
          gte: today
        }
      }
    });
    console.log(`🕐 Prayer Times (today+): ${prayerTimesCount}`);
    
    // Check prayer calculation methods
    const methodsCount = await prisma.prayerCalculationMethod.count();
    console.log(`📊 Calculation Methods: ${methodsCount}`);
    
    // Sample prayer times for today
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
    
  } catch (error) {
    console.error('Error checking prayer data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPrayerData();
