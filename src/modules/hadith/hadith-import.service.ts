import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as zlib from "zlib";
// Note: streaming pipeline not used in current implementation

export interface HadithImportResult {
  totalRecords: number;
  importedRecords: number;
  skippedRecords: number;
  errors: string[];
  collections: string[];
  books: { [collection: string]: number };
}

@Injectable()
export class HadithImportService {
  private readonly logger = new Logger(HadithImportService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Import hadith data from the SQL dump file
   */
  async importFromSqlDump(dumpFilePath: string): Promise<HadithImportResult> {
    this.logger.log(`Starting import from SQL dump: ${dumpFilePath}`);

    const result: HadithImportResult = {
      totalRecords: 0,
      importedRecords: 0,
      skippedRecords: 0,
      errors: [],
      collections: [],
      books: {},
    };

    try {
      // Check if file exists
      if (!fs.existsSync(dumpFilePath)) {
        throw new Error(`SQL dump file not found: ${dumpFilePath}`);
      }

      // Read and parse the SQL dump
      const sqlContent = await this.readSqlDump(dumpFilePath);
      const hadithRecords = this.parseSqlDump(sqlContent);

      result.totalRecords = hadithRecords.length;
      this.logger.log(`Found ${result.totalRecords} hadith records in dump`);

      // Group by collection for processing
      const collectionsMap = new Map<string, any[]>();
      for (const record of hadithRecords) {
        const collection = record.collection;
        if (!collectionsMap.has(collection)) {
          collectionsMap.set(collection, []);
        }
        collectionsMap.get(collection)!.push(record);
      }

      result.collections = Array.from(collectionsMap.keys());
      this.logger.log(`Found collections: ${result.collections.join(", ")}`);

      // Process each collection
      for (const [collectionName, records] of collectionsMap) {
        try {
          await this.processCollection(collectionName, records, result);
        } catch (error) {
          this.logger.error(
            `Error processing collection ${collectionName}:`,
            error,
          );
          result.errors.push(`Collection ${collectionName}: ${error.message}`);
        }
      }

      this.logger.log(
        `Import completed. Imported: ${result.importedRecords}, Skipped: ${result.skippedRecords}, Errors: ${result.errors.length}`,
      );
      return result;
    } catch (error) {
      this.logger.error("Import failed:", error);
      result.errors.push(`Import failed: ${error.message}`);
      return result;
    }
  }

  /**
   * Read and decompress the SQL dump file
   */
  private async readSqlDump(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      const readStream = fs.createReadStream(filePath);
      const gunzip = zlib.createGunzip();

      gunzip.on("data", (chunk) => chunks.push(chunk));
      gunzip.on("end", () => {
        const content = Buffer.concat(chunks).toString("utf8");
        resolve(content);
      });
      gunzip.on("error", reject);

      readStream.pipe(gunzip);
    });
  }

  /**
   * Parse SQL dump content and extract INSERT statements
   */
  private parseSqlDump(sqlContent: string): any[] {
    const records: any[] = [];

    // Match INSERT INTO HadithTable ... VALUES (...),(...),...;
    const insertRegex =
      /INSERT\s+INTO\s+`?HadithTable`?\s*(?:\([^;]*?\))?\s*VALUES\s*(.+?);/gis;
    let match: RegExpExecArray | null;

    while ((match = insertRegex.exec(sqlContent)) !== null) {
      try {
        const valuesSection = match[1];
        const tuples = this.splitSqlTuples(valuesSection);
        for (const tuple of tuples) {
          const cleaned = tuple.replace(/^\(/, "").replace(/\)$/, "");
          const record = this.parseInsertValues(cleaned);
          if (record) {
            records.push(record);
          }
        }
      } catch (error) {
        this.logger.warn(`Failed to parse INSERT statement: ${error.message}`);
      }
    }

    return records;
  }

  /**
   * Split VALUES section into individual tuples (...),(...)
   */
  private splitSqlTuples(valuesSection: string): string[] {
    const tuples: string[] = [];
    let current = "";
    let depth = 0;
    let inQuotes = false;
    let quoteChar = "";

    for (let i = 0; i < valuesSection.length; i++) {
      const char = valuesSection[i];
      const nextChar = valuesSection[i + 1];
      current += char;

      if (inQuotes) {
        if (char === quoteChar) {
          if (nextChar === quoteChar) {
            // Escaped quote, consume next char
            current += nextChar;
            i++;
          } else {
            inQuotes = false;
            quoteChar = "";
          }
        }
        continue;
      }

      if (char === "'" || char === '"') {
        inQuotes = true;
        quoteChar = char;
        continue;
      }

      if (char === "(") {
        depth++;
      } else if (char === ")") {
        depth--;
        if (depth === 0) {
          // End of tuple
          tuples.push(current.trim());
          current = "";
          // Skip optional comma and whitespace
          while (
            i + 1 < valuesSection.length &&
            /[\s,]/.test(valuesSection[i + 1])
          ) {
            i++;
          }
        }
      }
    }

    if (current.trim()) {
      tuples.push(current.trim());
    }

    return tuples;
  }

  /**
   * Parse individual INSERT VALUES string
   */
  private parseInsertValues(valuesString: string): any | null {
    try {
      // Split by comma, but handle quoted strings properly
      const values = this.splitSqlValues(valuesString);

      if (values.length < 20) {
        this.logger.warn(`Insufficient values in record: ${values.length}`);
        return null;
      }

      return {
        collection: this.cleanValue(values[0]),
        bookNumber: this.cleanValue(values[1]),
        babID: parseFloat(values[2]) || 0,
        englishBabNumber: this.cleanValue(values[3]),
        arabicBabNumber: this.cleanValue(values[4]),
        hadithNumber: this.cleanValue(values[5]),
        ourHadithNumber: parseInt(values[6]) || 0,
        arabicURN: parseInt(values[7]) || 0,
        arabicBabName: this.cleanValue(values[8]),
        arabicText: this.cleanValue(values[9]),
        arabicgrade1: this.cleanValue(values[10]),
        englishURN: parseInt(values[11]) || 0,
        englishBabName: this.cleanValue(values[12]),
        englishText: this.cleanValue(values[13]),
        englishgrade1: this.cleanValue(values[14]),
        last_updated:
          values[15] && values[15] !== "NULL" ? new Date(values[15]) : null,
        xrefs: this.cleanValue(values[16]),
      };
    } catch (error) {
      this.logger.warn(`Failed to parse values: ${error.message}`);
      return null;
    }
  }

  /**
   * Split SQL VALUES string handling quoted strings
   */
  private splitSqlValues(valuesString: string): string[] {
    const values: string[] = [];
    let current = "";
    let inQuotes = false;
    let quoteChar = "";
    let i = 0;

    while (i < valuesString.length) {
      const char = valuesString[i];
      const nextChar = valuesString[i + 1];

      if (!inQuotes) {
        if (char === "'" || char === '"') {
          inQuotes = true;
          quoteChar = char;
          current += char;
        } else if (char === ",") {
          values.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      } else {
        current += char;
        if (char === quoteChar && nextChar !== quoteChar) {
          inQuotes = false;
          quoteChar = "";
        } else if (char === quoteChar && nextChar === quoteChar) {
          // Escaped quote
          i++; // Skip next quote
          current += nextChar;
        }
      }
      i++;
    }

    if (current.trim()) {
      values.push(current.trim());
    }

    return values;
  }

  /**
   * Clean and unescape SQL values
   */
  private cleanValue(value: string): string {
    if (!value || value === "NULL") {
      return "";
    }

    // Remove surrounding quotes
    value = value.replace(/^['"]|['"]$/g, "");

    // Unescape common SQL escape sequences
    value = value.replace(/\\'/g, "'");
    value = value.replace(/\\"/g, '"');
    value = value.replace(/\\\\/g, "\\");
    value = value.replace(/\\n/g, "\n");
    value = value.replace(/\\r/g, "\r");
    value = value.replace(/\\t/g, "\t");

    return value;
  }

  /**
   * Process a collection and its hadiths
   */
  private async processCollection(
    collectionName: string,
    records: any[],
    result: HadithImportResult,
  ): Promise<void> {
    this.logger.log(
      `Processing collection: ${collectionName} with ${records.length} records`,
    );

    // Create or update collection
    const collection = await this.prisma.hadithCollection.upsert({
      where: { name: collectionName },
      update: {
        titleEn: this.getCollectionTitle(collectionName),
        totalHadith: records.length,
        hasBooks: true,
        lastSyncedAt: new Date(),
        syncStatus: "completed",
      },
      create: {
        name: collectionName,
        titleEn: this.getCollectionTitle(collectionName),
        totalHadith: records.length,
        hasBooks: true,
        lastSyncedAt: new Date(),
        syncStatus: "completed",
      },
    });

    // Group records by book
    const booksMap = new Map<string, any[]>();
    for (const record of records) {
      const bookNumber = record.bookNumber;
      if (!booksMap.has(bookNumber)) {
        booksMap.set(bookNumber, []);
      }
      booksMap.get(bookNumber)!.push(record);
    }

    result.books[collectionName] = booksMap.size;

    // Process each book
    for (const [bookNumber, bookRecords] of booksMap) {
      try {
        await this.processBook(collection.id, bookNumber, bookRecords, result);
      } catch (error) {
        this.logger.error(`Error processing book ${bookNumber}:`, error);
        result.errors.push(`Book ${bookNumber}: ${error.message}`);
      }
    }
  }

  /**
   * Process a book and its hadiths
   */
  private async processBook(
    collectionId: number,
    bookNumber: string,
    records: any[],
    result: HadithImportResult,
  ): Promise<void> {
    // Get book title from first record
    const firstRecord = records[0];
    const bookTitleEn = firstRecord.englishBabName || `Book ${bookNumber}`;
    const bookTitleAr = firstRecord.arabicBabName || "";

    // Create or update book
    const book = await this.prisma.hadithBook.upsert({
      where: {
        collectionId_number: {
          collectionId,
          number: parseInt(bookNumber) || 0,
        },
      },
      update: {
        titleEn: bookTitleEn,
        titleAr: bookTitleAr,
        totalHadith: records.length,
        lastSyncedAt: new Date(),
      },
      create: {
        collectionId,
        number: parseInt(bookNumber) || 0,
        titleEn: bookTitleEn,
        titleAr: bookTitleAr,
        totalHadith: records.length,
        lastSyncedAt: new Date(),
      },
    });

    // Process hadiths in batches
    const batchSize = 100;
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      await this.processHadithBatch(book.id, batch, result);
    }
  }

  /**
   * Process a batch of hadiths
   */
  private async processHadithBatch(
    bookId: number,
    records: any[],
    result: HadithImportResult,
  ): Promise<void> {
    for (const record of records) {
      try {
        await this.processHadith(bookId, record, result);
      } catch (error) {
        this.logger.warn(
          `Error processing hadith ${record.hadithNumber}: ${error.message}`,
        );
        result.errors.push(`Hadith ${record.hadithNumber}: ${error.message}`);
      }
    }
  }

  /**
   * Process individual hadith
   */
  private async processHadith(
    bookId: number,
    record: any,
    result: HadithImportResult,
  ): Promise<void> {
    // Get the book to find collectionId
    const book = await this.prisma.hadithBook.findUnique({
      where: { id: bookId },
      select: { collectionId: true },
    });

    if (!book) {
      throw new Error(`Book with id ${bookId} not found`);
    }
    // Check if hadith already exists
    const existingHadith = await this.prisma.hadith.findFirst({
      where: {
        OR: [
          {
            AND: [{ bookId }, { hadithNumber: record.hadithNumber }],
          },
        ],
      },
    });

    if (existingHadith) {
      result.skippedRecords++;
      return;
    }

    // Create new hadith
    await this.prisma.hadith.create({
      data: {
        collectionId: book.collectionId,
        bookId,
        hadithNumber: record.hadithNumber,
        textAr: record.arabicText,
        textEn: record.englishText,
        grades: {
          arabic: record.arabicgrade1,
          english: record.englishgrade1,
        },
        refs: {
          arabicURN: record.arabicURN,
          englishURN: record.englishURN,
          babID: record.babID,
          arabicBabNumber: record.arabicBabNumber,
          englishBabNumber: record.englishBabNumber,
          arabicBabName: record.arabicBabName,
          englishBabName: record.englishBabName,
          xrefs: record.xrefs,
        },
        lastUpdatedAt: record.last_updated || new Date(),
      },
    });

    result.importedRecords++;
  }

  /**
   * Get collection title in English
   */
  private getCollectionTitle(collectionName: string): string {
    const titles: { [key: string]: string } = {
      bukhari: "Sahih al-Bukhari",
      muslim: "Sahih Muslim",
      abudawud: "Sunan Abu Dawood",
      tirmidhi: "Jami at-Tirmidhi",
      nasai: "Sunan an-Nasa'i",
      ibnmajah: "Sunan Ibn Majah",
      malik: "Muwatta Malik",
      ahmad: "Musnad Ahmad",
    };

    return titles[collectionName] || collectionName;
  }

  /**
   * Get import statistics
   */
  async getImportStats(): Promise<any> {
    const collections = await this.prisma.hadithCollection.count();
    const books = await this.prisma.hadithBook.count();
    const hadiths = await this.prisma.hadith.count();

    return {
      collections,
      books,
      hadiths,
      lastImport: new Date(),
    };
  }
}
