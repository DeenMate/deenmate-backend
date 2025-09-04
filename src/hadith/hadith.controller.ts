import { Controller, Get, Param, Query, ParseIntPipe } from '@nestjs/common';
import { HadithService, HadithCollection, HadithBook, Hadith } from './hadith.service';
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from '@nestjs/swagger';

@ApiTags('Hadith')
@Controller('hadith')
export class HadithController {
  constructor(private readonly hadithService: HadithService) {}

  @Get('collections')
  @ApiOperation({ summary: 'List hadith collections' })
  @ApiResponse({ status: 200, description: 'Success' })
  async getCollections() {
    const collections = await this.hadithService.getCollections();

    return {
      success: true,
      data: { collections },
      meta: {
        totalCollections: collections.length,
        cacheTtl: '24 hours',
      },
    };
  }

  @Get('collections/:id/books')
  @ApiOperation({ summary: 'List books in a collection' })
  @ApiResponse({ status: 200, description: 'Success' })
  async getBooks(@Param('id', ParseIntPipe) collectionId: number) {
    const books = await this.hadithService.getBooks(collectionId);

    return {
      success: true,
      data: { books, collectionId },
      meta: {
        totalBooks: books.length,
        cacheTtl: '24 hours',
      },
    };
  }

  @Get('collections/:collectionId/books/:bookId/hadiths')
  @ApiOperation({ summary: 'List hadiths in a book with pagination' })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', default: 1 } })
  @ApiQuery({ name: 'per_page', required: false, schema: { type: 'integer', default: 20 } })
  @ApiResponse({ status: 200, description: 'Success' })
  async getHadiths(
    @Param('collectionId', ParseIntPipe) collectionId: number,
    @Param('bookId', ParseIntPipe) bookId: number,
    @Query('page') page?: string,
    @Query('per_page') perPage?: string,
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const perPageNum = perPage ? parseInt(perPage) : 20;

    const result = await this.hadithService.getHadiths(
      collectionId,
      bookId,
      pageNum,
      perPageNum,
    );

    return {
      success: true,
      data: {
        ...result,
        collectionId,
        bookId,
      },
      meta: {
        cacheTtl: '1 hour',
      },
    };
  }

  @Get('search')
  @ApiOperation({ summary: 'Search hadiths' })
  @ApiQuery({ name: 'q', required: true, description: 'Search query' })
  @ApiQuery({ name: 'collection', required: false, schema: { type: 'integer' } })
  @ApiQuery({ name: 'page', required: false, schema: { type: 'integer', default: 1 } })
  @ApiQuery({ name: 'per_page', required: false, schema: { type: 'integer', default: 20 } })
  @ApiResponse({ status: 200, description: 'Success' })
  async searchHadiths(
    @Query('q') query: string,
    @Query('collection') collectionId?: string,
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
    const collection = collectionId ? parseInt(collectionId) : undefined;

    const result = await this.hadithService.searchHadiths(
      query,
      collection,
      pageNum,
      perPageNum,
    );

    return {
      success: true,
      data: result,
      meta: {
        query,
        collectionId: collection,
        cacheTtl: '30 minutes',
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get hadith by ID' })
  @ApiResponse({ status: 200, description: 'Success' })
  @ApiResponse({ status: 404, description: 'Not Found' })
  async getHadithById(@Param('id', ParseIntPipe) hadithId: number) {
    const hadith = await this.hadithService.getHadithById(hadithId);

    if (!hadith) {
      return {
        success: false,
        error: 'Hadith not found',
      };
    }

    return {
      success: true,
      data: { hadith },
      meta: {
        cacheTtl: '1 hour',
      },
    };
  }
}
