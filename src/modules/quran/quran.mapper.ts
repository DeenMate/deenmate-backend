export interface UpstreamChapter {
  id: number;
  revelation_place: string;
  revelation_order: number;
  bismillah_pre: boolean;
  name_simple: string;
  name_arabic: string;
  name_complex: string;
  verses_count: number;
  pages: number[];
  translated_name: {
    language_name: string;
    name: string;
  };
}

export interface UpstreamVerse {
  id: number;
  verse_number?: number;
  chapter_id?: number;
  verse_key: string;
  text_uthmani?: string;
  text_indopak?: string;
  text_simple?: string;
  text_imlaei?: string;
  juz_number?: number;
  hizb_number?: number;
  rub_number?: number;
  sajda_type?: string | null;
  sajda_number?: number | null;
  page_number?: number;
  words?: Array<{
    id: number;
    position: number;
    text_uthmani: string;
    text_indopak: string;
    text_simple: string;
    text_imlaei: string;
    verse_key: string;
    char_type: string;
    line_number: number;
    page_number: number;
    code: string;
    code_v2: string;
    v1_page: number;
    v2_page: number;
    hizb_number: number;
    rub_number: number;
    sajda_type: string | null;
    sajda_number: number | null;
    juz_number: number;
    manzil_number: number;
    ruku_number: number;
    translation: {
      text: string;
      language_name: string;
      resource_name: string;
      resource_id: number;
    };
    transliteration: {
      text: string;
      language_name: string;
      resource_name: string;
      resource_id: number;
    };
  }>;
}

export interface UpstreamTranslationResource {
  id: number;
  name: string;
  author_name: string;
  language: string;
  language_name: string;
  direction: string | null;
  source: string;
  comments: string | null;
  license: string | null;
  license_url: string | null;
  url: string | null;
}

export interface UpstreamVerseTranslation {
  id: number;
  verse_id: number;
  resource_id: number;
  text: string;
  footnotes: string | null;
}

export class QuranMapper {
  mapChapterFromUpstream(upstream: UpstreamChapter) {
    return {
      chapterNumber: upstream.id,
      nameArabic: upstream.name_arabic,
      nameSimple: upstream.name_simple,
      nameEnglish: upstream.translated_name?.name || null,
      nameBangla: null, // Not available in upstream
      revelationPlace: upstream.revelation_place,
      revelationOrder: upstream.revelation_order,
      versesCount: upstream.verses_count,
      bismillahPre: upstream.bismillah_pre,
      source: "quran.com",
      lastSynced: new Date(),
    };
  }

  mapVerseFromUpstream(upstream: UpstreamVerse) {
    const [keyChapterStr, keyVerseStr] = upstream.verse_key?.split(":") || [
      "0",
      "0",
    ];
    const chapterNumber = upstream.chapter_id ?? parseInt(keyChapterStr, 10);
    const verseNumber = upstream.verse_number ?? parseInt(keyVerseStr, 10);

    return {
      chapterNumber,
      verseNumber,
      verseKey: upstream.verse_key,
      textUthmani: upstream.text_uthmani || null,
      textSimple: upstream.text_simple || null,
      textIndopak: upstream.text_indopak || null,
      textImlaei: upstream.text_imlaei || null,
      pageNumber: upstream.page_number ?? null,
      juzNumber: upstream.juz_number ?? null,
      hizbNumber: upstream.hizb_number ?? null,
      rubNumber: upstream.rub_number ?? null,
      sajdaType: upstream.sajda_type ?? null,
      source: "quran.com",
      lastSynced: new Date(),
    };
  }

  mapTranslationResourceFromUpstream(upstream: UpstreamTranslationResource) {
    return {
      resourceId: Number(upstream.id),
      languageCode: upstream.language || "en",
      name: upstream.name || "Unknown",
      authorName: upstream.author_name || null,
      languageName: upstream.language_name || null,
      direction: upstream.direction || null,
      isActive: true,
      source: "quran.com",
      lastSynced: new Date(),
    };
  }

  mapVerseTranslationFromUpstream(upstream: UpstreamVerseTranslation) {
    return {
      verseId: upstream.verse_id,
      resourceId: upstream.resource_id,
      text: upstream.text,
      footnotes: upstream.footnotes,
      source: "quran.com",
      lastSynced: new Date(),
    };
  }

  mapChapterToUpstreamFormat(chapter: any) {
    return {
      id: chapter.chapterNumber,
      revelation_place: chapter.revelationPlace,
      revelation_order: chapter.revelationOrder,
      bismillah_pre: chapter.bismillahPre,
      name_simple: chapter.nameSimple,
      name_arabic: chapter.nameArabic,
      name_complex: chapter.nameSimple,
      verses_count: chapter.versesCount,
      pages: [], // Not stored in our DB
      translated_name: {
        language_name: "english",
        name: chapter.nameEnglish || chapter.nameSimple,
      },
    };
  }

  mapVerseToUpstreamFormat(verse: any) {
    return {
      id: verse.id,
      verse_number: verse.verseNumber,
      chapter_id: verse.chapterNumber,
      verse_key: verse.verseKey,
      text_uthmani: verse.textUthmani,
      text_indopak: verse.textIndopak,
      text_simple: verse.textSimple,
      text_imlaei: verse.textImlaei,
      juz_number: verse.juzNumber,
      hizb_number: verse.hizbNumber,
      rub_number: verse.rubNumber,
      sajda_type: verse.sajdaType,
      sajda_number: null, // Not stored in our DB
      page_number: verse.pageNumber,
      words: [], // Not stored in our DB
    };
  }

  mapTranslationResourceToUpstreamFormat(resource: any) {
    return {
      id: resource.resourceId,
      name: resource.name,
      author_name: resource.authorName,
      language: resource.languageCode,
      language_name: resource.languageName,
      direction: resource.direction,
      source: resource.source,
      comments: null, // Not stored in our DB
      license: null, // Not stored in our DB
      license_url: null, // Not stored in our DB
      url: null, // Not stored in our DB
    };
  }
}
