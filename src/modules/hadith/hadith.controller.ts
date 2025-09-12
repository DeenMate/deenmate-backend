import {
  Controller,
  Get,
  Post,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  HttpException,
  HttpStatus,
} from "@nestjs/common";
import { HadithService } from "./hadith.service";
import { HadithImportService } from "./hadith-import.service";
import { AdminApiKeyGuard } from "../../common/guards/admin-api-key.guard";
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiBearerAuth,
} from "@nestjs/swagger";

@ApiTags("Hadith v4")
@Controller({ path: "hadith", version: "4" })
export class HadithController {
  constructor(
    private readonly hadithService: HadithService,
    private readonly hadithImportService: HadithImportService,
  ) {}

  @Get("collections")
  @ApiOperation({ summary: "List hadith collections" })
  @ApiQuery({
    name: "lang",
    required: false,
    schema: { type: "string", enum: ["en", "bn"], default: "en" },
  })
  @ApiResponse({ status: 200, description: "Success" })
  async getCollections(@Query("lang") lang: string = "en") {
    const collections = await this.hadithService.getCollections(lang);

    return {
      success: true,
      data: { collections },
      meta: {
        totalCollections: collections.length,
        language: lang,
        cacheTtl: "24 hours",
      },
    };
  }

  @Get("collections/:id/books")
  @ApiOperation({ summary: "List books in a collection" })
  @ApiQuery({
    name: "lang",
    required: false,
    schema: { type: "string", enum: ["en", "bn"], default: "en" },
  })
  @ApiResponse({ status: 200, description: "Success" })
  async getBooks(
    @Param("id", ParseIntPipe) collectionId: number,
    @Query("lang") lang: string = "en",
  ) {
    const books = await this.hadithService.getBooks(collectionId, lang);

    return {
      success: true,
      data: { books, collectionId },
      meta: {
        totalBooks: books.length,
        language: lang,
        cacheTtl: "24 hours",
      },
    };
  }

  @Get("collections/:collectionId/books/:bookId/hadiths")
  @ApiOperation({ summary: "List hadiths in a book with pagination" })
  @ApiQuery({
    name: "page",
    required: false,
    schema: { type: "integer", default: 1 },
  })
  @ApiQuery({
    name: "per_page",
    required: false,
    schema: { type: "integer", default: 20 },
  })
  @ApiQuery({
    name: "lang",
    required: false,
    schema: { type: "string", enum: ["en", "bn"], default: "en" },
  })
  @ApiResponse({ status: 200, description: "Success" })
  async getHadiths(
    @Param("collectionId", ParseIntPipe) collectionId: number,
    @Param("bookId", ParseIntPipe) bookId: number,
    @Query("page") page?: string,
    @Query("per_page") perPage?: string,
    @Query("lang") lang: string = "en",
  ) {
    const pageNum = page ? parseInt(page) : 1;
    const perPageNum = perPage ? parseInt(perPage) : 20;

    const result = await this.hadithService.getHadiths(
      collectionId,
      bookId,
      pageNum,
      perPageNum,
      lang,
    );

    return {
      success: true,
      data: {
        ...result,
        collectionId,
        bookId,
      },
      meta: {
        language: lang,
        cacheTtl: "1 hour",
      },
    };
  }

  @Get("search")
  @ApiOperation({ summary: "Search hadiths" })
  @ApiQuery({ name: "q", required: true, description: "Search query" })
  @ApiQuery({
    name: "collection",
    required: false,
    schema: { type: "integer" },
  })
  @ApiQuery({
    name: "page",
    required: false,
    schema: { type: "integer", default: 1 },
  })
  @ApiQuery({
    name: "per_page",
    required: false,
    schema: { type: "integer", default: 20 },
  })
  @ApiQuery({
    name: "lang",
    required: false,
    schema: { type: "string", enum: ["en", "bn"], default: "en" },
  })
  @ApiResponse({ status: 200, description: "Success" })
  async searchHadiths(
    @Query("q") query: string,
    @Query("collection") collectionId?: string,
    @Query("page") page?: string,
    @Query("per_page") perPage?: string,
    @Query("lang") lang: string = "en",
  ) {
    if (!query) {
      return {
        success: false,
        error: "Search query is required",
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
      lang,
    );

    return {
      success: true,
      data: result,
      meta: {
        query,
        collectionId: collection,
        language: lang,
        cacheTtl: "30 minutes",
      },
    };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get hadith by ID" })
  @ApiQuery({
    name: "lang",
    required: false,
    schema: { type: "string", enum: ["en", "bn"], default: "en" },
  })
  @ApiResponse({ status: 200, description: "Success" })
  @ApiResponse({ status: 404, description: "Not Found" })
  async getHadithById(
    @Param("id", ParseIntPipe) hadithId: number,
    @Query("lang") lang: string = "en",
  ) {
    const hadith = await this.hadithService.getHadithById(hadithId, lang);

    if (!hadith) {
      return {
        success: false,
        error: "Hadith not found",
      };
    }

    return {
      success: true,
      data: { hadith },
      meta: {
        language: lang,
        cacheTtl: "1 hour",
      },
    };
  }

  @Get("collections/:collectionName/:hadithNumber")
  @ApiOperation({ summary: "Get hadith by collection name and hadith number" })
  @ApiQuery({
    name: "lang",
    required: false,
    schema: { type: "string", enum: ["en", "bn"], default: "en" },
  })
  @ApiResponse({ status: 200, description: "Success" })
  @ApiResponse({ status: 404, description: "Not Found" })
  async getHadithByNumber(
    @Param("collectionName") collectionName: string,
    @Param("hadithNumber") hadithNumber: string,
    @Query("lang") lang: string = "en",
  ) {
    const hadith = await this.hadithService.getHadithByNumber(
      collectionName,
      hadithNumber,
      lang,
    );

    if (!hadith) {
      return {
        success: false,
        error: "Hadith not found",
      };
    }

    return {
      success: true,
      data: { hadith },
      meta: {
        language: lang,
        cacheTtl: "1 hour",
      },
    };
  }

  @Post("import")
  @UseGuards(AdminApiKeyGuard)
  @ApiBearerAuth("admin-api-key")
  @ApiOperation({ summary: "Import hadith data from SQL dump" })
  @ApiQuery({
    name: "file_path",
    required: true,
    description: "Path to the SQL dump file",
  })
  @ApiResponse({ status: 200, description: "Import completed successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  async importFromSqlDump(@Query("file_path") filePath: string) {
    if (!filePath) {
      throw new HttpException("File path is required", HttpStatus.BAD_REQUEST);
    }

    try {
      const result = await this.hadithImportService.importFromSqlDump(filePath);

      return {
        success: true,
        data: result,
        message: "Import completed successfully",
      };
    } catch (error) {
      throw new HttpException(
        `Import failed: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get("import/stats")
  @UseGuards(AdminApiKeyGuard)
  @ApiBearerAuth("admin-api-key")
  @ApiOperation({ summary: "Get hadith import statistics" })
  @ApiResponse({
    status: 200,
    description: "Statistics retrieved successfully",
  })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getImportStats() {
    try {
      const stats = await this.hadithImportService.getImportStats();

      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      throw new HttpException(
        `Failed to get stats: ${error.message}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
