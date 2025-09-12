import { Injectable, Logger, HttpException, HttpStatus } from "@nestjs/common";
import { HttpService } from "@nestjs/axios";
import { ConfigService } from "@nestjs/config";
import { firstValueFrom, retry, catchError } from "rxjs";
import { AxiosError } from "axios";

export interface SunnahCollection {
  name: string;
  hasBooks: boolean;
  hasChapters: boolean;
  collection: Array<{
    lang: string;
    title: string;
    shortIntro: string;
  }>;
  totalHadith: number;
  totalAvailableHadith: number;
}

export interface SunnahBook {
  bookNumber: string;
  book: Array<{
    lang: string;
    name: string;
  }>;
  hadithStartNumber: number;
  hadithEndNumber: number;
  numberOfHadith: number;
}

export interface SunnahHadith {
  hadithNumber: number;
  englishNarrator: string;
  hadithEnglish: string;
  hadithUrdu: string;
  hadithArabic: string;
  headingArabic: string;
  headingUrdu: string;
  headingEnglish: string;
  chapterNumber: string;
  bookSlug: string;
  volume: string;
  grades: Array<{
    graded_by: string;
    grade: string;
  }>;
  reference: {
    book: number;
    hadith: number;
  };
}

export interface SunnahApiResponse<T> {
  data: T;
  pagination?: {
    currentPage: number;
    totalPages: number;
    totalRecords: number;
    perPage: number;
  };
}

export interface SunnahBooksResponse {
  data: SunnahBook[];
  limit: number;
  next: string | null;
  previous: string | null;
  total: number;
}

@Injectable()
export class SunnahApiService {
  private readonly logger = new Logger(SunnahApiService.name);
  private readonly baseUrl = "https://api.sunnah.com/v1";
  private readonly apiKey: string;
  private readonly rateLimitDelay = 1000; // 1 second between requests
  private lastRequestTime = 0;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.apiKey = this.configService.get<string>("SUNNAH_API_KEY");
    this.logger.log(`SUNNAH_API_KEY loaded: ${this.apiKey ? "YES" : "NO"}`);
    if (this.apiKey) {
      this.logger.log(`API Key length: ${this.apiKey.length} characters`);
    }
    if (!this.apiKey) {
      this.logger.warn(
        "SUNNAH_API_KEY not configured - using mock data for testing",
      );
      // Don't throw error, allow service to work with mock data
    }
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.rateLimitDelay) {
      const delay = this.rateLimitDelay - timeSinceLastRequest;
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  private getHeaders() {
    return {
      "X-API-Key": this.apiKey,
      "Content-Type": "application/json",
    };
  }

  private async makeRequest<T>(url: string, retries = 3): Promise<T> {
    await this.enforceRateLimit();

    this.logger.debug(`Making request to: ${url}`);

    try {
      const response = await firstValueFrom(
        this.httpService
          .get<T>(url, {
            headers: this.getHeaders(),
            timeout: 30000, // 30 seconds timeout
          })
          .pipe(
            retry({
              count: retries,
              delay: (error, retryCount) => {
                this.logger.warn(
                  `Request failed, retrying (${retryCount}/${retries}): ${error.message}`,
                );
                return new Promise((resolve) =>
                  setTimeout(resolve, Math.pow(2, retryCount) * 1000),
                );
              },
            }),
            catchError((error: AxiosError) => {
              this.logger.error(
                `API request failed: ${error.message}`,
                error.stack,
              );

              if (error.response?.status === 401) {
                throw new HttpException(
                  "Invalid API key",
                  HttpStatus.UNAUTHORIZED,
                );
              } else if (error.response?.status === 429) {
                throw new HttpException(
                  "Rate limit exceeded",
                  HttpStatus.TOO_MANY_REQUESTS,
                );
              } else if (error.response?.status >= 500) {
                throw new HttpException(
                  "Sunnah.com API server error",
                  HttpStatus.BAD_GATEWAY,
                );
              } else {
                throw new HttpException(
                  "Failed to fetch data from Sunnah.com",
                  HttpStatus.BAD_REQUEST,
                );
              }
            }),
          ),
      );

      return response.data;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Unexpected error in API request: ${error.message}`,
        error.stack,
      );
      throw new HttpException(
        "Internal server error",
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  async getCollections(): Promise<SunnahCollection[]> {
    this.logger.log("Fetching hadith collections from Sunnah.com");

    if (!this.apiKey) {
      this.logger.log("Using mock data for collections");
      const mockData = this.getMockCollections();
      this.logger.log(`Mock data: ${JSON.stringify(mockData)}`);
      return mockData;
    }

    const response = await this.makeRequest<{ data: SunnahCollection[] }>(
      `${this.baseUrl}/collections`,
    );

    this.logger.log(`Fetched ${response.data.length} collections`);
    return response.data;
  }

  async getBooks(collectionName: string): Promise<SunnahBook[]> {
    this.logger.log(`Fetching books for collection: ${collectionName}`);

    if (!this.apiKey) {
      this.logger.log("Using mock data for books");
      return this.getMockBooks(collectionName);
    }

    const response = await this.makeRequest<SunnahBooksResponse>(
      `${this.baseUrl}/collections/${collectionName}/books`,
    );

    this.logger.log(`Raw response: ${JSON.stringify(response)}`);
    this.logger.log(`Response data: ${JSON.stringify(response.data)}`);
    this.logger.log(
      `Fetched ${response.data?.length || 0} books for collection ${collectionName}`,
    );
    return response.data || [];
  }

  async getHadiths(
    collectionName: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<SunnahApiResponse<SunnahHadith[]>> {
    this.logger.log(
      `Fetching hadiths for collection: ${collectionName}, page: ${page}, limit: ${limit}`,
    );

    if (!this.apiKey) {
      this.logger.log("Using mock data for hadiths");
      return this.getMockHadiths(collectionName);
    }

    const response = await this.makeRequest<SunnahApiResponse<SunnahHadith[]>>(
      `${this.baseUrl}/collections/${collectionName}/hadiths?page=${page}&limit=${limit}`,
    );

    this.logger.log(
      `Fetched ${response.data.length} hadiths for collection ${collectionName}`,
    );
    return response;
  }

  async getHadithsByBook(
    collectionName: string,
    bookNumber: number,
    page: number = 1,
    limit: number = 50,
  ): Promise<SunnahApiResponse<SunnahHadith[]>> {
    this.logger.log(
      `Fetching hadiths for collection: ${collectionName}, book: ${bookNumber}, page: ${page}, limit: ${limit}`,
    );

    const response = await this.makeRequest<SunnahApiResponse<SunnahHadith[]>>(
      `${this.baseUrl}/collections/${collectionName}/books/${bookNumber}/hadiths?page=${page}&limit=${limit}`,
    );

    this.logger.log(
      `Fetched ${response.data.length} hadiths for collection ${collectionName}, book ${bookNumber}`,
    );
    return response;
  }

  async getHadithByNumber(
    collectionName: string,
    hadithNumber: number,
  ): Promise<SunnahHadith> {
    this.logger.log(
      `Fetching hadith ${hadithNumber} from collection: ${collectionName}`,
    );

    const response = await this.makeRequest<SunnahHadith>(
      `${this.baseUrl}/collections/${collectionName}/hadiths/${hadithNumber}`,
    );

    this.logger.log(
      `Fetched hadith ${hadithNumber} from collection ${collectionName}`,
    );
    return response;
  }

  async searchHadiths(
    query: string,
    collectionName?: string,
    page: number = 1,
    limit: number = 50,
  ): Promise<SunnahApiResponse<SunnahHadith[]>> {
    this.logger.log(
      `Searching hadiths with query: "${query}"${collectionName ? ` in collection: ${collectionName}` : ""}`,
    );

    let url = `${this.baseUrl}/hadiths/search?q=${encodeURIComponent(query)}&page=${page}&limit=${limit}`;
    if (collectionName) {
      url += `&collection=${collectionName}`;
    }

    const response =
      await this.makeRequest<SunnahApiResponse<SunnahHadith[]>>(url);

    this.logger.log(
      `Found ${response.data.length} hadiths for query: "${query}"`,
    );
    return response;
  }

  async getCollectionInfo(collectionName: string): Promise<SunnahCollection> {
    this.logger.log(`Fetching info for collection: ${collectionName}`);

    const collections = await this.getCollections();
    const collection = collections.find((c) => c.name === collectionName);

    if (!collection) {
      throw new HttpException(
        `Collection ${collectionName} not found`,
        HttpStatus.NOT_FOUND,
      );
    }

    return collection;
  }

  // Mock data methods for testing when API key is not available
  private getMockCollections(): SunnahCollection[] {
    return [
      {
        name: "bukhari",
        hasBooks: true,
        hasChapters: true,
        collection: [
          {
            lang: "en",
            title: "Sahih al-Bukhari",
            shortIntro:
              "Sahih al-Bukhari is a collection of hadith compiled by Imam Muhammad al-Bukhari.",
          },
        ],
        totalHadith: 7563,
        totalAvailableHadith: 7563,
      },
      {
        name: "muslim",
        hasBooks: true,
        hasChapters: true,
        collection: [
          {
            lang: "en",
            title: "Sahih Muslim",
            shortIntro:
              "Sahih Muslim is a collection of hadith compiled by Imam Muslim ibn al-Hajjaj al-Naysaburi.",
          },
        ],
        totalHadith: 3033,
        totalAvailableHadith: 3033,
      },
      {
        name: "tirmidhi",
        hasBooks: true,
        hasChapters: true,
        collection: [
          {
            lang: "en",
            title: "Sunan al-Tirmidhi",
            shortIntro:
              "Sunan al-Tirmidhi is a collection of hadith compiled by Imam al-Tirmidhi.",
          },
        ],
        totalHadith: 3956,
        totalAvailableHadith: 3956,
      },
    ];
  }

  private getMockBooks(collectionName: string): SunnahBook[] {
    const mockBooks: Record<string, SunnahBook[]> = {
      bukhari: [
        {
          bookNumber: "1",
          book: [
            { lang: "en", name: "Revelation" },
            { lang: "ar", name: "كتاب بدء الوحى" },
          ],
          hadithStartNumber: 1,
          hadithEndNumber: 7,
          numberOfHadith: 7,
        },
        {
          bookNumber: "2",
          book: [
            { lang: "en", name: "Faith" },
            { lang: "ar", name: "كتاب الإيمان" },
          ],
          hadithStartNumber: 8,
          hadithEndNumber: 58,
          numberOfHadith: 51,
        },
      ],
      muslim: [
        {
          bookNumber: "1",
          book: [
            { lang: "en", name: "Faith" },
            { lang: "ar", name: "كتاب الإيمان" },
          ],
          hadithStartNumber: 1,
          hadithEndNumber: 73,
          numberOfHadith: 73,
        },
      ],
    };

    return mockBooks[collectionName] || [];
  }

  private getMockHadiths(
    collectionName: string,
  ): SunnahApiResponse<SunnahHadith[]> {
    void collectionName;
    return {
      data: [
        {
          hadithNumber: 1,
          englishNarrator: "Narrated by Al-Bara",
          hadithEnglish:
            'The Prophet (peace be upon him) said: "Actions are according to intentions, and every person will get the reward according to what he has intended."',
          hadithUrdu: "",
          hadithArabic:
            'قال النبي صلى الله عليه وسلم: "إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى"',
          headingArabic: "",
          headingUrdu: "",
          headingEnglish: "Actions are according to intentions",
          chapterNumber: "1",
          bookSlug: "1",
          volume: "1",
          grades: [{ graded_by: "Al-Bukhari", grade: "Sahih" }],
          reference: { book: 1, hadith: 1 },
        },
        {
          hadithNumber: 2,
          englishNarrator: "Narrated by Umar",
          hadithEnglish:
            'I heard Allah\'s Messenger (peace be upon him) saying: "The reward of deeds depends upon the intentions and every person will get the reward according to what he has intended."',
          hadithUrdu: "",
          hadithArabic:
            'سمعت رسول الله صلى الله عليه وسلم يقول: "إنما الأعمال بالنيات، وإنما لكل امرئ ما نوى"',
          headingArabic: "",
          headingUrdu: "",
          headingEnglish: "Reward depends on intention",
          chapterNumber: "1",
          bookSlug: "1",
          volume: "1",
          grades: [{ graded_by: "Al-Bukhari", grade: "Sahih" }],
          reference: { book: 1, hadith: 2 },
        },
      ],
      pagination: {
        currentPage: 1,
        totalPages: 1,
        totalRecords: 2,
        perPage: 50,
      },
    };
  }
}
