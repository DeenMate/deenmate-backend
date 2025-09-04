import { Controller, Get, Param, Query, Res } from '@nestjs/common';
import { Response } from 'express';
import { QuranService } from './quran.service';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

// Define the response types from the service
type ServiceResponse = {
  code: number;
  status: string;
  data?: any;
  headers?: Record<string, string>;
  message?: string;
  error?: any;
};

@ApiTags('Quran')
@Controller('quran')
export class QuranController {
  constructor(private readonly quranService: QuranService) {}

  @Get('chapters')
  @ApiOperation({ summary: 'List chapters (surahs)', description: 'Upstream-compatible with api.quran.com/v4/chapters' })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', default: 1 } })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 10 } })
  @ApiResponse({ status: 200, description: 'Success' })
  async getChapters(
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Res() res: Response,
  ) {
    const result = await this.quranService.getChapters(
      parseInt(page.toString()),
      parseInt(limit.toString()),
    ) as ServiceResponse;
    
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    if (!res.getHeader('X-DeenMate-Source')) {
      res.setHeader('X-DeenMate-Source', 'live-sync');
      res.setHeader('X-DeenMate-Cache', 'miss');
    }
    return res.json(result);
  }

  @Get('chapters/:chapterNumber')
  @ApiOperation({ summary: 'Get chapter by number', description: 'Upstream-compatible with api.quran.com/v4/chapters/{id}' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async getChapter(
    @Param('chapterNumber') chapterNumber: string,
    @Res() res: Response,
  ) {
    const result = await this.quranService.getChapter(
      parseInt(chapterNumber),
    ) as ServiceResponse;
    
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    if (!res.getHeader('X-DeenMate-Source')) {
      res.setHeader('X-DeenMate-Source', 'live-sync');
      res.setHeader('X-DeenMate-Cache', 'miss');
    }
    return res.json(result);
  }

  @Get('chapters/:chapterNumber/verses')
  @ApiOperation({ summary: 'List verses by chapter', description: 'Upstream-compatible with api.quran.com/v4/verses/by_chapter/{chapter}' })
  @ApiQuery({ name: 'language', required: false, description: 'e.g., en' })
  @ApiQuery({ name: 'translations', required: false, description: 'Comma-separated translation resource IDs' })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', default: 1 } })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 10 } })
  @ApiResponse({ status: 200, description: 'Success' })
  async getChapterVerses(
    @Param('chapterNumber') chapterNumber: string,
    @Query('language') language: string,
    @Query('translations') translationsStr: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Res() res: Response,
  ) {
    // If translations requested, mirror Quran.com behavior via fallback
    if (translationsStr) {
      const translations = translationsStr.split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => !isNaN(n));
      const result = await this.quranService.getVersesByChapterWithTranslations(
        parseInt(chapterNumber), language, translations, parseInt(page.toString()), parseInt(limit.toString())
      ) as ServiceResponse;
      if (result.headers) Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
      if (!res.getHeader('X-DeenMate-Source')) {
        res.setHeader('X-DeenMate-Source', 'live-sync');
        res.setHeader('X-DeenMate-Cache', 'miss');
      }
      return res.json(result);
    }

    const result = await this.quranService.getVersesByChapter(
      parseInt(chapterNumber),
      parseInt(page.toString()),
      parseInt(limit.toString()),
    ) as ServiceResponse;
    
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    if (!res.getHeader('X-DeenMate-Source')) {
      res.setHeader('X-DeenMate-Source', 'live-sync');
      res.setHeader('X-DeenMate-Cache', 'miss');
    }
    return res.json(result);
  }

  @Get('verses/:verseKey')
  @ApiOperation({ summary: 'Get verse by key', description: 'Upstream-compatible with api.quran.com/v4/verses/by_key/{key}' })
  @ApiQuery({ name: 'language', required: false, description: 'e.g., en' })
  @ApiQuery({ name: 'translations', required: false, description: 'Comma-separated translation resource IDs' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async getVerse(
    @Param('verseKey') verseKey: string,
    @Query('language') language: string,
    @Query('translations') translationsStr: string,
    @Res() res: Response,
  ) {
    if (translationsStr) {
      const translations = translationsStr.split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => !isNaN(n));
      const result = await this.quranService.getVerseWithTranslations(verseKey, language, translations) as ServiceResponse;
      if (result.headers) Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
      if (!res.getHeader('X-DeenMate-Source')) {
        res.setHeader('X-DeenMate-Source', 'live-sync');
        res.setHeader('X-DeenMate-Cache', 'miss');
      }
      return res.json(result);
    }

    const result = await this.quranService.getVerse(verseKey) as ServiceResponse;
    
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    if (!res.getHeader('X-DeenMate-Source')) {
      res.setHeader('X-DeenMate-Source', 'live-sync');
      res.setHeader('X-DeenMate-Cache', 'miss');
    }
    return res.json(result);
  }

  @Get('translations')
  @ApiOperation({ summary: 'List translation resources', description: 'Upstream-compatible with api.quran.com/v4/resources/translations' })
  @ApiQuery({ name: 'language', required: false, description: 'Filter by language code (e.g., en, bn)' })
  @ApiResponse({ status: 200, description: 'Success' })
  async getTranslations(@Query('language') language: string, @Res() res: Response) {
    const result = await this.quranService.getTranslationResourcesFiltered(language) as ServiceResponse;
    
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    if (!res.getHeader('X-DeenMate-Source')) {
      res.setHeader('X-DeenMate-Source', 'live-sync');
      res.setHeader('X-DeenMate-Cache', 'miss');
    }
    return res.json(result);
  }

  @Get('verses/:verseKey/translations')
  @ApiOperation({ summary: 'List translations for a verse', description: 'Upstream-compatible with api.quran.com/v4/verses/by_key/{key}/translations' })
  @ApiQuery({ name: 'resource_ids', required: false, description: 'Comma-separated translation resource IDs' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  async getVerseTranslations(
    @Param('verseKey') verseKey: string,
    @Query('resource_ids') resourceIdsStr: string,
    @Res() res: Response,
  ) {
    const resourceIds = resourceIdsStr
      ? resourceIdsStr.split(',').map((x) => parseInt(x.trim(), 10)).filter((n) => !isNaN(n))
      : undefined;

    const result = await this.quranService.getVerseTranslations(verseKey, resourceIds) as ServiceResponse & { message?: string };

    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    if (!res.getHeader('X-DeenMate-Source')) {
      res.setHeader('X-DeenMate-Source', 'live-sync');
      res.setHeader('X-DeenMate-Cache', 'miss');
    }

    if (result.code && result.code !== 200) {
      return res.status(result.code).json(result);
    }
    return res.json(result);
  }

  @Get('reciters')
  @ApiOperation({ summary: 'List popular reciters', description: 'Upstream-compatible with api.quran.com/v4/resources/recitations' })
  @ApiQuery({ name: 'language', required: false, description: 'Filter by language code (e.g., en)' })
  @ApiResponse({ status: 200, description: 'Success' })
  async getReciters(@Query('language') language: string, @Res() res: Response) {
    const result = await this.quranService.getReciters(language) as ServiceResponse;
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => res.setHeader(key, value));
    }
    if (!res.getHeader('X-DeenMate-Source')) {
      res.setHeader('X-DeenMate-Source', 'live-sync');
      res.setHeader('X-DeenMate-Cache', 'miss');
    }
    return res.json(result);
  }

  @Get('recitations/:recitationId/by_chapter/:chapterNumber')
  @ApiOperation({ summary: 'Audio files for a whole surah (verse-by-verse)', description: 'Upstream-compatible with api.quran.com/v4/recitations/{recitation_id}/by_chapter/{chapter_id}' })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer' } })
  @ApiQuery({ name: 'per_page', required: false, schema: { type: 'integer' } })
  @ApiResponse({ status: 200, description: 'Success' })
  async getRecitationByChapter(
    @Param('recitationId') recitationId: string,
    @Param('chapterNumber') chapterNumber: string,
    @Query('page') page: string,
    @Query('per_page') perPage: string,
    @Res() res: Response,
  ) {
    const result = await this.quranService.getRecitationByChapter(
      parseInt(recitationId, 10),
      parseInt(chapterNumber, 10),
      page ? parseInt(page, 10) : undefined,
      perPage ? parseInt(perPage, 10) : undefined,
    ) as ServiceResponse;
    if (result.headers) Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
    if (!res.getHeader('X-DeenMate-Source')) {
      res.setHeader('X-DeenMate-Source', 'live-sync');
      res.setHeader('X-DeenMate-Cache', 'miss');
    }
    return res.json(result);
  }

  @Get('recitations/:recitationId/by_ayah/:verseKey')
  @ApiOperation({ summary: 'Audio for a specific ayah', description: 'Upstream-compatible with api.quran.com/v4/recitations/{recitation_id}/by_ayah/{verse_key}' })
  @ApiResponse({ status: 200, description: 'Success' })
  async getRecitationByAyah(
    @Param('recitationId') recitationId: string,
    @Param('verseKey') verseKey: string,
    @Res() res: Response,
  ) {
    const result = await this.quranService.getRecitationByAyah(parseInt(recitationId, 10), verseKey) as ServiceResponse;
    if (result.headers) Object.entries(result.headers).forEach(([k, v]) => res.setHeader(k, v));
    if (!res.getHeader('X-DeenMate-Source')) {
      res.setHeader('X-DeenMate-Source', 'live-sync');
      res.setHeader('X-DeenMate-Cache', 'miss');
    }
    return res.json(result);
  }

  @Get('tafsirs')
  @ApiOperation({ summary: 'List tafsir resources', description: 'Upstream-compatible with api.quran.com/v4/resources/tafsirs' })
  @ApiQuery({ name: 'language', required: false, description: 'Filter by language code (e.g., en)' })
  @ApiResponse({ status: 200, description: 'Success' })
  async getTafsirs(@Query('language') language: string, @Res() res: Response) {
    const result = await this.quranService.getTafsirResources(language) as ServiceResponse;
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => res.setHeader(key, value));
    }
    if (!res.getHeader('X-DeenMate-Source')) {
      res.setHeader('X-DeenMate-Source', 'live-sync');
      res.setHeader('X-DeenMate-Cache', 'miss');
    }
    return res.json(result);
  }

  @Get('verses/:verseKey/tafsir')
  @ApiOperation({ summary: 'Get tafsir for a verse', description: 'Upstream-compatible with api.quran.com/v4/verses/by_key/{key}/tafsirs' })
  @ApiQuery({ name: 'tafsirId', required: false, schema: { type: 'integer' } })
  @ApiResponse({ status: 200, description: 'Success' })
  async getVerseTafsir(
    @Param('verseKey') verseKey: string,
    @Query('tafsirId') tafsirId: string,
    @Res() res: Response,
  ) {
    const result = await this.quranService.getVerseTafsir(verseKey, tafsirId ? parseInt(tafsirId, 10) : undefined) as ServiceResponse;
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => res.setHeader(key, value));
    }
    if (!res.getHeader('X-DeenMate-Source')) {
      res.setHeader('X-DeenMate-Source', 'live-sync');
      res.setHeader('X-DeenMate-Cache', 'miss');
    }
    return res.json(result);
  }

  @Get('search')
  @ApiOperation({ summary: 'Search Quran', description: 'Upstream-compatible with api.quran.com/v4/search' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', default: 1 } })
  @ApiQuery({ name: 'limit', required: false, schema: { type: 'integer', default: 10 } })
  @ApiResponse({ status: 200, description: 'Success' })
  async searchQuran(
    @Query('q') query: string,
    @Query('page') page = 1,
    @Query('limit') limit = 10,
    @Res() res: Response,
  ) {
    const result = await this.quranService.searchQuran(
      query,
      parseInt(page.toString()),
      parseInt(limit.toString()),
    ) as ServiceResponse;
    
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value);
      });
    }
    if (!res.getHeader('X-DeenMate-Source')) {
      res.setHeader('X-DeenMate-Source', 'live-sync');
      res.setHeader('X-DeenMate-Cache', 'miss');
    }
    return res.json(result);
  }
}
