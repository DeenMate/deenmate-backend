import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding prayer calculation methods...');

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
  ];

  for (const method of methods) {
    await prisma.prayerCalculationMethod.upsert({
      where: { methodCode: method.methodCode },
      update: method,
      create: method,
    });
  }

  console.log('Prayer calculation methods seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
