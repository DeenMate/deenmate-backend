/*
 Backfill missing Bangla chapter names for Quran chapters.
 - Fetches chapter metadata from Quran.com (bn language)
 - Upserts Bangla name into the chapter record when missing (N/A/null)

 Usage:
   node scripts/backfill-quran-chapter-bn-names.js
*/

const axios = require('axios');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fetchBnChapters() {
  // Quran.com chapters endpoint with language=bn
  const url = 'https://api.quran.com/api/v4/chapters?language=bn';
  const res = await axios.get(url, { timeout: 20000 });
  return res.data && res.data.chapters ? res.data.chapters : [];
}

async function main() {
  console.log('[backfill-quran-chapter-bn-names] starting');
  const chaptersBn = await fetchBnChapters();

  // Build map: chapter_number -> bn_name (Quran.com returns id as chapter number)
  const bnByNumber = new Map();
  for (const ch of chaptersBn) {
    if (ch.id && (ch.name_simple || ch.name_arabic)) {
      const bn = ch.translated_name?.name || ch.name_simple || null;
      if (bn) bnByNumber.set(ch.id, bn);
    }
  }

  // Expected model: QuranChapter with fields: id (number), bnName (nullable string)
  const chapters = await prisma.quranChapter.findMany({});
  let updated = 0;
  for (const ch of chapters) {
    const bnCandidate = bnByNumber.get(ch.chapterNumber || ch.id);
    const needsUpdate = (!ch.nameBangla || ch.nameBangla === 'N/A') && bnCandidate;
    if (needsUpdate) {
      await prisma.quranChapter.update({
        where: { id: ch.id },
        data: { nameBangla: bnCandidate },
      });
      updated += 1;
      console.log(`[update] chapter id=${ch.id} -> bnName='${bnCandidate}'`);
    }
  }

  await prisma.$disconnect();
  console.log(`[backfill-quran-chapter-bn-names] done. updated=${updated}`);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});


