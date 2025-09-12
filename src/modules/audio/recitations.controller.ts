import { Controller, Get, Param, Query, ParseIntPipe } from "@nestjs/common";
import { AudioService } from "./audio.service";
import { PrismaService } from "../../database/prisma.service";
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
} from "@nestjs/swagger";

@ApiTags("Audio v4")
@Controller({ path: "recitations", version: "4" })
export class RecitationsController {
  constructor(
    private readonly audioService: AudioService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(":id/by_ayah/:verseKey")
  @ApiOperation({
    summary: "Get audio for specific verse by reciter",
    description:
      "Quran.com compatible. Example: /recitations/1/by_ayah/1:1 returns { audio_file: { verse_key, url } }",
  })
  @ApiParam({ name: "id", description: "Reciter ID", type: "number" })
  @ApiParam({
    name: "verseKey",
    description: "Verse key in format chapter:verse (e.g., 1:1, 2:255)",
    type: "string",
  })
  @ApiQuery({
    name: "quality",
    required: false,
    description: "Audio quality (128kbps, 192kbps, 320kbps)",
    type: "string",
  })
  @ApiResponse({ status: 200, description: "Audio metadata for the verse" })
  async getAudioByAyah(
    @Param("id", ParseIntPipe) reciterId: number,
    @Param("verseKey") verseKey: string,
    @Query("quality") quality?: string,
  ) {
    const [chapterId, verseNumber] = verseKey.split(":").map(Number);
    if (!chapterId || !verseNumber || isNaN(chapterId) || isNaN(verseNumber)) {
      throw new Error(
        `Invalid verse key format: ${verseKey}. Expected format: chapter:verse (e.g., 1:1)`,
      );
    }

    const audioMetadata = await this.audioService.getVerseAudio(
      reciterId,
      chapterId,
      verseNumber,
      quality || "128kbps",
    );

    return {
      audio_file: {
        verse_key: verseKey,
        url: audioMetadata.url,
      },
    };
  }

  @Get(":id/by_chapter/:chapterId")
  @ApiOperation({
    summary: "Get audio for entire chapter by reciter",
    description:
      "Quran.com compatible. Example: /recitations/1/by_chapter/1?page=1&per_page=5 returns { audio_files: [...], pagination } with full URLs",
  })
  @ApiParam({ name: "id", description: "Reciter ID", type: "number" })
  @ApiParam({
    name: "chapterId",
    description: "Chapter ID (1-114)",
    type: "number",
  })
  @ApiQuery({
    name: "quality",
    required: false,
    description: "Audio quality (128kbps, 192kbps, 320kbps)",
    type: "string",
  })
  @ApiQuery({
    name: "page",
    required: false,
    description: "Page number for pagination",
    type: "number",
  })
  @ApiQuery({
    name: "per_page",
    required: false,
    description: "Number of verses per page",
    type: "number",
  })
  @ApiResponse({
    status: 200,
    description: "Audio metadata for chapter verses",
  })
  async getAudioByChapter(
    @Param("id", ParseIntPipe) reciterId: number,
    @Param("chapterId", ParseIntPipe) chapterId: number,
    @Query("quality") quality?: string,
    @Query("page") pageStr?: string,
    @Query("per_page") perPageStr?: string,
  ) {
    const currentPage = pageStr ? parseInt(pageStr, 10) : 1;
    const limit = perPageStr ? parseInt(perPageStr, 10) : 10;

    const verses = await this.prisma.quranVerse.findMany({
      where: { chapterNumber: chapterId },
      orderBy: { verseNumber: "asc" },
      take: limit,
      skip: (currentPage - 1) * limit,
    });

    const audioFiles = [] as Array<{ verse_key: string; url: string }>;
    for (const verse of verses) {
      try {
        const audioMetadata = await this.audioService.getVerseAudio(
          reciterId,
          chapterId,
          verse.verseNumber,
          quality || "128kbps",
        );
        audioFiles.push({
          verse_key: `${chapterId}:${verse.verseNumber}`,
          url: audioMetadata.url,
        });
      } catch {
        continue;
      }
    }

    const totalVerses = await this.prisma.quranVerse.count({
      where: { chapterNumber: chapterId },
    });

    return {
      audio_files: audioFiles,
      pagination: {
        per_page: limit,
        current_page: currentPage,
        next_page: currentPage * limit < totalVerses ? currentPage + 1 : null,
        total_pages: Math.ceil(totalVerses / limit),
        total_records: totalVerses,
      },
    };
  }
}
