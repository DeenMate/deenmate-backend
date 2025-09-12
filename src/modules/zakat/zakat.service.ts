import { Injectable, Logger } from "@nestjs/common";
import { PrismaService } from "../../database/prisma.service";
import { RedisService } from "../../redis/redis.service";
import { GoldPriceService } from "../finance/goldprice.service";

export interface NisabValues {
  gold: number;
  silver: number;
  currency: string;
  lastUpdated: string;
}

export interface ZakatCalculation {
  gold: number;
  silver: number;
  cash: number;
  investments: number;
  other: number;
  currency: string;
  totalAssets: number;
  nisabThreshold: number;
  zakatAmount: number;
  isZakatable: boolean;
  calculationDate: Date;
  goldPrice?: number;
  silverPrice?: number;
}

export interface GoldPrice {
  price: number;
  currency: string;
  lastUpdated: string;
  source: string;
}

@Injectable()
export class ZakatService {
  private readonly logger = new Logger(ZakatService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
    private goldPriceService: GoldPriceService,
  ) {}

  async getNisabValues(currency: string = "USD"): Promise<NisabValues> {
    const cacheKey = `zakat:nisab:${currency}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // Get current gold price
    const goldPrice = await this.getGoldPrice(currency);

    // Calculate nisab values (based on Islamic law)
    // Gold nisab: 87.48 grams
    // Silver nisab: 612.36 grams
    const goldNisab = (87.48 * goldPrice.price) / 31.1; // Convert to troy ounces
    const silverNisab = 612.36 * goldPrice.price * 0.012; // Silver is roughly 1.2% of gold price

    const nisabValues: NisabValues = {
      gold: Math.round(goldNisab * 100) / 100,
      silver: Math.round(silverNisab * 100) / 100,
      currency,
      lastUpdated: new Date().toISOString(),
    };

    // Cache for 1 hour (gold prices change frequently)
    await this.redis.set(cacheKey, JSON.stringify(nisabValues), 3600);

    return nisabValues;
  }

  async calculateZakat(
    gold: number = 0,
    silver: number = 0,
    cash: number = 0,
    investments: number = 0,
    other: number = 0,
    currency: string = "USD",
  ): Promise<ZakatCalculation> {
    try {
      const totalAssets = gold + silver + cash + investments + other;
      const nisabValues = await this.getNisabValues(currency);

      // Use the lower of gold or silver nisab as threshold
      const nisabThreshold = Math.min(nisabValues.gold, nisabValues.silver);

      let zakatAmount = 0;
      const isZakatable = totalAssets >= nisabThreshold;

      if (isZakatable) {
        zakatAmount = (totalAssets * 2.5) / 100; // 2.5% zakat rate
      }

      const calculation: ZakatCalculation = {
        gold: Math.round(gold * 100) / 100,
        silver: Math.round(silver * 100) / 100,
        cash: Math.round(cash * 100) / 100,
        investments: Math.round(investments * 100) / 100,
        other: Math.round(other * 100) / 100,
        currency,
        totalAssets: Math.round(totalAssets * 100) / 100,
        nisabThreshold: Math.round(nisabThreshold * 100) / 100,
        zakatAmount: Math.round(zakatAmount * 100) / 100,
        isZakatable,
        calculationDate: new Date(),
        goldPrice: nisabValues.gold,
        silverPrice: nisabValues.silver,
      };

      return calculation;
    } catch (error) {
      this.logger.error(`Failed to calculate zakat: ${error.message}`);
      throw new Error(`Failed to calculate zakat: ${error.message}`);
    }
  }

  async getGoldPrice(currency: string = "USD"): Promise<GoldPrice> {
    const cacheKey = `zakat:gold:${currency}`;

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    try {
      // Get latest gold prices from Finance module
      const latestPrices = await this.goldPriceService.getLatest();
      
      // Find 22K gold price in grams (most common for zakat calculation)
      const gold22K = latestPrices.find(
        price => price.metal === 'Gold' && 
                 price.category === '22K' && 
                 price.unit === 'Gram'
      );

      if (!gold22K) {
        throw new Error('22K gold price not found in latest prices');
      }

      const goldPrice: GoldPrice = {
        price: gold22K.price,
        currency: gold22K.currency,
        lastUpdated: gold22K.fetchedAt.toISOString(),
        source: gold22K.source,
      };

      // Cache for 1 hour
      await this.redis.set(cacheKey, JSON.stringify(goldPrice), 3600);

      return goldPrice;
    } catch (error) {
      this.logger.error(`Failed to get gold price: ${error.message}`);
      throw new Error(`Failed to get gold price: ${error.message}`);
    }
  }

  async getSupportedCurrencies(): Promise<string[]> {
    const cacheKey = "zakat:currencies";

    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const currencies = ["USD", "EUR", "GBP", "SAR", "BDT", "AED", "QAR", "KWD"];

    // Cache for 24 hours
    await this.redis.set(cacheKey, JSON.stringify(currencies), 86400);

    return currencies;
  }

  async getZakatHistory(userId?: string): Promise<any[]> {
    void userId;
    // TODO: Implement zakat calculation history
    // This would store previous calculations for users
    return [];
  }

  async saveZakatCalculation(
    calculation: ZakatCalculation,
    userId?: string,
  ): Promise<any> {
    try {
      this.logger.log(`Saving zakat calculation for user: ${userId || 'anonymous'}`);
      
      const savedCalculation = await this.prisma.zakatCalculation.create({
        data: {
          userId: userId || null,
          gold: calculation.gold,
          silver: calculation.silver,
          cash: calculation.cash,
          investments: calculation.investments,
          other: calculation.other,
          currency: calculation.currency,
          totalAssets: calculation.totalAssets,
          nisabThreshold: calculation.nisabThreshold,
          zakatAmount: calculation.zakatAmount,
          isZakatable: calculation.isZakatable,
          calculationDate: calculation.calculationDate,
          goldPrice: calculation.goldPrice,
          silverPrice: calculation.silverPrice,
        },
      });

      this.logger.log(`Zakat calculation saved with ID: ${savedCalculation.id}`);
      return savedCalculation;
    } catch (error) {
      this.logger.error(`Failed to save zakat calculation: ${error.message}`);
      throw new Error(`Failed to save zakat calculation: ${error.message}`);
    }
  }
}
