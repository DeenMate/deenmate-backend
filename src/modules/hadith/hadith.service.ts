import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { RedisService } from "../../redis/redis.service";

export interface HadithCollection {
  id: number;
  name: string;
  titleEn: string;
  titleBn?: string;
  titleAr?: string;
  totalHadith?: number;
  hasBooks: boolean;
  syncStatus: string;
  lastSyncedAt?: Date;
}

export interface HadithBook {
  id: number;
  collectionId: number;
  number: number;
  titleEn: string;
  titleBn?: string;
  titleAr?: string;
  totalHadith?: number;
}

export interface Hadith {
  id: number;
  collectionId: number;
  bookId?: number;
  hadithNumber: string;
  textAr: string;
  textEn: string;
  textBn?: string;
  grades?: any;
  refs?: any;
  narrator?: string;
  isVerifiedBn: boolean;
  lastUpdatedAt: Date;
}

@Injectable()
export class HadithService {
  private readonly logger = new Logger(HadithService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async getCollections(lang: string = "en"): Promise<HadithCollection[]> {
    const cacheKey = `hadith:collections:${lang}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const collections = await this.prisma.hadithCollection.findMany({
      orderBy: { name: "asc" },
    });

    // Cache for 24 hours
    await this.redis.set(cacheKey, JSON.stringify(collections), 86400);

    return collections;
  }

  async getBooks(
    collectionId: number,
    lang: string = "en",
  ): Promise<HadithBook[]> {
    const cacheKey = `hadith:books:${collectionId}:${lang}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const books = await this.prisma.hadithBook.findMany({
      where: { collectionId },
      orderBy: { number: "asc" },
    });

    // Cache for 24 hours
    await this.redis.set(cacheKey, JSON.stringify(books), 86400);

    return books;
  }

  async getHadiths(
    collectionId: number,
    bookId?: number,
    page: number = 1,
    perPage: number = 20,
    lang: string = "en",
  ): Promise<{ hadiths: Hadith[]; pagination: any }> {
    const cacheKey = `hadith:hadiths:${collectionId}:${bookId || "all"}:${page}:${perPage}:${lang}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const skip = (page - 1) * perPage;
    const where: any = { collectionId };

    if (bookId) {
      where.bookId = bookId;
    }

    const [hadiths, total] = await Promise.all([
      this.prisma.hadith.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { hadithNumber: "asc" },
      }),
      this.prisma.hadith.count({ where }),
    ]);

    const result = {
      hadiths,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
        hasNext: page < Math.ceil(total / perPage),
        hasPrev: page > 1,
      },
    };

    // Cache for 1 hour
    await this.redis.set(cacheKey, JSON.stringify(result), 3600);

    return result;
  }

  async searchHadiths(
    query: string,
    collectionId?: number,
    page: number = 1,
    perPage: number = 20,
    lang: string = "en",
  ): Promise<{ hadiths: Hadith[]; pagination: any }> {
    const cacheKey = `hadith:search:${query}:${collectionId || "all"}:${page}:${perPage}:${lang}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const skip = (page - 1) * perPage;
    const where: any = {
      OR: [
        { textEn: { contains: query, mode: "insensitive" } },
        { textAr: { contains: query, mode: "insensitive" } },
        { textBn: { contains: query, mode: "insensitive" } },
        { narrator: { contains: query, mode: "insensitive" } },
      ],
    };

    if (collectionId) {
      where.collectionId = collectionId;
    }

    const [hadiths, total] = await Promise.all([
      this.prisma.hadith.findMany({
        where,
        skip,
        take: perPage,
        orderBy: { hadithNumber: "asc" },
      }),
      this.prisma.hadith.count({ where }),
    ]);

    const result = {
      hadiths,
      pagination: {
        page,
        perPage,
        total,
        totalPages: Math.ceil(total / perPage),
        hasNext: page < Math.ceil(total / perPage),
        hasPrev: page > 1,
      },
    };

    // Cache for 30 minutes
    await this.redis.set(cacheKey, JSON.stringify(result), 1800);

    return result;
  }

  async getHadithById(
    hadithId: number,
    lang: string = "en",
  ): Promise<Hadith | null> {
    const cacheKey = `hadith:byId:${hadithId}:${lang}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const hadith = await this.prisma.hadith.findUnique({
      where: { id: hadithId },
    });

    // Cache for 1 hour
    await this.redis.set(cacheKey, JSON.stringify(hadith), 3600);

    return hadith;
  }

  async getHadithByNumber(
    collectionName: string,
    hadithNumber: string,
    lang: string = "en",
  ): Promise<Hadith | null> {
    const cacheKey = `hadith:byNumber:${collectionName}:${hadithNumber}:${lang}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const collection = await this.prisma.hadithCollection.findUnique({
      where: { name: collectionName },
    });

    if (!collection) {
      return null;
    }

    const hadith = await this.prisma.hadith.findUnique({
      where: {
        collectionId_hadithNumber: {
          collectionId: collection.id,
          hadithNumber,
        },
      },
    });

    // Cache for 1 hour
    await this.redis.set(cacheKey, JSON.stringify(hadith), 3600);

    return hadith;
  }
}
