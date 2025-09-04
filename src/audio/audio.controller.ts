import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { AudioService, AudioMetadata, AudioQuality } from './audio.service';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Quran')
@Controller('audio')
export class AudioController {
  constructor(private readonly audioService: AudioService) {}

  @Get('verse/:reciterId/:chapterId/:verseNumber')
  async getVerseAudio(
    @Param('reciterId', ParseIntPipe) reciterId: number,
    @Param('chapterId', ParseIntPipe) chapterId: number,
    @Param('verseNumber', ParseIntPipe) verseNumber: number,
    @Query('quality') quality?: string,
  ) {
    const audioMetadata = await this.audioService.getVerseAudio(
      reciterId,
      chapterId,
      verseNumber,
      quality || '128kbps',
    );

    return {
      success: true,
      data: { audioMetadata },
      meta: {
        type: 'verse',
        reciterId,
        chapterId,
        verseNumber,
        quality: audioMetadata.quality,
        cacheTtl: '1 hour',
      },
    };
  }

  @Get('chapter/:reciterId/:chapterId')
  async getChapterAudio(
    @Param('reciterId', ParseIntPipe) reciterId: number,
    @Param('chapterId', ParseIntPipe) chapterId: number,
    @Query('quality') quality?: string,
  ) {
    const audioMetadata = await this.audioService.getChapterAudio(
      reciterId,
      chapterId,
      quality || '128kbps',
    );

    return {
      success: true,
      data: { audioMetadata },
      meta: {
        type: 'chapter',
        reciterId,
        chapterId,
        quality: audioMetadata.quality,
        cacheTtl: '1 hour',
      },
    };
  }

  @Get('qualities')
  async getAvailableQualities() {
    const qualities = await this.audioService.getAvailableQualities();

    return {
      success: true,
      data: { qualities },
      meta: {
        totalQualities: qualities.length,
        recommended: qualities.find(q => q.recommended)?.code,
        cacheTtl: '24 hours',
      },
    };
  }

  @Get('reciter/:reciterId/stats')
  async getReciterAudioStats(@Param('reciterId', ParseIntPipe) reciterId: number) {
    const stats = await this.audioService.getReciterAudioStats(reciterId);

    return {
      success: true,
      data: { stats },
      meta: {
        reciterId,
        cacheTtl: '6 hours',
        note: 'Audio statistics for reciter',
      },
    };
  }

  @Get('search')
  async searchAudio(
    @Query('q') query: string,
    @Query('reciter') reciterId?: string,
    @Query('quality') quality?: string,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
  ) {
    if (!query) {
      return {
        success: false,
        error: 'Search query is required',
      };
    }

    const pageNum = page ? parseInt(page) : 1;
    const perPageNum = perPage ? parseInt(perPage) : 20;
    const reciter = reciterId ? parseInt(reciterId) : undefined;

    const result = await this.audioService.searchAudio(
      query,
      reciter,
      quality,
      pageNum,
      perPageNum,
    );

    return {
      success: true,
      data: result,
      meta: {
        query,
        reciterId: reciter,
        quality,
        cacheTtl: '30 minutes',
      },
    };
  }

  @Get('validate')
  async validateAudioUrl(@Query('url') url: string) {
    if (!url) {
      return {
        success: false,
        error: 'URL parameter is required',
      };
    }

    const isValid = await this.audioService.validateAudioUrl(url);

    return {
      success: true,
      data: { isValid, url },
      meta: {
        note: 'URL validation result',
      },
    };
  }
}
