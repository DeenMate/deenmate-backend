import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌍 Seeding comprehensive prayer calculation methods...');

  const methods = [
    {
      methodName: 'Muslim World League',
      methodCode: 'MWL',
      description: 'Muslim World League calculation method',
      fajrAngle: 18.0,
      ishaAngle: 17.0,
      ishaInterval: null,
      maghribAngle: 0.0,
      midnightMode: 'Standard',
    },
    {
      methodName: 'Islamic Society of North America',
      methodCode: 'ISNA',
      description: 'Islamic Society of North America calculation method',
      fajrAngle: 15.0,
      ishaAngle: 15.0,
      ishaInterval: null,
      maghribAngle: 0.0,
      midnightMode: 'Standard',
    },
    {
      methodName: 'Egyptian General Authority of Survey',
      methodCode: 'EGYPT',
      description: 'Egyptian General Authority of Survey calculation method',
      fajrAngle: 19.5,
      ishaAngle: 17.5,
      ishaInterval: null,
      maghribAngle: 0.0,
      midnightMode: 'Standard',
    },
    {
      methodName: 'Umm Al-Qura University, Makkah',
      methodCode: 'MAKKAH',
      description: 'Umm Al-Qura University, Makkah calculation method',
      fajrAngle: 18.5,
      ishaAngle: 90.0,
      ishaInterval: 120,
      maghribAngle: 0.0,
      midnightMode: 'Standard',
    },
    {
      methodName: 'University Of Islamic Sciences, Karachi',
      methodCode: 'KARACHI',
      description: 'University Of Islamic Sciences, Karachi calculation method',
      fajrAngle: 18.0,
      ishaAngle: 18.0,
      ishaInterval: null,
      maghribAngle: 0.0,
      midnightMode: 'Standard',
    },
    {
      methodName: 'Institute of Geophysics, University of Tehran',
      methodCode: 'TEHRAN',
      description: 'Institute of Geophysics, University of Tehran calculation method',
      fajrAngle: 17.7,
      ishaAngle: 14.0,
      ishaInterval: null,
      maghribAngle: 0.0,
      midnightMode: 'Standard',
    },
    {
      methodName: 'Shia Ithna-Ansari',
      methodCode: 'JAFARI',
      description: 'Shia Ithna-Ansari calculation method',
      fajrAngle: 16.0,
      ishaAngle: 14.0,
      ishaInterval: null,
      maghribAngle: 0.0,
      midnightMode: 'Standard',
    },
    {
      methodName: 'Majlis Ugama Islam Singapura, Singapore',
      methodCode: 'SINGAPORE',
      description: 'Majlis Ugama Islam Singapura, Singapore calculation method',
      fajrAngle: 20.0,
      ishaAngle: 18.0,
      ishaInterval: null,
      maghribAngle: 0.0,
      midnightMode: 'Standard',
    },
    {
      methodName: 'Union Organization islamic de France',
      methodCode: 'FRANCE',
      description: 'Union Organization islamic de France calculation method',
      fajrAngle: 12.0,
      ishaAngle: 12.0,
      ishaInterval: null,
      maghribAngle: 0.0,
      midnightMode: 'Standard',
    },
    {
      methodName: 'Diyanet İşleri Başkanlığı, Turkey',
      methodCode: 'TURKEY',
      description: 'Diyanet İşleri Başkanlığı, Turkey calculation method',
      fajrAngle: 18.0,
      ishaAngle: 17.0,
      ishaInterval: null,
      maghribAngle: 0.0,
      midnightMode: 'Standard',
    },
    {
      methodName: 'Spiritual Administration of Muslims of Russia',
      methodCode: 'RUSSIA',
      description: 'Spiritual Administration of Muslims of Russia calculation method',
      fajrAngle: 16.0,
      ishaAngle: 15.0,
      ishaInterval: null,
      maghribAngle: 0.0,
      midnightMode: 'Standard',
    },
    {
      methodName: 'Moonsighting Committee Worldwide',
      methodCode: 'MOON_SIGHTING',
      description: 'Moonsighting Committee Worldwide calculation method',
      fajrAngle: 18.0,
      ishaAngle: 18.0,
      ishaInterval: null,
      maghribAngle: 0.0,
      midnightMode: 'Standard',
    },
    {
      methodName: 'Dubai (unofficial)',
      methodCode: 'DUBAI',
      description: 'Dubai (unofficial) calculation method',
      fajrAngle: 18.2,
      ishaAngle: 18.2,
      ishaInterval: null,
      maghribAngle: 0.0,
      midnightMode: 'Standard',
    },
    {
      methodName: 'Kuwait',
      methodCode: 'KUWAIT',
      description: 'Kuwait calculation method',
      fajrAngle: 18.0,
      ishaAngle: 17.5,
      ishaInterval: null,
      maghribAngle: 0.0,
      midnightMode: 'Standard',
    },
    {
      methodName: 'Qatar',
      methodCode: 'QATAR',
      description: 'Qatar calculation method',
      fajrAngle: 18.0,
      ishaAngle: 18.0,
      ishaInterval: null,
      maghribAngle: 0.0,
      midnightMode: 'Standard',
    },
  ];

  for (const method of methods) {
    await prisma.prayerCalculationMethod.upsert({
      where: { methodCode: method.methodCode },
      update: method,
      create: method,
    });
    console.log(`✅ Seeded method: ${method.methodCode} - ${method.methodName}`);
  }

  console.log(`\n🎉 Successfully seeded ${methods.length} prayer calculation methods!`);
  console.log('\n📋 Available methods:');
  const allMethods = await prisma.prayerCalculationMethod.findMany({
    select: { methodCode: true, methodName: true },
    orderBy: { methodName: 'asc' }
  });
  allMethods.forEach(m => console.log(`  - ${m.methodCode}: ${m.methodName}`));
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
