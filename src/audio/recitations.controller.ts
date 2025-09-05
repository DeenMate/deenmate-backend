import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { AudioService } from './audio.service';
import { PrismaService } from '../database/prisma.service';
import { ApiTags, ApiOperation, ApiParam, ApiQuery, ApiResponse } from '@nestjs/swagger';

@ApiTags('Audio v4')
@Controller({ path: 'recitations', version: '4' })
export class RecitationsController {
  constructor(
    private readonly audioService: AudioService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':id/by_ayah/:verseKey')
  @ApiOperation({ 
    summary: 'Get audio for specific verse by reciter',
    description: 'Quran.com API compatible endpoint for getting audio by verse key (e.g., 1:1, 2:255)'
  })
  @ApiParam({ name: 'id', description: 'Reciter ID', type: 'number' })
  @ApiParam({ name: 'verseKey', description: 'Verse key in format chapter:verse (e.g., 1:1, 2:255)', type: 'string' })
  @ApiQuery({ name: 'quality', required: false, description: 'Audio quality (128kbps, 192kbps, 320kbps)', type: 'string' })
  @ApiResponse({ status: 200, description: 'Audio metadata for the verse' })
  async getAudioByAyah(
    @Param('id', ParseIntPipe) reciterId: number,
    @Param('verseKey') verseKey: string,
    @Query('quality') quality?: string,
  ) {
    // Parse verse key (e.g., "1:1" -> chapter 1, verse 1)
    const [chapterId, verseNumber] = verseKey.split(':').map(Number);
    
    if (!chapterId || !verseNumber || isNaN(chapterId) || isNaN(verseNumber)) {
      throw new Error(`Invalid verse key format: ${verseKey}. Expected format: chapter:verse (e.g., 1:1)`);
    }

    const audioMetadata = await this.audioService.getVerseAudio(
      reciterId,
      chapterId,
      verseNumber,
      quality || '128kbps',
    );

    // Return Quran.com API compatible format
    return {
      audio_files: [
        {
          verse_key: verseKey,
          url: audioMetadata.url.replace('https://audio.qurancdn.com/', '').replace('https://mirrors.quranicaudio.com/everyayah/', '//mirrors.quranicaudio.com/everyayah/'),
        }
      ],
      pagination: {
        per_page: 1,
        current_page: 1,
        next_page: null,
        total_pages: 1,
        total_records: 1,
      }
    };
  }

  @Get(':id/by_chapter/:chapterId')
  @ApiOperation({ 
    summary: 'Get audio for entire chapter by reciter',
    description: 'Quran.com API compatible endpoint for getting audio for all verses in a chapter'
  })
  @ApiParam({ name: 'id', description: 'Reciter ID', type: 'number' })
  @ApiParam({ name: 'chapterId', description: 'Chapter ID (1-114)', type: 'number' })
  @ApiQuery({ name: 'quality', required: false, description: 'Audio quality (128kbps, 192kbps, 320kbps)', type: 'string' })
  @ApiQuery({ name: 'page', required: false, description: 'Page number for pagination', type: 'number' })
  @ApiQuery({ name: 'per_page', required: false, description: 'Number of verses per page', type: 'number' })
  @ApiResponse({ status: 200, description: 'Audio metadata for chapter verses' })
  async getAudioByChapter(
    @Param('id', ParseIntPipe) reciterId: number,
    @Param('chapterId', ParseIntPipe) chapterId: number,
    @Query('quality') quality?: string,
    @Query('page') page?: number,
    @Query('per_page') perPage?: number,
  ) {
    const currentPage = page || 1;
    const limit = perPage || 10;
    
    // Get actual verses for the chapter from database
    const verses = await this.prisma.quranVerse.findMany({
      where: { chapterNumber: chapterId },
      orderBy: { verseNumber: 'asc' },
      take: limit,
      skip: (currentPage - 1) * limit,
    });

    const audioFiles = [];
    
    for (const verse of verses) {
      try {
        const audioMetadata = await this.audioService.getVerseAudio(
          reciterId,
          chapterId,
          verse.verseNumber,
          quality || '128kbps',
        );

        audioFiles.push({
          verse_key: `${chapterId}:${verse.verseNumber}`,
          url: audioMetadata.url.replace('https://audio.qurancdn.com/', '').replace('https://mirrors.quranicaudio.com/everyayah/', '//mirrors.quranicaudio.com/everyayah/'),
        });
      } catch (error) {
        // Skip verses that don't exist
        continue;
      }
    }

    // Get total count for pagination
    const totalVerses = await this.prisma.quranVerse.count({
      where: { chapterNumber: chapterId }
    });

    return {
      audio_files: audioFiles,
      pagination: {
        per_page: limit,
        current_page: currentPage,
        next_page: (currentPage * limit) < totalVerses ? currentPage + 1 : null,
        total_pages: Math.ceil(totalVerses / limit),
        total_records: totalVerses,
      }
    };
  }
}
