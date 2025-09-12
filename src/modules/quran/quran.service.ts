import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { CommonHttpService } from "../../common/common.module";
import { QuranMapper } from "./quran.mapper";
import { RedisService } from "../../redis/redis.service";

@Injectable()
export class QuranService {
  private readonly logger = new Logger(QuranService.name);
  private readonly upstreamBaseUrl = "https://api.quran.com/api/v4";

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: CommonHttpService,
    private readonly mapper: QuranMapper,
    private readonly redis: RedisService,
  ) {}

  async getChapters(page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;

      const chaptersRaw = await (this.prisma as any).quranChapter.findMany({
        skip,
        take: limit,
        orderBy: { chapterNumber: "asc" },
        select: {
          chapterNumber: true,
          nameArabic: true,
          nameSimple: true,
          nameEnglish: true,
          nameBangla: true,
          revelationPlace: true,
          revelationOrder: true,
          versesCount: true,
          bismillahPre: true,
          lastSynced: true,
        },
      });

      if (chaptersRaw.length === 0) {
        this.logger.warn(
          "No chapters found in database, falling back to upstream API",
        );
        return await this.fallbackToUpstream("chapters", { page, limit });
      }

      const total = await (this.prisma as any).quranChapter.count();
      const chapters = chaptersRaw.map((c: any) =>
        this.mapper.mapChapterToUpstreamFormat(c),
      );

      return {
        chapters,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(total / limit),
          total_count: total,
          per_page: limit,
        },
      } as any;
    } catch (error) {
      this.logger.error(
        `Failed to get chapters from database: ${error.message}`,
      );
      return await this.fallbackToUpstream("chapters", { page, limit });
    }
  }

  async getChapter(chapterNumber: number) {
    try {
      const chapter = await (this.prisma as any).quranChapter.findUnique({
        where: { chapterNumber },
        select: {
          chapterNumber: true,
          nameArabic: true,
          nameSimple: true,
          nameEnglish: true,
          nameBangla: true,
          revelationPlace: true,
          revelationOrder: true,
          versesCount: true,
          bismillahPre: true,
          lastSynced: true,
        },
      });

      if (!chapter) {
        this.logger.warn(
          `Chapter ${chapterNumber} not found in database, falling back to upstream API`,
        );
        return await this.fallbackToUpstream("chapter", { chapterNumber });
      }

      return {
        code: 200,
        status: "Success",
        data: { chapter },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get chapter ${chapterNumber} from database: ${error.message}`,
      );
      return await this.fallbackToUpstream("chapter", { chapterNumber });
    }
  }

  async getVersesByChapter(chapterNumber: number, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;

      const versesRaw = await (this.prisma as any).quranVerse.findMany({
        where: { chapterNumber },
        skip,
        take: limit,
        orderBy: { verseNumber: "asc" },
        select: {
          id: true,
          chapterNumber: true,
          verseNumber: true,
          verseKey: true,
          textUthmani: true,
          textSimple: true,
          textIndopak: true,
          textImlaei: true,
          pageNumber: true,
          juzNumber: true,
          hizbNumber: true,
          rubNumber: true,
          sajdaType: true,
          lastSynced: true,
        },
      });

      if (versesRaw.length === 0) {
        this.logger.warn(
          `No verses found for chapter ${chapterNumber} in database, falling back to upstream API`,
        );
        return await this.fallbackToUpstream("verses", {
          chapterNumber,
          page,
          limit,
        });
      }

      // Check if verse data is actually populated (any variant present)
      const hasValidData = versesRaw.some(
        (v) =>
          (v.textUthmani && v.textUthmani.trim().length > 0) ||
          (v.textSimple && v.textSimple.trim().length > 0) ||
          (v.textIndopak && v.textIndopak.trim().length > 0) ||
          (v.textImlaei && v.textImlaei.trim().length > 0),
      );
      if (!hasValidData) {
        this.logger.warn(
          `Verses found for chapter ${chapterNumber} but text data is null/empty, falling back to upstream API`,
        );
        return await this.fallbackToUpstream("verses", {
          chapterNumber,
          page,
          limit,
        });
      }

      const total = await (this.prisma as any).quranVerse.count({
        where: { chapterNumber },
      });
      const verses = versesRaw.map((v: any) =>
        this.mapper.mapVerseToUpstreamFormat(v),
      );

      return {
        verses,
        pagination: {
          current_page: page,
          total_pages: Math.ceil(total / limit),
          total_count: total,
          per_page: limit,
        },
      } as any;
    } catch (error) {
      this.logger.error(
        `Failed to get verses for chapter ${chapterNumber} from database: ${error.message}`,
      );
      return await this.fallbackToUpstream("verses", {
        chapterNumber,
        page,
        limit,
      });
    }
  }

  async getVerse(verseKey: string) {
    try {
      const verse = await (this.prisma as any).quranVerse.findUnique({
        where: { verseKey },
        select: {
          id: true,
          chapterNumber: true,
          verseNumber: true,
          verseKey: true,
          textUthmani: true,
          textSimple: true,
          textIndopak: true,
          textImlaei: true,
          pageNumber: true,
          juzNumber: true,
          hizbNumber: true,
          rubNumber: true,
          sajdaType: true,
          lastSynced: true,
        },
      });

      if (!verse) {
        this.logger.warn(
          `Verse ${verseKey} not found in database, falling back to upstream API`,
        );
        return await this.fallbackToUpstream("verse", { verseKey });
      }

      // Check if verse data is actually populated (any variant present)
      if (
        !(
          (verse.textUthmani && verse.textUthmani.trim().length > 0) ||
          (verse.textSimple && verse.textSimple.trim().length > 0) ||
          (verse.textIndopak && verse.textIndopak.trim().length > 0) ||
          (verse.textImlaei && verse.textImlaei.trim().length > 0)
        )
      ) {
        this.logger.warn(
          `Verse ${verseKey} found but text data is null/empty, falling back to upstream API`,
        );
        return await this.fallbackToUpstream("verse", { verseKey });
      }

      return {
        code: 200,
        status: "Success",
        data: { verse },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get verse ${verseKey} from database: ${error.message}`,
      );
      return await this.fallbackToUpstream("verse", { verseKey });
    }
  }

  async getTranslationResources(page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;

      const resources = await (this.prisma as any).translationResource.findMany(
        {
          skip,
          take: limit,
          where: { isActive: true },
          orderBy: { name: "asc" },
          select: {
            id: true,
            resourceId: true,
            languageCode: true,
            name: true,
            authorName: true,
            languageName: true,
            direction: true,
            isActive: true,
            lastSynced: true,
          },
        },
      );

      if (resources.length === 0) {
        this.logger.warn(
          "No translation resources found in database, falling back to upstream API",
        );
        return await this.fallbackToUpstream("translations", { page, limit });
      }

      const total = await (this.prisma as any).translationResource.count({
        where: { isActive: true },
      });

      return {
        code: 200,
        status: "Success",
        data: {
          translations: resources,
          pagination: {
            current_page: page,
            total_pages: Math.ceil(total / limit),
            total_count: total,
            per_page: limit,
          },
        },
      };
    } catch (error) {
      this.logger.error(
        `Failed to get translation resources from database: ${error.message}`,
      );
      return await this.fallbackToUpstream("translations", { page, limit });
    }
  }

  // New: List translation resources with optional language filter (DB-first, fallback upstream)
  async getTranslationResourcesFiltered(
    language?: string,
    page = 1,
    limit = 50,
  ) {
    try {
      const whereClause: any = { isActive: true };
      if (language) {
        const lang = language.toLowerCase();
        whereClause.OR = [
          { languageCode: { equals: lang, mode: "insensitive" } },
          { languageName: { contains: lang, mode: "insensitive" } },
        ];
      }
      const resources = await (this.prisma as any).translationResource.findMany(
        {
          where: whereClause,
          orderBy: { name: "asc" },
          take: limit,
        },
      );
      if (resources.length === 0) {
        return await this.fallbackToUpstream("translations", {
          language,
          page,
          limit,
        });
      }
      return {
        code: 200,
        status: "Success",
        data: { translations: resources },
      };
    } catch (e) {
      this.logger.error(
        `Failed to list translation resources (filtered): ${e instanceof Error ? e.message : String(e)}`,
      );
      return await this.fallbackToUpstream("translations", {
        language,
        page,
        limit,
      });
    }
  }

  // New: Verses by chapter including translations (fallback upstream mirror)
  async getVersesByChapterWithTranslations(
    chapterNumber: number,
    language: string | undefined,
    translationIds: number[] | undefined,
    page = 1,
    limit = 10,
  ) {
    // For now, serve upstream-compatible payload directly
    return await this.fallbackToUpstream("verses-with-translations", {
      chapterNumber,
      language,
      translationIds,
      page,
      limit,
    });
  }

  // New: Single verse including translations (fallback upstream mirror)
  async getVerseWithTranslations(
    verseKey: string,
    language: string | undefined,
    translationIds: number[] | undefined,
  ) {
    return await this.fallbackToUpstream("verse-with-translations", {
      verseKey,
      language,
      translationIds,
    });
  }

  async getVerseTranslations(verseKey: string, resourceIds?: number[]) {
    try {
      const verse = await (this.prisma as any).quranVerse.findUnique({
        where: { verseKey },
        include: {
          translations: {
            where:
              resourceIds && resourceIds.length > 0
                ? { resourceId: { in: resourceIds } }
                : {},
            include: {
              resource: {
                select: {
                  name: true,
                  authorName: true,
                  languageName: true,
                },
              },
            },
          },
        },
      });

      // Cache key based on explicit IDs or auto EN/BN
      const keySuffix =
        resourceIds && resourceIds.length > 0
          ? `rids_${resourceIds.sort((a, b) => a - b).join("_")}`
          : "auto_enbn";
      const cacheKey = `quran:translations:${verseKey}:${keySuffix}:v1`;
      if (!verse || verse.translations.length === 0) {
        // If explicit resourceIds provided, go straight to upstream with those
        if (resourceIds && resourceIds.length > 0) {
          const res = await this.fallbackToUpstream("verse-translations", {
            verseKey,
            resourceIds,
          });
          if (res.code === 200) {
            await this.redis.set(cacheKey, JSON.stringify(res.data), 21600);
            if (res.headers) res.headers["X-DeenMate-Cache"] = "miss";
          }
          return res;
        }
        // Otherwise try to resolve EN/BN; if fail, mirror Quran.com behavior and require resource_ids
        const autoIds = await this.resolveEnBnResourceIds();
        if (!autoIds || autoIds.length === 0) {
          return {
            code: 400,
            status: "Bad Request",
            message:
              "resource_ids are required when translation resources cannot be resolved upstream",
          } as any;
        }
        this.logger.warn(
          `No translations found for verse ${verseKey} in DB, falling back with EN/BN IDs: ${autoIds.join(",")}`,
        );
        const res = await this.fallbackToUpstream("verse-translations", {
          verseKey,
          resourceIds: autoIds,
        });
        if (res.code === 200) {
          await this.redis.set(cacheKey, JSON.stringify(res.data), 21600);
          if (res.headers) res.headers["X-DeenMate-Cache"] = "miss";
        }
        return res;
      }

      const payload = { translations: verse.translations };
      await this.redis.set(cacheKey, JSON.stringify(payload), 21600);
      return {
        code: 200,
        status: "Success",
        data: payload,
      };
    } catch (error) {
      this.logger.error(
        `Failed to get translations for verse ${verseKey} from database: ${error.message}`,
      );
      // On error, if explicit IDs exist use them; otherwise try EN/BN, else 400
      if (resourceIds && resourceIds.length > 0) {
        return await this.fallbackToUpstream("verse-translations", {
          verseKey,
          resourceIds,
        });
      }
      const autoIds = await this.resolveEnBnResourceIds();
      if (!autoIds || autoIds.length === 0) {
        return {
          code: 400,
          status: "Bad Request",
          message:
            "resource_ids are required when translation resources cannot be resolved upstream",
        } as any;
      }
      return await this.fallbackToUpstream("verse-translations", {
        verseKey,
        resourceIds: autoIds,
      });
    }
  }

  async searchQuran(query: string, page = 1, limit = 10) {
    try {
      const skip = (page - 1) * limit;

      // Search in verses text
      const verses = await (this.prisma as any).quranVerse.findMany({
        where: {
          OR: [
            { textSimple: { contains: query, mode: "insensitive" } },
            { textUthmani: { contains: query, mode: "insensitive" } },
          ],
        },
        skip,
        take: limit,
        include: {
          chapter: {
            select: {
              nameSimple: true,
              nameArabic: true,
            },
          },
        },
        orderBy: { chapterNumber: "asc" },
      });

      if (verses.length === 0) {
        this.logger.warn(
          `No search results found for "${query}" in database, falling back to upstream API`,
        );
        return await this.fallbackToUpstream("search", { query, page, limit });
      }

      const total = await (this.prisma as any).quranVerse.count({
        where: {
          OR: [
            { textSimple: { contains: query, mode: "insensitive" } },
            { textUthmani: { contains: query, mode: "insensitive" } },
          ],
        },
      });

      return {
        code: 200,
        status: "Success",
        data: {
          search_results: verses,
          pagination: {
            current_page: page,
            total_pages: Math.ceil(total / limit),
            total_count: total,
            per_page: limit,
          },
        },
      };
    } catch (error) {
      this.logger.error(`Failed to search Quran in database: ${error.message}`);
      return await this.fallbackToUpstream("search", { query, page, limit });
    }
  }

  // Updated: Reciters fallback with cache (TTL 6h) + language
  async getReciters(language?: string) {
    const langKey = language ? language.toLowerCase() : "all";
    const cacheKey = `quran:reciters:${langKey}:v1`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      return {
        code: 200,
        status: "Success (Cache)",
        data,
        headers: { "X-DeenMate-Source": "cache", "X-DeenMate-Cache": "hit" },
      };
    }
    const res = await this.fallbackToUpstream("reciters", { language });
    if (res.code === 200) {
      await this.redis.set(cacheKey, JSON.stringify(res.data), 21600);
      if (res.headers) res.headers["X-DeenMate-Cache"] = "miss";
    }
    return res;
  }

  // Updated: Tafsir resources fallback with cache (TTL 24h) + language
  async getTafsirResources(language?: string) {
    const langKey = language ? language.toLowerCase() : "all";
    const cacheKey = `quran:tafsirs:${langKey}:v1`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      return {
        code: 200,
        status: "Success (Cache)",
        data,
        headers: { "X-DeenMate-Source": "cache", "X-DeenMate-Cache": "hit" },
      };
    }
    const res = await this.fallbackToUpstream("tafsirs", { language });
    if (res.code === 200) {
      await this.redis.set(cacheKey, JSON.stringify(res.data), 86400);
      if (res.headers) res.headers["X-DeenMate-Cache"] = "miss";
    }
    return res;
  }

  // New: Recitation audio by chapter (verse-by-verse)
  async getRecitationByChapter(
    recitationId: number,
    chapterNumber: number,
    page?: number,
    perPage?: number,
  ) {
    const cacheKey = `quran:audio:recitation:${recitationId}:chapter:${chapterNumber}:page:${page || "all"}:per:${perPage || "all"}:v1`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      return {
        code: 200,
        status: "Success (Cache)",
        data,
        headers: { "X-DeenMate-Source": "cache", "X-DeenMate-Cache": "hit" },
      };
    }
    const res = await this.fallbackToUpstream("recitation-by-chapter", {
      recitationId,
      chapterNumber,
      page,
      perPage,
    });
    if (res.code === 200) {
      await this.redis.set(cacheKey, JSON.stringify(res.data), 21600);
      if (res.headers) res.headers["X-DeenMate-Cache"] = "miss";
    }
    return res;
  }

  // New: Recitation audio by ayah
  async getRecitationByAyah(recitationId: number, verseKey: string) {
    const cacheKey = `quran:audio:recitation:${recitationId}:ayah:${verseKey}:v1`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      return {
        code: 200,
        status: "Success (Cache)",
        data,
        headers: { "X-DeenMate-Source": "cache", "X-DeenMate-Cache": "hit" },
      };
    }
    const res = await this.fallbackToUpstream("recitation-by-ayah", {
      recitationId,
      verseKey,
    });
    if (res.code === 200) {
      await this.redis.set(cacheKey, JSON.stringify(res.data), 21600);
      if (res.headers) res.headers["X-DeenMate-Cache"] = "miss";
    }
    return res;
  }

  // New: Verse tafsir fallback with cache (TTL 6h)
  async getVerseTafsir(
    verseKey: string,
    tafsirId?: number,
    tafsirIds?: number[],
    plain?: boolean,
  ) {
    const keyIds =
      tafsirIds && tafsirIds.length
        ? tafsirIds.sort((a, b) => a - b).join("_")
        : tafsirId || "all";
    const cacheKey = `quran:tafsir:${verseKey}:${keyIds}:plain:${plain ? "1" : "0"}:v1`;
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      const data = JSON.parse(cached);
      return {
        code: 200,
        status: "Success (Cache)",
        data,
        headers: { "X-DeenMate-Source": "cache", "X-DeenMate-Cache": "hit" },
      };
    }
    if (tafsirIds && tafsirIds.length) {
      // Aggregate multiple tafsir calls
      const items: any[] = [];
      for (const id of tafsirIds) {
        const r = await this.fallbackToUpstream("verse-tafsir", {
          verseKey,
          tafsirId: id,
        });
        if (r.code === 200) {
          const payload: any = r.data;
          try {
            if (payload && payload.tafsir) {
              const t = payload.tafsir;
              items.push({
                id: t.id ?? undefined,
                resourceId: t.resource_id ?? id,
                name: t.resource_name ?? t.name ?? undefined,
                language: t.language_name ?? undefined,
                text: t.text ?? t.body ?? t.content ?? "",
              });
            } else if (
              payload &&
              payload.verse &&
              Array.isArray(payload.verse.tafsirs)
            ) {
              for (const t of payload.verse.tafsirs) {
                items.push({
                  id: t.id ?? undefined,
                  resourceId: t.resource_id ?? id,
                  name: t.resource_name ?? t.name ?? undefined,
                  language: t.language_name ?? undefined,
                  text: t.text ?? t.body ?? t.content ?? "",
                });
              }
            }
          } catch {}
        }
      }
      const aggregated = {
        tafsir: items.map((t) => ({
          ...t,
          text: plain
            ? String(t.text || "")
                .replace(/<[^>]*>/g, " ")
                .replace(/\s+/g, " ")
                .trim()
            : t.text,
        })),
      };
      await this.redis.set(cacheKey, JSON.stringify(aggregated), 21600);
      return { code: 200, status: "Success", data: aggregated } as any;
    }

    const res = await this.fallbackToUpstream("verse-tafsir", {
      verseKey,
      tafsirId,
    });
    if (res.code === 200) {
      // Unwrap deterministic tafsir endpoint or embedded shape
      let payload: any = res.data;
      try {
        if (res.data && res.data.tafsir) {
          // Deterministic endpoint: { tafsir: { id, resource_name, text, ... } }
          const t = res.data.tafsir;
          payload = {
            tafsir: [
              {
                id: t.id ?? undefined,
                resourceId: t.resource_id ?? tafsirId ?? undefined,
                name: t.resource_name ?? t.name ?? undefined,
                language: t.language_name ?? undefined,
                text: t.text ?? t.body ?? t.content ?? "",
              },
            ],
          };
        } else {
          const v =
            (res.data && (res.data.verse || res.data.data?.verse)) || null;
          const tafsirs =
            (v &&
              (v.tafsirs ||
                v.tafsirs_with_sources ||
                v.tafsir ||
                v.tafsir_with_sources)) ||
            null;
          if (Array.isArray(tafsirs) && tafsirs.length) {
            payload = {
              tafsir: tafsirs.map((t: any) => ({
                id: t.id ?? undefined,
                resourceId:
                  t.resource_id ?? t.tafsir_id ?? tafsirId ?? undefined,
                name: t.resource_name ?? t.name ?? undefined,
                language: t.language_name ?? undefined,
                text: t.text ?? t.body ?? t.content ?? "",
              })),
            };
          }
        }
      } catch {}
      if (payload && Array.isArray(payload.tafsir)) {
        payload = {
          tafsir: payload.tafsir.map((t: any) => ({
            ...t,
            text: plain
              ? String(t.text || "")
                  .replace(/<[^>]*>/g, " ")
                  .replace(/\s+/g, " ")
                  .trim()
              : t.text,
          })),
        };
      }
      await this.redis.set(cacheKey, JSON.stringify(payload), 21600);
      if (res.headers) res.headers["X-DeenMate-Cache"] = "miss";
      return { code: 200, status: "Success", data: payload } as any;
    }
    return res;
  }

  private async resolveEnBnResourceIds(): Promise<number[]> {
    // 1) Try cache first
    const cacheKey = "quran:translation_ids:en_bn:v1";
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      try {
        const arr = JSON.parse(cached);
        if (Array.isArray(arr) && arr.length > 0) return arr;
      } catch {}
    }

    // 2) Try env-based fallback
    try {
      const envIdsRaw =
        process.env.QURAN_FALLBACK_TRANSLATION_IDS ||
        process.env.QURAN_FALLBACK_TRANSLATION_IDS_EN_BN;
      if (envIdsRaw) {
        const envIds = envIdsRaw
          .split(",")
          .map((x) => parseInt(x.trim(), 10))
          .filter((n) => !isNaN(n));
        if (envIds.length > 0) {
          await this.redis.set(cacheKey, JSON.stringify(envIds), 21600);
          this.logger.warn(
            `Using env-based fallback translation IDs: ${envIds.join(",")}`,
          );
          return envIds;
        }
      }
    } catch (_e) {
      this.logger.warn("Failed parsing env-based translation IDs fallback");
    }

    // 3) Resolve from upstream
    try {
      const body = await this.httpService.get<any>(
        `${this.upstreamBaseUrl}/resources/translations`,
        { timeout: 15000 },
      );
      const translations: any[] = body?.translations || [];
      const ids: number[] = [];
      for (const t of translations) {
        const lang = (t.language || t.language_name || "").toLowerCase();
        if (
          lang === "en" ||
          lang === "english" ||
          lang === "bn" ||
          lang === "bangla" ||
          lang === "bengali"
        ) {
          if (typeof t.id === "number") ids.push(t.id);
        }
      }
      const unique = Array.from(new Set(ids)).slice(0, 10);
      if (unique.length > 0) {
        await this.redis.set(cacheKey, JSON.stringify(unique), 21600);
      }
      return unique;
    } catch (e) {
      this.logger.error(
        `Failed to resolve EN/BN resource IDs: ${e instanceof Error ? e.message : String(e)}`,
      );
      return [];
    }
  }

  private async fallbackToUpstream(endpoint: string, params: any) {
    try {
      this.logger.log(`Falling back to upstream API for ${endpoint}`);

      let url = `${this.upstreamBaseUrl}`;

      switch (endpoint) {
        case "chapters":
          url += "/chapters";
          break;
        case "chapter":
          url += `/chapters/${params.chapterNumber}`;
          break;
        case "verses":
          url += `/verses/by_chapter/${params.chapterNumber}?language=en&translations=20,22,19&page=${params.page}&per_page=${params.limit}&words=false&fields=text_uthmani,text_simple,text_indopak,text_imlaei,translations,audio,verse_key,verse_number&translation_fields=text,resource_id,language_name`;
          break;
        case "verse":
          url += `/verses/by_key/${params.verseKey}?language=en&translations=20,22,19&words=false&fields=text_uthmani,text_simple,text_indopak,text_imlaei,translations,audio,verse_key,verse_number&translation_fields=text,resource_id,language_name`;
          break;
        case "translations":
          url += "/resources/translations";
          if (params.language)
            url += `?language=${encodeURIComponent(params.language)}`;
          break;
        case "verses-with-translations": {
          const qp: string[] = [
            "language=en",
            "words=false",
            "fields=text_uthmani,text_simple,text_indopak,text_imlaei,translations,audio,verse_key,verse_number",
            "translation_fields=text,resource_id,language_name",
          ];
          if (params.language)
            qp[0] = `language=${encodeURIComponent(params.language)}`;
          if (
            Array.isArray(params.translationIds) &&
            params.translationIds.length
          )
            qp.push(`translations=${params.translationIds.join(",")}`);
          if (params.page) qp.push(`page=${params.page}`);
          if (params.limit) qp.push(`per_page=${params.limit}`);
          const qs = qp.length ? `?${qp.join("&")}` : "";
          url += `/verses/by_chapter/${params.chapterNumber}${qs}`;
          break;
        }
        case "verse-with-translations": {
          const qp: string[] = [
            "language=en",
            "words=false",
            "fields=text_uthmani,text_simple,text_indopak,text_imlaei,translations,audio,verse_key,verse_number",
            "translation_fields=text,resource_id,language_name",
          ];
          if (params.language)
            qp[0] = `language=${encodeURIComponent(params.language)}`;
          if (
            Array.isArray(params.translationIds) &&
            params.translationIds.length
          )
            qp.push(`translations=${params.translationIds.join(",")}`);
          const qs = qp.length ? `?${qp.join("&")}` : "";
          url += `/verses/by_key/${encodeURIComponent(params.verseKey)}${qs}`;
          break;
        }
        case "verse-translations": {
          const qp: string[] = [
            "language=en",
            "words=false",
            "fields=text_uthmani,text_simple,text_indopak,text_imlaei,translations,audio,verse_key,verse_number",
            "translation_fields=text,resource_id,language_name",
          ];
          if (params.language)
            qp[0] = `language=${encodeURIComponent(params.language)}`;
          if (Array.isArray(params.resourceIds) && params.resourceIds.length)
            qp.push(`translations=${params.resourceIds.join(",")}`);
          const qs = qp.length ? `?${qp.join("&")}` : "";
          url += `/verses/by_key/${encodeURIComponent(params.verseKey)}${qs}`;
          break;
        }
        case "tafsirs":
          url += "/resources/tafsirs";
          if (params.language)
            url += `?language=${encodeURIComponent(params.language)}`;
          break;
        case "verse-tafsir":
          if (params.tafsirId) {
            // Use dedicated tafsir endpoint for deterministic payload
            // /tafsirs/{tafsirId}/by_ayah/{verse_key}
            url += `/tafsirs/${params.tafsirId}/by_ayah/${encodeURIComponent(params.verseKey)}`;
          } else {
            // Fallback: embedded tafsir on verse
            url += `/verses/by_key/${params.verseKey}`;
          }
          break;
        case "reciters":
          url += "/resources/recitations";
          if (params.language)
            url += `?language=${encodeURIComponent(params.language)}`;
          break;
        case "recitation-by-chapter":
          url += `/recitations/${params.recitationId}/by_chapter/${params.chapterNumber}`;
          if (params.page || params.perPage) {
            const qp: string[] = [];
            if (params.page) qp.push(`page=${params.page}`);
            if (params.perPage) qp.push(`per_page=${params.perPage}`);
            if (qp.length) url += `?${qp.join("&")}`;
          }
          break;
        case "recitation-by-ayah":
          url += `/recitations/${params.recitationId}/by_ayah/${encodeURIComponent(params.verseKey)}`;
          break;
        case "search":
          url += `/search?q=${encodeURIComponent(params.query)}&page=${params.page}&size=${params.limit}`;
          break;
        default:
          throw new Error(`Unknown endpoint: ${endpoint}`);
      }

      const data = await this.httpService.get<any>(url, { timeout: 20000 });

      if (data && typeof data === "object") {
        (data as any)._fallback = true;
        (data as any)._source = "upstream";
      }

      // Special handling for verse-translations endpoint
      if (
        endpoint === "verse-translations" &&
        data &&
        data.verse &&
        data.verse.translations
      ) {
        return {
          code: 200,
          status: "Success (Fallback)",
          data: { translations: data.verse.translations },
          headers: {
            "X-DeenMate-Source": "upstream-fallback",
            "X-DeenMate-Cache": "miss",
          },
        };
      }

      return {
        code: 200,
        status: "Success (Fallback)",
        data,
        headers: {
          "X-DeenMate-Source": "upstream-fallback",
          "X-DeenMate-Cache": "miss",
        },
      };
    } catch (error) {
      this.logger.error(
        `Fallback to upstream API failed for ${endpoint}: ${error.message}`,
      );

      return {
        code: 503,
        status: "Service Unavailable",
        message: "Both local database and upstream API are unavailable",
        error: error.message,
      };
    }
  }
}
