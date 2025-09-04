import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { RedisService } from '../redis/redis.service';
import { firstValueFrom } from 'rxjs';

export interface QuranChapter {
  id: number;
  chapter_number: number;
  name_arabic: string;
  name_english: string;
  name_complex: string;
  revelation_place: string;
  revelation_order: number;
  bismillah_pre: boolean;
  verses_count: number;
  pages: number[];
  translated_name: {
    language_name: string;
    name: string;
  };
}

export interface QuranVerse {
  id: number;
  verse_number: number;
  text_uthmani: string;
  text_indopak: string;
  juz: number;
  hizb: number;
  page: number;
  sajda: boolean;
  sajda_type?: string;
  sajda_number?: number;
}

export interface QuranTranslation {
  id: number;
  language_name: string;
  name: string;
  author_name: string;
  slug: string;
  language_id: number;
  translations_count: number;
  links: {
    self: string;
    verses: string;
    chapters: string;
  };
}

export interface QuranReciter {
  id: number;
  name: string;
  server: string;
  recitations_count: number;
  style: string;
  translated_name: {
    language_name: string;
    name: string;
  };
}

@Injectable()
export class QuranService {
  private readonly logger = new Logger(QuranService.name);
  private readonly quranApiBase: string;
  private readonly cacheEnabled: boolean;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly redisService: RedisService,
  ) {
    this.quranApiBase = this.configService.get<string>('QURAN_API_BASE', 'https://api.quran.com/v4');
    this.cacheEnabled = this.configService.get<boolean>('REDIS_ENABLED', false);
    this.logger.log(`Quran API Base: ${this.quranApiBase}`);
  }

  /**
   * Get all Quran chapters
   */
  async getChapters(): Promise<{ data: QuranChapter[]; source: string }> {
    const cacheKey = 'quran:chapters';
    
    try {
      // Check cache first if enabled
      if (this.cacheEnabled) {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          this.logger.log('Returning chapters from cache');
          return { data: JSON.parse(cached), source: 'cache' };
        }
      }

      // Fetch from upstream API
      this.logger.log('Fetching chapters from upstream API');
      const response = await firstValueFrom(
        this.httpService.get(`${this.quranApiBase}/chapters`)
      );

      const chapters = response.data.chapters;
      
      // Cache the response if enabled
      if (this.cacheEnabled) {
        await this.redisService.set(cacheKey, JSON.stringify(chapters), 86400); // 24 hours
      }

      this.logger.log(`Fetched ${chapters.length} chapters from upstream`);
      return { data: chapters, source: 'upstream' };
    } catch (error) {
      this.logger.error('Error fetching chapters:', error.message);
      throw new HttpException(
        'Failed to fetch Quran chapters',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get verses by chapter ID
   */
  async getVersesByChapter(
    chapterId: number,
    page?: number,
    perPage?: number,
    words?: boolean,
    fields?: string,
    translations?: number[],
    media?: number[],
    language?: string,
    text_type?: string,
  ): Promise<{ data: any; source: string }> {
    const cacheKey = `quran:verses:${chapterId}:${page || 1}:${perPage || 10}:${words || false}:${fields || 'text_uthmani'}:${translations?.join(',') || 'none'}:${media?.join(',') || 'none'}:${language || 'en'}:${text_type || 'uthmani'}`;
    
    try {
      // Check cache first if enabled
      if (this.cacheEnabled) {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          this.logger.log(`Returning verses for chapter ${chapterId} from cache`);
          return { data: JSON.parse(cached), source: 'cache' };
        }
      }

      // Build query parameters
      const params = new URLSearchParams();
      if (page) params.append('page', page.toString());
      if (perPage) params.append('per_page', perPage.toString());
      if (words !== undefined) params.append('words', words.toString());
      if (fields) params.append('fields', fields);
      if (translations?.length) params.append('translations', translations.join(','));
      if (media?.length) params.append('media', media.join(','));
      if (language) params.append('language', language);
      if (text_type) params.append('text_type', text_type);

      const queryString = params.toString();
      const url = `${this.quranApiBase}/verses/by_chapter/${chapterId}${queryString ? `?${queryString}` : ''}`;
      
      // Fetch from upstream API
      this.logger.log(`Fetching verses for chapter ${chapterId} from upstream API`);
      const response = await firstValueFrom(
        this.httpService.get(url)
      );

      const verses = response.data;
      
      // Cache the response if enabled
      if (this.cacheEnabled) {
        await this.redisService.set(cacheKey, JSON.stringify(verses), 86400); // 24 hours
      }

      this.logger.log(`Fetched verses for chapter ${chapterId} from upstream`);
      return { data: verses, source: 'upstream' };
    } catch (error) {
      this.logger.error(`Error fetching verses for chapter ${chapterId}:`, error.message);
      throw new HttpException(
        'Failed to fetch Quran verses',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get verse by ID
   */
  async getVerseById(
    verseId: number,
    words?: boolean,
    fields?: string,
    translations?: number[],
    media?: number[],
    language?: string,
    text_type?: string,
  ): Promise<{ data: any; source: string }> {
    const cacheKey = `quran:verse:${verseId}:${words || false}:${fields || 'text_uthmani'}:${translations?.join(',') || 'none'}:${media?.join(',') || 'none'}:${language || 'en'}:${text_type || 'uthmani'}`;
    
    try {
      // Check cache first if enabled
      if (this.cacheEnabled) {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          this.logger.log(`Returning verse ${verseId} from cache`);
          return { data: JSON.parse(cached), source: 'cache' };
        }
      }

      // Build query parameters
      const params = new URLSearchParams();
      if (words !== undefined) params.append('words', words.toString());
      if (fields) params.append('fields', fields);
      if (translations?.length) params.append('translations', translations.join(','));
      if (media?.length) params.append('media', media.join(','));
      if (language) params.append('language', language);
      if (text_type) params.append('text_type', text_type);

      const queryString = params.toString();
      const url = `${this.quranApiBase}/verses/by_id/${verseId}${queryString ? `?${queryString}` : ''}`;
      
      // Fetch from upstream API
      this.logger.log(`Fetching verse ${verseId} from upstream API`);
      const response = await firstValueFrom(
        this.httpService.get(url)
      );

      const verse = response.data;
      
      // Cache the response if enabled
      if (this.cacheEnabled) {
        await this.redisService.set(cacheKey, JSON.stringify(verse), 86400); // 24 hours
      }

      this.logger.log(`Fetched verse ${verseId} from upstream`);
      return { data: verse, source: 'upstream' };
    } catch (error) {
      this.logger.error(`Error fetching verse ${verseId}:`, error.message);
      throw new HttpException(
        'Failed to fetch Quran verse',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get translations
   */
  async getTranslations(): Promise<{ data: QuranTranslation[]; source: string }> {
    const cacheKey = 'quran:translations';
    
    try {
      // Check cache first if enabled
      if (this.cacheEnabled) {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          this.logger.log('Returning translations from cache');
          return { data: JSON.parse(cached), source: 'cache' };
        }
      }

      // Fetch from upstream API
      this.logger.log('Fetching translations from upstream API');
      const response = await firstValueFrom(
        this.httpService.get(`${this.quranApiBase}/resources/translations`)
      );

      const translations = response.data.translations;
      
      // Cache the response if enabled
      if (this.cacheEnabled) {
        await this.redisService.set(cacheKey, JSON.stringify(translations), 86400); // 24 hours
      }

      this.logger.log(`Fetched ${translations.length} translations from upstream`);
      return { data: translations, source: 'upstream' };
    } catch (error) {
      this.logger.error('Error fetching translations:', error.message);
      throw new HttpException(
        'Failed to fetch Quran translations',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get reciters
   */
  async getReciters(): Promise<{ data: QuranReciter[]; source: string }> {
    const cacheKey = 'quran:reciters';
    
    try {
      // Check cache first if enabled
      if (this.cacheEnabled) {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          this.logger.log('Returning reciters from cache');
          return { data: JSON.parse(cached), source: 'cache' };
        }
      }

      // Fetch from upstream API
      this.logger.log('Fetching reciters from upstream API');
      const response = await firstValueFrom(
        this.httpService.get(`${this.quranApiBase}/resources/recitations`)
      );

      const reciters = response.data.recitations;
      
      // Cache the response if enabled
      if (this.cacheEnabled) {
        await this.redisService.set(cacheKey, JSON.stringify(reciters), 86400); // 24 hours
      }

      this.logger.log(`Fetched ${reciters.length} reciters from upstream`);
      return { data: reciters, source: 'upstream' };
    } catch (error) {
      this.logger.error('Error fetching reciters:', error.message);
      throw new HttpException(
        'Failed to fetch Quran reciters',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Search Quran
   */
  async searchQuran(
    q: string,
    size?: number,
    page?: number,
    fields?: string,
    translations?: number[],
    language?: string,
    filter_chapter_id?: number,
    filter_juz_number?: number,
    filter_hizb_number?: number,
    filter_page_number?: number,
    filter_rub_number?: number,
  ): Promise<{ data: any; source: string }> {
    const cacheKey = `quran:search:${q}:${size || 20}:${page || 1}:${fields || 'text_uthmani'}:${translations?.join(',') || 'none'}:${language || 'en'}:${filter_chapter_id || 'none'}:${filter_juz_number || 'none'}:${filter_hizb_number || 'none'}:${filter_page_number || 'none'}:${filter_rub_number || 'none'}`;
    
    try {
      // Check cache first if enabled
      if (this.cacheEnabled) {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          this.logger.log(`Returning search results for "${q}" from cache`);
          return { data: JSON.parse(cached), source: 'cache' };
        }
      }

      // Build query parameters
      const params = new URLSearchParams();
      params.append('q', q);
      if (size) params.append('size', size.toString());
      if (page) params.append('page', page.toString());
      if (fields) params.append('fields', fields);
      if (translations?.length) params.append('translations', translations.join(','));
      if (language) params.append('language', language);
      if (filter_chapter_id) params.append('filter_chapter_id', filter_chapter_id.toString());
      if (filter_juz_number) params.append('filter_juz_number', filter_juz_number.toString());
      if (filter_hizb_number) params.append('filter_hizb_number', filter_hizb_number.toString());
      if (filter_page_number) params.append('filter_page_number', filter_page_number.toString());
      if (filter_rub_number) params.append('filter_rub_number', filter_rub_number.toString());

      const url = `${this.quranApiBase}/search?${params.toString()}`;
      
      // Fetch from upstream API
      this.logger.log(`Searching Quran for "${q}" from upstream API`);
      const response = await firstValueFrom(
        this.httpService.get(url)
      );

      const searchResults = response.data;
      
      // Cache the response if enabled (shorter TTL for search results)
      if (this.cacheEnabled) {
        await this.redisService.set(cacheKey, JSON.stringify(searchResults), 3600); // 1 hour
      }

      this.logger.log(`Search completed for "${q}" from upstream`);
      return { data: searchResults, source: 'upstream' };
    } catch (error) {
      this.logger.error(`Error searching Quran for "${q}":`, error.message);
      throw new HttpException(
        'Failed to search Quran',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get juz information
   */
  async getJuz(juzNumber: number): Promise<{ data: any; source: string }> {
    const cacheKey = `quran:juz:${juzNumber}`;
    
    try {
      // Check cache first if enabled
      if (this.cacheEnabled) {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          this.logger.log(`Returning juz ${juzNumber} from cache`);
          return { data: JSON.parse(cached), source: 'cache' };
        }
      }

      // Fetch from upstream API
      this.logger.log(`Fetching juz ${juzNumber} from upstream API`);
      const response = await firstValueFrom(
        this.httpService.get(`${this.quranApiBase}/juz/${juzNumber}`)
      );

      const juz = response.data;
      
      // Cache the response if enabled
      if (this.cacheEnabled) {
        await this.redisService.set(cacheKey, JSON.stringify(juz), 86400); // 24 hours
      }

      this.logger.log(`Fetched juz ${juzNumber} from upstream`);
      return { data: juz, source: 'upstream' };
    } catch (error) {
      this.logger.error(`Error fetching juz ${juzNumber}:`, error.message);
      throw new HttpException(
        'Failed to fetch juz information',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get hizb information
   */
  async getHizb(hizbNumber: number): Promise<{ data: any; source: string }> {
    const cacheKey = `quran:hizb:${hizbNumber}`;
    
    try {
      // Check cache first if enabled
      if (this.cacheEnabled) {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          this.logger.log(`Returning hizb ${hizbNumber} from cache`);
          return { data: JSON.parse(cached), source: 'cache' };
        }
      }

      // Fetch from upstream API
      this.logger.log(`Fetching hizb ${hizbNumber} from upstream API`);
      const response = await firstValueFrom(
        this.httpService.get(`${this.quranApiBase}/hizb/${hizbNumber}`)
      );

      const hizb = response.data;
      
      // Cache the response if enabled
      if (this.cacheEnabled) {
        await this.redisService.set(cacheKey, JSON.stringify(hizb), 86400); // 24 hours
      }

      this.logger.log(`Fetched hizb ${hizbNumber} from upstream`);
      return { data: hizb, source: 'upstream' };
    } catch (error) {
      this.logger.error(`Error fetching hizb ${hizbNumber}:`, error.message);
      throw new HttpException(
        'Failed to fetch hizb information',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  /**
   * Get page information
   */
  async getPage(pageNumber: number): Promise<{ data: any; source: string }> {
    const cacheKey = `quran:page:${pageNumber}`;
    
    try {
      // Check cache first if enabled
      if (this.cacheEnabled) {
        const cached = await this.redisService.get(cacheKey);
        if (cached) {
          this.logger.log(`Returning page ${pageNumber} from cache`);
          return { data: JSON.parse(cached), source: 'cache' };
        }
      }

      // Fetch from upstream API
      this.logger.log(`Fetching page ${pageNumber} from upstream API`);
      const response = await firstValueFrom(
        this.httpService.get(`${this.quranApiBase}/page/${pageNumber}`)
      );

      const page = response.data;
      
      // Cache the response if enabled
      if (this.cacheEnabled) {
        await this.redisService.set(cacheKey, JSON.stringify(page), 86400); // 24 hours
      }

      this.logger.log(`Fetched page ${pageNumber} from upstream`);
      return { data: page, source: 'upstream' };
    } catch (error) {
      this.logger.error(`Error fetching page ${pageNumber}:`, error.message);
      throw new HttpException(
        'Failed to fetch page information',
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }
}
