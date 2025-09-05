import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { RedisService } from '../redis/redis.service';

export interface NisabValues {
  gold: number;
  silver: number;
  currency: string;
  lastUpdated: string;
}

export interface ZakatCalculation {
  totalWealth: number;
  nisabThreshold: number;
  zakatAmount: number;
  zakatPercentage: number;
  breakdown: {
    gold: number;
    silver: number;
    cash: number;
    investments: number;
    other: number;
  };
  currency: string;
  calculationDate: string;
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
  ) {}

  async getNisabValues(currency: string = 'USD'): Promise<NisabValues> {
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
    const silverNisab = (612.36 * goldPrice.price * 0.012); // Silver is roughly 1.2% of gold price

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
    currency: string = 'USD',
  ): Promise<ZakatCalculation> {
    const totalWealth = gold + silver + cash + investments + other;
    const nisabValues = await this.getNisabValues(currency);
    
    // Use the lower of gold or silver nisab as threshold
    const nisabThreshold = Math.min(nisabValues.gold, nisabValues.silver);
    
    let zakatAmount = 0;
    let zakatPercentage = 0;
    
    if (totalWealth >= nisabThreshold) {
      zakatPercentage = 2.5; // 2.5% zakat rate
      zakatAmount = (totalWealth * zakatPercentage) / 100;
    }

    const calculation: ZakatCalculation = {
      totalWealth: Math.round(totalWealth * 100) / 100,
      nisabThreshold: Math.round(nisabThreshold * 100) / 100,
      zakatAmount: Math.round(zakatAmount * 100) / 100,
      zakatPercentage,
      breakdown: {
        gold: Math.round(gold * 100) / 100,
        silver: Math.round(silver * 100) / 100,
        cash: Math.round(cash * 100) / 100,
        investments: Math.round(investments * 100) / 100,
        other: Math.round(other * 100) / 100,
      },
      currency,
      calculationDate: new Date().toISOString(),
    };

    return calculation;
  }

  async getGoldPrice(currency: string = 'USD'): Promise<GoldPrice> {
    const cacheKey = `zakat:gold:${currency}`;
    
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    // TODO: Implement actual gold price API integration
    throw new Error('Gold price API integration not implemented. Please implement MetalpriceAPI integration.');
  }

  async getSupportedCurrencies(): Promise<string[]> {
    const cacheKey = 'zakat:currencies';
    
    const cached = await this.redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached);
    }

    const currencies = ['USD', 'EUR', 'GBP', 'SAR', 'BDT', 'AED', 'QAR', 'KWD'];
    
    // Cache for 24 hours
    await this.redis.set(cacheKey, JSON.stringify(currencies), 86400);
    
    return currencies;
  }

  async getZakatHistory(userId?: string): Promise<any[]> {
    // TODO: Implement zakat calculation history
    // This would store previous calculations for users
    return [];
  }

  async saveZakatCalculation(calculation: ZakatCalculation, userId?: string): Promise<any> {
    // TODO: Implement saving zakat calculations to database
    throw new Error('Zakat calculation saving not implemented. Please implement database storage for zakat calculations.');
  }
}
