import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export interface ContentItem {
  id: number | string;
  [key: string]: any;
}

export interface CreateContentDto {
  [key: string]: any;
}

export interface UpdateContentDto {
  [key: string]: any;
}

export interface ContentQuery {
  page?: number;
  limit?: number;
  search?: string;
  filters?: Record<string, any>;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

@Injectable()
export class ContentManagementService {
  private readonly logger = new Logger(ContentManagementService.name);

  constructor(private readonly prisma: PrismaService) {}

  // Quran Content Management
  async getQuranChapters(query: ContentQuery = {}): Promise<{ data: ContentItem[]; total: number }> {
    const { page = 1, limit = 20, search, filters, sortBy = 'chapterNumber', sortOrder = 'asc' } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { nameArabic: { contains: search, mode: 'insensitive' } },
        { nameSimple: { contains: search, mode: 'insensitive' } },
        { nameEnglish: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (filters?.revelationPlace) {
      where.revelationPlace = filters.revelationPlace;
    }

    const [data, total] = await Promise.all([
      this.prisma.quranChapter.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.quranChapter.count({ where }),
    ]);

    return { data, total };
  }

  async getQuranChapterById(id: number): Promise<ContentItem> {
    const chapter = await this.prisma.quranChapter.findUnique({
      where: { id },
      include: { verses: true },
    });

    if (!chapter) {
      throw new NotFoundException('Quran chapter not found');
    }

    return chapter;
  }

  async createQuranChapter(data: CreateContentDto): Promise<ContentItem> {
    try {
      const chapter = await this.prisma.quranChapter.create({
        data: {
          chapterNumber: data.chapterNumber,
          nameArabic: data.nameArabic,
          nameSimple: data.nameSimple,
          nameEnglish: data.nameEnglish,
          nameBangla: data.nameBangla,
          revelationPlace: data.revelationPlace,
          revelationOrder: data.revelationOrder,
          versesCount: data.versesCount,
          bismillahPre: data.bismillahPre || true,
        },
      });

      this.logger.log(`Created Quran chapter: ${chapter.nameSimple}`);
      return chapter;
    } catch (error) {
      this.logger.error(`Failed to create Quran chapter: ${error.message}`);
      throw new BadRequestException('Failed to create Quran chapter');
    }
  }

  async updateQuranChapter(id: number, data: UpdateContentDto): Promise<ContentItem> {
    try {
      const chapter = await this.prisma.quranChapter.update({
        where: { id },
        data,
      });

      this.logger.log(`Updated Quran chapter: ${chapter.nameSimple}`);
      return chapter;
    } catch (error) {
      this.logger.error(`Failed to update Quran chapter: ${error.message}`);
      throw new BadRequestException('Failed to update Quran chapter');
    }
  }

  async deleteQuranChapter(id: number): Promise<void> {
    try {
      await this.prisma.quranChapter.delete({
        where: { id },
      });

      this.logger.log(`Deleted Quran chapter with ID: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete Quran chapter: ${error.message}`);
      throw new BadRequestException('Failed to delete Quran chapter');
    }
  }

  // Hadith Content Management
  async getHadithCollections(query: ContentQuery = {}): Promise<{ data: ContentItem[]; total: number }> {
    const { page = 1, limit = 20, search, filters, sortBy = 'name', sortOrder = 'asc' } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.name = { contains: search, mode: 'insensitive' };
    }

    if (filters?.language) {
      where.language = filters.language;
    }

    const [data, total] = await Promise.all([
      this.prisma.hadithCollection.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.hadithCollection.count({ where }),
    ]);

    return { data, total };
  }

  async getHadithCollectionById(id: number): Promise<ContentItem> {
    const collection = await this.prisma.hadithCollection.findUnique({
      where: { id },
      include: { books: true },
    });

    if (!collection) {
      throw new NotFoundException('Hadith collection not found');
    }

    return collection;
  }

  async createHadithCollection(data: CreateContentDto): Promise<ContentItem> {
    try {
      const collection = await this.prisma.hadithCollection.create({
        data: {
          name: data.name,
          titleEn: data.titleEn || data.name,
          titleBn: data.titleBn,
          titleAr: data.titleAr,
          totalHadith: data.totalHadith,
          hasBooks: data.hasBooks || false,
        },
      });

      this.logger.log(`Created Hadith collection: ${collection.name}`);
      return collection;
    } catch (error) {
      this.logger.error(`Failed to create Hadith collection: ${error.message}`);
      throw new BadRequestException('Failed to create Hadith collection');
    }
  }

  async updateHadithCollection(id: number, data: UpdateContentDto): Promise<ContentItem> {
    try {
      const collection = await this.prisma.hadithCollection.update({
        where: { id },
        data,
      });

      this.logger.log(`Updated Hadith collection: ${collection.name}`);
      return collection;
    } catch (error) {
      this.logger.error(`Failed to update Hadith collection: ${error.message}`);
      throw new BadRequestException('Failed to update Hadith collection');
    }
  }

  async deleteHadithCollection(id: number): Promise<void> {
    try {
      await this.prisma.hadithCollection.delete({
        where: { id },
      });

      this.logger.log(`Deleted Hadith collection with ID: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete Hadith collection: ${error.message}`);
      throw new BadRequestException('Failed to delete Hadith collection');
    }
  }

  // Finance Content Management
  async getGoldPrices(query: ContentQuery = {}): Promise<{ data: ContentItem[]; total: number }> {
    const { page = 1, limit = 20, search, filters, sortBy = 'fetchedAt', sortOrder = 'desc' } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { productName: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (filters?.category) {
      where.category = filters.category;
    }

    if (filters?.metal) {
      where.metal = filters.metal;
    }

    const [data, total] = await Promise.all([
      this.prisma.goldPrice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.goldPrice.count({ where }),
    ]);

    return { data, total };
  }

  async getGoldPriceById(id: string): Promise<ContentItem> {
    const price = await this.prisma.goldPrice.findUnique({
      where: { id },
    });

    if (!price) {
      throw new NotFoundException('Gold price not found');
    }

    return price;
  }

  async createGoldPrice(data: CreateContentDto): Promise<ContentItem> {
    try {
      const price = await this.prisma.goldPrice.create({
        data: {
          metal: data.metal || 'Gold',
          category: data.category,
          unit: data.unit,
          price: data.price,
          currency: data.currency || 'BDT',
          change: data.change,
          source: data.source || 'manual',
          fetchedAt: new Date(),
        },
      });

      this.logger.log(`Created Gold price: ${price.metal} ${price.category}`);
      return price;
    } catch (error) {
      this.logger.error(`Failed to create Gold price: ${error.message}`);
      throw new BadRequestException('Failed to create Gold price');
    }
  }

  async updateGoldPrice(id: string, data: UpdateContentDto): Promise<ContentItem> {
    try {
      const price = await this.prisma.goldPrice.update({
        where: { id },
        data: {
          ...data,
          fetchedAt: new Date(),
        },
      });

      this.logger.log(`Updated Gold price: ${price.metal} ${price.category}`);
      return price;
    } catch (error) {
      this.logger.error(`Failed to update Gold price: ${error.message}`);
      throw new BadRequestException('Failed to update Gold price');
    }
  }

  async deleteGoldPrice(id: string): Promise<void> {
    try {
      await this.prisma.goldPrice.delete({
        where: { id },
      });

      this.logger.log(`Deleted Gold price with ID: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete Gold price: ${error.message}`);
      throw new BadRequestException('Failed to delete Gold price');
    }
  }

  // Audio Content Management
  async getReciters(query: ContentQuery = {}): Promise<{ data: ContentItem[]; total: number }> {
    const { page = 1, limit = 20, search, filters, sortBy = 'name', sortOrder = 'asc' } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { style: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (filters?.language) {
      where.languageName = filters.language;
    }

    const [data, total] = await Promise.all([
      this.prisma.quranReciter.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      this.prisma.quranReciter.count({ where }),
    ]);

    return { data, total };
  }

  async getReciterById(id: number): Promise<ContentItem> {
    const reciter = await this.prisma.quranReciter.findUnique({
      where: { id },
    });

    if (!reciter) {
      throw new NotFoundException('Reciter not found');
    }

    return reciter;
  }

  async createReciter(data: CreateContentDto): Promise<ContentItem> {
    try {
      const reciter = await this.prisma.quranReciter.create({
        data: {
          sourceId: data.sourceId || 1,
          sourceApi: data.sourceApi || 'quran.com',
          name: data.name,
          englishName: data.englishName,
          languageName: data.languageName || 'Arabic',
          style: data.style,
          qirat: data.qirat,
          isActive: data.isActive !== false,
        },
      });

      this.logger.log(`Created Reciter: ${reciter.name}`);
      return reciter;
    } catch (error) {
      this.logger.error(`Failed to create Reciter: ${error.message}`);
      throw new BadRequestException('Failed to create Reciter');
    }
  }

  async updateReciter(id: number, data: UpdateContentDto): Promise<ContentItem> {
    try {
      const reciter = await this.prisma.quranReciter.update({
        where: { id },
        data,
      });

      this.logger.log(`Updated Reciter: ${reciter.name}`);
      return reciter;
    } catch (error) {
      this.logger.error(`Failed to update Reciter: ${error.message}`);
      throw new BadRequestException('Failed to update Reciter');
    }
  }

  async deleteReciter(id: number): Promise<void> {
    try {
      await this.prisma.quranReciter.delete({
        where: { id },
      });

      this.logger.log(`Deleted Reciter with ID: ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete Reciter: ${error.message}`);
      throw new BadRequestException('Failed to delete Reciter');
    }
  }

  // Generic content management methods
  async getContent(module: string, query: ContentQuery = {}): Promise<{ data: ContentItem[]; total: number }> {
    switch (module.toLowerCase()) {
      case 'quran':
        return this.getQuranChapters(query);
      case 'hadith':
        return this.getHadithCollections(query);
      case 'finance':
        return this.getGoldPrices(query);
      case 'audio':
        return this.getReciters(query);
      case 'prayer':
        return this.getPrayerLocations(query);
      default:
        throw new BadRequestException(`Unsupported module: ${module}`);
    }
  }

  async getContentById(module: string, id: number | string): Promise<ContentItem> {
    switch (module.toLowerCase()) {
      case 'quran':
        return this.getQuranChapterById(id as number);
      case 'hadith':
        return this.getHadithCollectionById(id as number);
      case 'finance':
        return this.getGoldPriceById(id as string);
      case 'audio':
        return this.getReciterById(id as number);
      case 'prayer':
        return this.getPrayerLocationById(id as number);
      default:
        throw new BadRequestException(`Unsupported module: ${module}`);
    }
  }

  async createContent(module: string, data: CreateContentDto): Promise<ContentItem> {
    switch (module.toLowerCase()) {
      case 'quran':
        return this.createQuranChapter(data);
      case 'hadith':
        return this.createHadithCollection(data);
      case 'finance':
        return this.createGoldPrice(data);
      case 'audio':
        return this.createReciter(data);
      case 'prayer':
        return this.createPrayerLocation(data);
      default:
        throw new BadRequestException(`Unsupported module: ${module}`);
    }
  }

  async updateContent(module: string, id: number | string, data: UpdateContentDto): Promise<ContentItem> {
    switch (module.toLowerCase()) {
      case 'quran':
        return this.updateQuranChapter(id as number, data);
      case 'hadith':
        return this.updateHadithCollection(id as number, data);
      case 'finance':
        return this.updateGoldPrice(id as string, data);
      case 'audio':
        return this.updateReciter(id as number, data);
      case 'prayer':
        return this.updatePrayerLocation(id as number, data);
      default:
        throw new BadRequestException(`Unsupported module: ${module}`);
    }
  }

  async deleteContent(module: string, id: number | string): Promise<void> {
    switch (module.toLowerCase()) {
      case 'quran':
        return this.deleteQuranChapter(id as number);
      case 'hadith':
        return this.deleteHadithCollection(id as number);
      case 'finance':
        return this.deleteGoldPrice(id as string);
      case 'audio':
        return this.deleteReciter(id as number);
      case 'prayer':
        return this.deletePrayerLocation(id as number);
      default:
        throw new BadRequestException(`Unsupported module: ${module}`);
    }
  }

  // Prayer Content Management (Locations)
  async getPrayerLocations(query: ContentQuery = {}): Promise<{ data: ContentItem[]; total: number }> {
    const { page = 1, limit = 20, search, filters, sortBy = 'city', sortOrder = 'asc' } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (search) {
      where.OR = [
        { city: { contains: search, mode: 'insensitive' } },
        { country: { contains: search, mode: 'insensitive' } },
        { timezone: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (filters?.country) where.country = filters.country;
    if (filters?.timezone) where.timezone = filters.timezone;

    const [data, total] = await Promise.all([
      (this.prisma as any).prayerLocation.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      (this.prisma as any).prayerLocation.count({ where }),
    ]);

    return { data, total };
  }

  async getPrayerLocationById(id: number): Promise<ContentItem> {
    const item = await (this.prisma as any).prayerLocation.findUnique({ where: { id } });
    if (!item) throw new NotFoundException('Prayer location not found');
    return item;
  }

  async createPrayerLocation(data: CreateContentDto): Promise<ContentItem> {
    try {
      const item = await (this.prisma as any).prayerLocation.create({
        data: {
          locKey: data.locKey,
          lat: data.lat,
          lng: data.lng,
          city: data.city,
          country: data.country,
          timezone: data.timezone,
          elevation: data.elevation ?? 0,
          source: data.source || 'manual',
        },
      });
      this.logger.log(`Created prayer location: ${item.city || item.locKey}`);
      return item;
    } catch (error) {
      this.logger.error(`Failed to create prayer location: ${error.message}`);
      throw new BadRequestException('Failed to create prayer location');
    }
  }

  async updatePrayerLocation(id: number, data: UpdateContentDto): Promise<ContentItem> {
    try {
      const item = await (this.prisma as any).prayerLocation.update({
        where: { id },
        data,
      });
      this.logger.log(`Updated prayer location ID ${id}`);
      return item;
    } catch (error) {
      this.logger.error(`Failed to update prayer location: ${error.message}`);
      throw new BadRequestException('Failed to update prayer location');
    }
  }

  async deletePrayerLocation(id: number): Promise<void> {
    try {
      await (this.prisma as any).prayerLocation.delete({ where: { id } });
      this.logger.log(`Deleted prayer location ID ${id}`);
    } catch (error) {
      this.logger.error(`Failed to delete prayer location: ${error.message}`);
      throw new BadRequestException('Failed to delete prayer location');
    }
  }
}
