import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class AudioSeedService {
  private readonly logger = new Logger(AudioSeedService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Seed reciters with known data
   */
  async seedReciters(): Promise<void> {
    this.logger.log('Starting reciters seed...');

    const reciters = [
      {
        sourceId: 7,
        sourceApi: 'quran.com',
        name: 'Mishary Rashid Alafasy',
        englishName: 'Mishary Rashid Alafasy',
        languageName: 'arabic',
        style: 'Murattal',
        qirat: 'Hafs',
        isActive: true,
      },
      {
        sourceId: 1,
        sourceApi: 'quran.com',
        name: 'Abdul Basit Murattal',
        englishName: 'Abdul Basit Murattal',
        languageName: 'arabic',
        style: 'Murattal',
        qirat: 'Hafs',
        isActive: true,
      },
      {
        sourceId: 2,
        sourceApi: 'quran.com',
        name: 'Abdul Basit Mujawwad',
        englishName: 'Abdul Basit Mujawwad',
        languageName: 'arabic',
        style: 'Mujawwad',
        qirat: 'Hafs',
        isActive: true,
      },
      {
        sourceId: 3,
        sourceApi: 'quran.com',
        name: 'Abdullah Matroud',
        englishName: 'Abdullah Matroud',
        languageName: 'arabic',
        style: 'Murattal',
        qirat: 'Hafs',
        isActive: true,
      },
      {
        sourceId: 4,
        sourceApi: 'quran.com',
        name: 'Abdurrahmaan As-Sudais',
        englishName: 'Abdurrahmaan As-Sudais',
        languageName: 'arabic',
        style: 'Murattal',
        qirat: 'Hafs',
        isActive: true,
      },
    ];

    for (const reciter of reciters) {
      try {
        // Check if reciter already exists
        const existingReciter = await this.prisma.quranReciter.findFirst({
          where: { sourceId: reciter.sourceId },
        });

        if (existingReciter) {
          // Update existing reciter
          await this.prisma.quranReciter.update({
            where: { id: existingReciter.id },
            data: reciter,
          });
        } else {
          // Create new reciter
          await this.prisma.quranReciter.create({
            data: reciter,
          });
        }
        
        this.logger.log(`Seeded reciter: ${reciter.name}`);
      } catch (error) {
        this.logger.error(`Failed to seed reciter ${reciter.name}: ${error.message}`);
      }
    }

    this.logger.log('Reciters seed completed');
  }

  /**
   * Seed audio files for first few chapters
   */
  async seedAudioFiles(): Promise<void> {
    this.logger.log('Starting audio files seed...');

    const reciters = await this.prisma.quranReciter.findMany({
      where: { isActive: true },
    });

    if (reciters.length === 0) {
      this.logger.warn('No reciters found. Please seed reciters first.');
      return;
    }

    // Get verses for first 3 chapters
    const verses = await this.prisma.quranVerse.findMany({
      where: {
        chapterNumber: { lte: 3 },
      },
      select: { id: true, chapterNumber: true, verseNumber: true },
    });

    let audioFilesProcessed = 0;

    for (const reciter of reciters) {
      for (const verse of verses) {
        try {
          const audioUrl = this.generateAudioUrl(reciter.sourceId, verse.chapterNumber, verse.verseNumber);
          
          await this.prisma.quranAudioFile.upsert({
            where: {
              verseId_reciterId: {
                verseId: verse.id,
                reciterId: reciter.id,
              },
            },
            update: {
              sourceUrl: audioUrl,
              lastVerified: new Date(),
            },
            create: {
              verseId: verse.id,
              reciterId: reciter.id,
              sourceUrl: audioUrl,
              format: 'mp3',
              quality: '128kbps',
              lastVerified: new Date(),
            },
          });

          audioFilesProcessed++;
        } catch (error) {
          this.logger.error(`Failed to seed audio file for verse ${verse.chapterNumber}:${verse.verseNumber}: ${error.message}`);
        }
      }
    }

    this.logger.log(`Audio files seed completed. Processed ${audioFilesProcessed} audio files.`);
  }

  /**
   * Generate audio URL for a verse
   */
  private generateAudioUrl(reciterId: number, chapterId: number, verseNumber: number): string {
    const reciterMap: { [key: number]: string } = {
      7: 'Alafasy',  // Verified working
      1: 'Alafasy',  // Fallback to Alafasy for now
      2: 'Alafasy',  // Fallback to Alafasy for now
      3: 'Alafasy',  // Fallback to Alafasy for now
      4: 'Sudais',   // Verified working
    };

    const reciterName = reciterMap[reciterId] || 'Alafasy';
    const paddedChapter = chapterId.toString().padStart(3, '0');
    const paddedVerse = verseNumber.toString().padStart(3, '0');
    const fileName = `${paddedChapter}${paddedVerse}.mp3`;

    return `https://audio.qurancdn.com/${reciterName}/mp3/${fileName}`;
  }

  /**
   * Run full seed process
   */
  async runFullSeed(): Promise<void> {
    this.logger.log('Starting full audio seed process...');
    
    await this.seedReciters();
    await this.seedAudioFiles();
    
    this.logger.log('Full audio seed process completed');
  }
}
