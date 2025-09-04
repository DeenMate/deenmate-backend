import { Controller, Get, Param, Query, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { QuranService } from '../services/quran.service';

@Controller('quran')
export class QuranController {
  constructor(private readonly quranService: QuranService) {}

  /**
   * GET /api/v1/quran/chapters
   * Get all Quran chapters
   */
  @Get('chapters')
  async getChapters(@Res() res: Response) {
    try {
      const result = await this.quranService.getChapters();
      
      // Add source header for debugging
      res.setHeader('X-DeenMate-Source', result.source);
      
      // Return the exact same structure as upstream API
      return res.status(HttpStatus.OK).json({
        code: 200,
        status: 'OK',
        data: {
          chapters: result.data
        }
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 500,
        status: 'Internal Server Error',
        data: null
      });
    }
  }

  /**
   * GET /api/v1/quran/verses/by_chapter/:id
   * Get verses by chapter ID
   */
  @Get('verses/by_chapter/:id')
  async getVersesByChapter(
    @Res() res: Response,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
    @Query('words') words?: string,
    @Query('fields') fields?: string,
    @Query('translations') translations?: string,
    @Query('media') media?: string,
    @Query('language') language?: string,
    @Query('text_type') textType?: string,
  ) {
    try {
      const chapterId = parseInt(id, 10);
      if (isNaN(chapterId)) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request',
          data: null
        });
      }

      const result = await this.quranService.getVersesByChapter(
        chapterId,
        page ? parseInt(page, 10) : undefined,
        perPage ? parseInt(perPage, 10) : undefined,
        words === 'true',
        fields,
        translations ? translations.split(',').map(t => parseInt(t, 10)) : undefined,
        media ? media.split(',').map(m => parseInt(m, 10)) : undefined,
        language,
        textType,
      );
      
      // Add source header for debugging
      res.setHeader('X-DeenMate-Source', result.source);
      
      // Return the exact same structure as upstream API
      return res.status(HttpStatus.OK).json(result.data);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 500,
        status: 'Internal Server Error',
        data: null
      });
    }
  }

  /**
   * GET /api/v1/quran/verses/by_id/:id
   * Get verse by ID
   */
  @Get('verses/by_id/:id')
  async getVerseById(
    @Res() res: Response,
    @Param('id') id: string,
    @Query('words') words?: string,
    @Query('fields') fields?: string,
    @Query('translations') translations?: string,
    @Query('media') media?: string,
    @Query('language') language?: string,
    @Query('text_type') textType?: string,
  ) {
    try {
      const verseId = parseInt(id, 10);
      if (isNaN(verseId)) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request',
          data: null
        });
      }

      const result = await this.quranService.getVerseById(
        verseId,
        words === 'true',
        fields,
        translations ? translations.split(',').map(t => parseInt(t, 10)) : undefined,
        media ? media.split(',').map(m => parseInt(m, 10)) : undefined,
        language,
        textType,
      );
      
      // Add source header for debugging
      res.setHeader('X-DeenMate-Source', result.source);
      
      // Return the exact same structure as upstream API
      return res.status(HttpStatus.OK).json(result.data);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 500,
        status: 'Internal Server Error',
        data: null
      });
    }
  }

  /**
   * GET /api/v1/quran/resources/translations
   * Get available translations
   */
  @Get('resources/translations')
  async getTranslations(@Res() res: Response) {
    try {
      const result = await this.quranService.getTranslations();
      
      // Add source header for debugging
      res.setHeader('X-DeenMate-Source', result.source);
      
      // Return the exact same structure as upstream API
      return res.status(HttpStatus.OK).json({
        code: 200,
        status: 'OK',
        data: {
          translations: result.data
        }
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 500,
        status: 'Internal Server Error',
        data: null
      });
    }
  }

  /**
   * GET /api/v1/quran/resources/recitations
   * Get available reciters
   */
  @Get('resources/recitations')
  async getReciters(@Res() res: Response) {
    try {
      const result = await this.quranService.getReciters();
      
      // Add source header for debugging
      res.setHeader('X-DeenMate-Source', result.source);
      
      // Return the exact same structure as upstream API
      return res.status(HttpStatus.OK).json({
        code: 200,
        status: 'OK',
        data: {
          recitations: result.data
        }
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 500,
        status: 'Internal Server Error',
        data: null
      });
    }
  }

  /**
   * GET /api/v1/quran/search
   * Search Quran
   */
  @Get('search')
  async searchQuran(
    @Res() res: Response,
    @Query('q') q: string,
    @Query('size') size?: string,
    @Query('filter_chapter_id') filterChapterId?: string,
    @Query('filter_juz_number') filterJuzNumber?: string,
    @Query('filter_hizb_number') filterHizbNumber?: string,
    @Query('filter_page_number') filterPageNumber?: string,
    @Query('filter_rub_number') filterRubNumber?: string,
  ) {
    try {
      if (!q) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - Query parameter "q" is required',
          data: null
        });
      }

      const result = await this.quranService.searchQuran(
        q,
        size ? parseInt(size, 10) : undefined,
        undefined, // page parameter
        undefined, // fields parameter
        undefined, // translations parameter
        undefined, // language parameter
        filterChapterId ? parseInt(filterChapterId, 10) : undefined,
        filterJuzNumber ? parseInt(filterJuzNumber, 10) : undefined,
        filterHizbNumber ? parseInt(filterHizbNumber, 10) : undefined,
        filterPageNumber ? parseInt(filterPageNumber, 10) : undefined,
        filterRubNumber ? parseInt(filterRubNumber, 10) : undefined,
      );
      
      // Add source header for debugging
      res.setHeader('X-DeenMate-Source', result.source);
      
      // Return the exact same structure as upstream API
      return res.status(HttpStatus.OK).json(result.data);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 500,
        status: 'Internal Server Error',
        data: null
      });
    }
  }

  /**
   * GET /api/v1/quran/juz/:number
   * Get juz information
   */
  @Get('juz/:number')
  async getJuz(
    @Res() res: Response,
    @Param('number') number: string,
  ) {
    try {
      const juzNumber = parseInt(number, 10);
      if (isNaN(juzNumber) || juzNumber < 1 || juzNumber > 30) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - Juz number must be between 1 and 30',
          data: null
        });
      }

      const result = await this.quranService.getJuz(juzNumber);
      
      // Add source header for debugging
      res.setHeader('X-DeenMate-Source', result.source);
      
      // Return the exact same structure as upstream API
      return res.status(HttpStatus.OK).json(result.data);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 500,
        status: 'Internal Server Error',
        data: null
      });
    }
  }

  /**
   * GET /api/v1/quran/hizb/:number
   * Get hizb information
   */
  @Get('hizb/:number')
  async getHizb(
    @Res() res: Response,
    @Param('number') number: string,
  ) {
    try {
      const hizbNumber = parseInt(number, 10);
      if (isNaN(hizbNumber) || hizbNumber < 1 || hizbNumber > 60) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - Hizb number must be between 1 and 60',
          data: null
        });
      }

      const result = await this.quranService.getHizb(hizbNumber);
      
      // Add source header for debugging
      res.setHeader('X-DeenMate-Source', result.source);
      
      // Return the exact same structure as upstream API
      return res.status(HttpStatus.OK).json(result.data);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 500,
        status: 'Internal Server Error',
        data: null
      });
    }
  }

  /**
   * GET /api/v1/quran/page/:number
   * Get page information
   */
  @Get('page/:number')
  async getPage(
    @Res() res: Response,
    @Param('number') number: string,
  ) {
    try {
      const pageNumber = parseInt(number, 10);
      if (isNaN(pageNumber) || pageNumber < 1 || pageNumber > 604) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - Page number must be between 1 and 604',
          data: null
        });
      }

      const result = await this.quranService.getPage(pageNumber);
      
      // Add source header for debugging
      res.setHeader('X-DeenMate-Source', result.source);
      
      // Return the exact same structure as upstream API
      return res.status(HttpStatus.OK).json(result.data);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 500,
        status: 'Internal Server Error',
        data: null
      });
    }
  }

  /**
   * GET /api/v1/quran/chapters/:id
   * Get specific chapter information
   */
  @Get('chapters/:id')
  async getChapter(
    @Res() res: Response,
    @Param('id') id: string,
  ) {
    try {
      const chapterId = parseInt(id, 10);
      if (isNaN(chapterId) || chapterId < 1 || chapterId > 114) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          code: 400,
          status: 'Bad Request - Chapter ID must be between 1 and 114',
          data: null
        });
      }

      // Get all chapters and find the specific one
      const result = await this.quranService.getChapters();
      const chapter = result.data.find(c => c.id === chapterId);
      
      if (!chapter) {
        return res.status(HttpStatus.NOT_FOUND).json({
          code: 404,
          status: 'Not Found',
          data: null
        });
      }
      
      // Add source header for debugging
      res.setHeader('X-DeenMate-Source', result.source);
      
      // Return the exact same structure as upstream API
      return res.status(HttpStatus.OK).json({
        code: 200,
        status: 'OK',
        data: {
          chapter: chapter
        }
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        code: 500,
        status: 'Internal Server Error',
        data: null
      });
    }
  }
}
