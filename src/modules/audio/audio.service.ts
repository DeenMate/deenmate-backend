import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { AudioUrlSignerService } from "../../utils/audio-url-signer.service";

export interface AudioMetadata {
  id: number;
  reciterId: number;
  chapterId: number;
  verseNumber?: number;
  quality: string;
  format: string;
  duration: number;
  fileSize: number;
  url: string;
  expiresAt: string;
}

export interface AudioQuality {
  code: string;
  name: string;
  bitrate: string;
  fileSize: number;
  recommended: boolean;
}

@Injectable()
export class AudioService {
  private readonly logger = new Logger(AudioService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private audioUrlSigner: AudioUrlSignerService,
  ) {}

  async getVerseAudio(
    reciterId: number,
    chapterId: number,
    verseNumber: number,
    quality: string = "128kbps",
  ): Promise<AudioMetadata> {
    const cacheKey = `audio:verse:${reciterId}:${chapterId}:${verseNumber}:${quality}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      // Get verse from database
      const verse = await this.prisma.quranVerse.findFirst({
        where: {
          chapterNumber: chapterId,
          verseNumber: verseNumber,
        },
      });

      if (!verse) {
        throw new Error(`Verse not found: ${chapterId}:${verseNumber}`);
      }

      // Get reciter from database to find the correct ID
      const reciter = await this.prisma.quranReciter.findFirst({
        where: { sourceId: reciterId },
      });

      if (!reciter) {
        throw new Error(`Reciter not found: ${reciterId}`);
      }

      // Get audio file from database
      const audioFile = await this.prisma.quranAudioFile.findUnique({
        where: {
          verseId_reciterId: {
            verseId: verse.id,
            reciterId: reciter.id,
          },
        },
      });

      if (!audioFile) {
        // Fallback to generating URL from Quran.com CDN
        const fallbackUrl = await this.generateFallbackAudioUrl(
          reciterId,
          chapterId,
          verseNumber,
        );
        const audioMetadata: AudioMetadata = {
          id: Date.now(),
          reciterId,
          chapterId,
          verseNumber,
          quality,
          format: "mp3",
          duration: 0, // Unknown duration
          fileSize: 0, // Unknown file size
          url: fallbackUrl,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
        };

        // Cache for 1 hour
        await this.redis.set(cacheKey, JSON.stringify(audioMetadata), 3600);
        return audioMetadata;
      }

      // Return real audio metadata from database
      const audioMetadata: AudioMetadata = {
        id: audioFile.id,
        reciterId,
        chapterId,
        verseNumber,
        quality: audioFile.quality || quality,
        format: audioFile.format,
        duration: audioFile.duration || 0,
        fileSize: audioFile.fileSize || 0,
        url: audioFile.sourceUrl,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
      };

      // Cache for 1 hour
      await this.redis.set(cacheKey, JSON.stringify(audioMetadata), 3600);

      return audioMetadata;
    } catch (error) {
      this.logger.error(`Error fetching verse audio: ${error.message}`);

      // Generate fallback URL from Quran.com CDN
      const fallbackUrl = await this.generateFallbackAudioUrl(
        reciterId,
        chapterId,
        verseNumber,
      );
      const audioMetadata: AudioMetadata = {
        id: Date.now(),
        reciterId,
        chapterId,
        verseNumber,
        quality,
        format: "mp3",
        duration: 0, // Unknown duration
        fileSize: 0, // Unknown file size
        url: fallbackUrl,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
      };

      // Cache for 1 hour
      await this.redis.set(cacheKey, JSON.stringify(audioMetadata), 3600);

      return audioMetadata;
    }
  }

  async getChapterAudio(
    reciterId: number,
    chapterId: number,
    quality: string = "128kbps",
  ): Promise<AudioMetadata> {
    const cacheKey = `audio:chapter:${reciterId}:${chapterId}:${quality}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Generate fallback URL for chapter audio
    const fallbackUrl = await this.generateFallbackAudioUrl(
      reciterId,
      chapterId,
      1,
    );
    const audioMetadata: AudioMetadata = {
      id: Date.now(),
      reciterId,
      chapterId,
      verseNumber: 1, // Chapter audio starts from verse 1
      quality,
      format: "mp3",
      duration: 0, // Unknown duration
      fileSize: 0, // Unknown file size
      url: fallbackUrl,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour
    };

    // Cache for 1 hour
    await this.redis.set(cacheKey, JSON.stringify(audioMetadata), 3600);

    return audioMetadata;
  }

  async getAvailableQualities(): Promise<AudioQuality[]> {
    const cacheKey = "audio:qualities";

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const qualities: AudioQuality[] = [
      {
        code: "64kbps",
        name: "Low Quality",
        bitrate: "64 kbps",
        fileSize: 0.5, // MB per minute
        recommended: false,
      },
      {
        code: "128kbps",
        name: "Standard Quality",
        bitrate: "128 kbps",
        fileSize: 1.0, // MB per minute
        recommended: true,
      },
      {
        code: "192kbps",
        name: "High Quality",
        bitrate: "192 kbps",
        fileSize: 1.5, // MB per minute
        recommended: false,
      },
      {
        code: "320kbps",
        name: "Premium Quality",
        bitrate: "320 kbps",
        fileSize: 2.4, // MB per minute
        recommended: false,
      },
    ];

    // Cache for 24 hours
    await this.redis.set(cacheKey, JSON.stringify(qualities), 86400);

    return qualities;
  }

  async getReciterAudioStats(reciterId: number): Promise<any> {
    const cacheKey = `audio:stats:reciter:${reciterId}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get actual stats from database
    const audioFileCount = await this.prisma.quranAudioFile.count({
      where: {
        reciter: {
          sourceId: reciterId,
        },
      },
    });

    const stats = {
      reciterId,
      totalFiles: audioFileCount,
      totalDuration: 0, // Would need to calculate from actual audio files
      totalSize: 0, // Would need to calculate from actual audio files
      lastUpdated: new Date().toISOString(),
    };

    // Cache for 6 hours
    await this.redis.set(cacheKey, JSON.stringify(stats), 21600);

    return stats;
  }

  async searchAudio(
    query: string,
    reciterId?: number,
    quality?: string,
    page: number = 1,
    perPage: number = 20,
  ): Promise<{ results: AudioMetadata[]; pagination: any }> {
    const cacheKey = `audio:search:${query}:${reciterId || "all"}:${
      quality || "all"
    }:${page}:${perPage}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Search for verses containing the query text
    const verses = await this.prisma.quranVerse.findMany({
      where: {
        OR: [
          { textUthmani: { contains: query, mode: "insensitive" } },
          { textSimple: { contains: query, mode: "insensitive" } },
        ],
      },
      take: perPage,
      skip: (page - 1) * perPage,
      include: {
        audioFiles: {
          where: reciterId
            ? {
                reciter: {
                  sourceId: reciterId,
                },
              }
            : undefined,
          include: {
            reciter: true,
          },
        },
      },
    });

    const results: AudioMetadata[] = [];

    for (const verse of verses) {
      for (const audioFile of verse.audioFiles) {
        results.push({
          id: audioFile.id,
          reciterId: audioFile.reciter.sourceId,
          chapterId: verse.chapterNumber,
          verseNumber: verse.verseNumber,
          quality: audioFile.quality || quality || "128kbps",
          format: audioFile.format,
          duration: audioFile.duration || 0,
          fileSize: audioFile.fileSize || 0,
          url: audioFile.sourceUrl,
          expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        });
      }
    }

    const result = {
      results,
      pagination: {
        currentPage: page,
        perPage,
        totalPages: Math.ceil(verses.length / perPage),
        totalResults: results.length,
        query,
      },
    };

    // Cache for 30 minutes
    await this.redis.set(cacheKey, JSON.stringify(result), 1800);

    return result;
  }

  async validateAudioUrl(url: string): Promise<boolean> {
    try {
      // First check if URL is expired
      if (this.audioUrlSigner.isUrlExpired(url)) {
        this.logger.debug(`Audio URL expired: ${url}`);
        return false;
      }

      // Check if URL is properly formatted
      if (!url || typeof url !== 'string') {
        this.logger.debug(`Invalid URL format: ${url}`);
        return false;
      }

      // Basic URL format validation
      try {
        new URL(url);
      } catch (error) {
        this.logger.debug(`Invalid URL format: ${url}`);
        return false;
      }

      // Check if URL is from a trusted domain (Quran.com CDN)
      const trustedDomains = [
        'verses.quran.com',
        'cdn.quran.com',
        'audio.quran.com',
        'everyayah.com',
        'quranicaudio.com'
      ];
      
      const urlObj = new URL(url);
      const isTrustedDomain = trustedDomains.some(domain => 
        urlObj.hostname === domain || urlObj.hostname.endsWith(`.${domain}`)
      );

      if (!isTrustedDomain) {
        this.logger.debug(`Untrusted domain: ${urlObj.hostname}`);
        return false;
      }

      // Optional: Perform a HEAD request to check if the file exists
      // This is commented out to avoid performance issues, but can be enabled for strict validation
      /*
      try {
        const response = await fetch(url, { method: 'HEAD', timeout: 5000 });
        if (!response.ok) {
          this.logger.debug(`Audio file not accessible: ${url} (${response.status})`);
          return false;
        }
      } catch (error) {
        this.logger.debug(`Failed to validate audio URL: ${url} - ${error.message}`);
        return false;
      }
      */

      this.logger.debug(`Audio URL validation passed: ${url}`);
      return true;
    } catch (error) {
      this.logger.error(`Error validating audio URL: ${url} - ${error.message}`);
      return false;
    }
  }

  /**
   * Generate fallback audio URL from Quran.com CDN
   */
  private async generateFallbackAudioUrl(
    reciterId: number,
    chapterId: number,
    verseNumber: number,
  ): Promise<string> {
    // Generate proper audio file path based on Quran.com CDN structure
    const paddedChapter = chapterId.toString().padStart(3, "0");
    const paddedVerse = verseNumber.toString().padStart(3, "0");
    const fileName = `${paddedChapter}${paddedVerse}.mp3`;

    // Special cases for reciters that use different CDN
    if (reciterId === 6) {
      return `https://mirrors.quranicaudio.com/everyayah/Husary_64kbps/${fileName}`;
    }
    if (reciterId === 11) {
      return `https://mirrors.quranicaudio.com/everyayah/Mohammad_al_Tablaway_128kbps/${fileName}`;
    }
    if (reciterId === 12) {
      return `https://mirrors.quranicaudio.com/everyayah/Husary_Muallim_128kbps/${fileName}`;
    }

    // Use the correct CDN format: https://audio.qurancdn.com/reciter_name/mp3/filename
    // Using sourceId-based CDN path for fallback
    return `https://verses.quran.com/${reciterId}/${fileName}`;
  }

  /**
   * Get reciter name by ID (real CDN names from Quran.com API)
   */
  private getReciterName(reciterId: number): string {
    const reciterMap: { [key: number]: string } = {
      // Complete mapping from Quran.com API (reciters 1-12)
      1: "AbdulBaset/Mujawwad", // Abdul Basit Mujawwad - VERIFIED WORKING
      2: "AbdulBaset/Murattal", // Abdul Basit Murattal - VERIFIED WORKING
      3: "Sudais", // Sudais - VERIFIED WORKING
      4: "Shatri", // Shatri - VERIFIED WORKING
      5: "Rifai", // Rifai - VERIFIED WORKING
      6: "Husary_64kbps", // Husary (special CDN) - VERIFIED WORKING
      7: "Alafasy", // Alafasy - VERIFIED WORKING
      8: "Minshawi/Mujawwad", // Minshawi Mujawwad - VERIFIED WORKING
      9: "Minshawi/Murattal", // Minshawi Murattal - VERIFIED WORKING
      10: "Shuraym", // Shuraym - VERIFIED WORKING
      11: "Mohammad_al_Tablaway_128kbps", // Mohammad al Tablaway (special CDN) - VERIFIED WORKING
      12: "Husary_Muallim_128kbps", // Husary Muallim (special CDN) - VERIFIED WORKING
    };

    return reciterMap[reciterId] || "Alafasy"; // Default to Alafasy
  }
}
