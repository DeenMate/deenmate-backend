import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clear existing data
  await prisma.quranVerse.deleteMany();
  await prisma.quranChapter.deleteMany();
  await prisma.quranReciter.deleteMany();
  await prisma.prayerTimes.deleteMany();
  await prisma.prayerLocation.deleteMany();
  await prisma.prayerCalculationMethod.deleteMany();

  // Create Quran Chapters
  console.log('📖 Creating Quran chapters...');
  const chapters = [
    {
      chapterNumber: 1,
      nameArabic: 'الفاتحة',
      nameEnglish: 'Al-Fatiha',
      nameBangla: 'আল-ফাতিহা',
      revelationPlace: 'Mecca',
      versesCount: 7,
      bismillahPre: true,
    },
    {
      chapterNumber: 2,
      nameArabic: 'البقرة',
      nameEnglish: 'Al-Baqarah',
      nameBangla: 'আল-বাকারা',
      revelationPlace: 'Medina',
      versesCount: 286,
      bismillahPre: true,
    },
    {
      chapterNumber: 3,
      nameArabic: 'آل عمران',
      nameEnglish: 'Aal-Imran',
      nameBangla: 'আল-ইমরান',
      revelationPlace: 'Medina',
      versesCount: 200,
      bismillahPre: true,
    },
  ];

  for (const chapter of chapters) {
    await prisma.quranChapter.upsert({
      where: { chapterNumber: chapter.chapterNumber },
      update: chapter,
      create: chapter,
    });
  }

  // Create Prayer Calculation Methods
  console.log('🕌 Creating prayer calculation methods...');
  const methods = [
    {
      methodName: 'Muslim World League',
      methodCode: 'MWL',
      description: 'Muslim World League method',
      fajrAngle: 18,
      ishaAngle: 17,
      maghribAngle: 0,
      midnightMode: 'Standard',
    },
    {
      methodName: 'Islamic Society of North America',
      methodCode: 'ISNA',
      description: 'Islamic Society of North America method',
      fajrAngle: 15,
      ishaAngle: 15,
      maghribAngle: 0,
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

  // Create Prayer Locations
  console.log('📍 Creating prayer locations...');
  const locations = [
    {
      locKey: 'loc_mecca',
      lat: 21.4225,
      lng: 39.8262,
      city: 'Mecca',
      country: 'Saudi Arabia',
      timezone: 'Asia/Riyadh',
      elevation: 277,
    },
    {
      locKey: 'loc_medina',
      lat: 24.5247,
      lng: 39.5692,
      city: 'Medina',
      country: 'Saudi Arabia',
      timezone: 'Asia/Riyadh',
      elevation: 608,
    },
  ];

  for (const location of locations) {
    await prisma.prayerLocation.upsert({
      where: { locKey: location.locKey },
      update: location,
      create: location,
    });
  }

  console.log('✅ Database seeding completed!');
}

main()
  .catch((e) => {
    console.error('❌ Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
