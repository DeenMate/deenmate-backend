import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { PrismaService } from '../../../database/prisma.service';
import { GoldPriceParser } from './goldprice.parser';
import { MetalType, PriceChangeDirection, ParsedPriceItem } from './goldprice.types';
import { detectChangeDirection } from './goldprice.utils';

const SOURCE_URL = 'https://www.bajus.org/gold-price';

@Injectable()
export class GoldPriceService {
  private readonly logger = new Logger(GoldPriceService.name);
  private readonly parser = new GoldPriceParser();

  constructor(private readonly prisma: PrismaService) {}

  // Access Prisma client with flexible typing to accommodate generated models
  private get client(): any {
    return this.prisma as any;
  }

  async fetchAndStore(now: Date = new Date()): Promise<{ inserted: number }> {
    const job = await this.client.syncJobLog.create({
      data: {
        jobName: 'finance-daily',
        resource: 'gold-prices',
        status: 'running',
        startedAt: now,
      },
    });

    const start = Date.now();
    try {
      const response = await axios.get(SOURCE_URL, { timeout: 20000 });
      const html = response.data as string;
      const parsed = this.parser.parse(html);

      const inserted = await this.persistParsedPrices(parsed, now);

      const durationMs = Date.now() - start;
      await this.client.syncJobLog.update({
        where: { id: job.id },
        data: {
          status: 'success',
          finishedAt: new Date(),
          durationMs,
          recordsProcessed: inserted,
          notes: `Fetched from ${SOURCE_URL}`,
        },
      });
      return { inserted };
    } catch (err: any) {
      const durationMs = Date.now() - start;
      await this.client.syncJobLog.update({
        where: { id: job.id },
        data: {
          status: 'failed',
          finishedAt: new Date(),
          durationMs,
          error: err?.message?.toString?.() ?? String(err),
        },
      });
      this.logger.error(`Gold price sync failed: ${err?.message ?? err}`);
      throw err;
    }
  }

  private async persistParsedPrices(items: ParsedPriceItem[], fetchedAt: Date): Promise<number> {
    if (!items.length) return 0;

    let inserted = 0;
    for (const item of items) {
      const previous = await this.client.goldPrice.findFirst({
        where: {
          metal: item.metal,
          category: item.category,
          unit: item.unit,
        },
        orderBy: { fetchedAt: 'desc' },
      });

      const previousPrice = previous ? Number(previous.price) : null;
      const change = detectChangeDirection(previousPrice, item.price);

      await this.client.goldPrice.create({
        data: {
          metal: item.metal,
          category: item.category,
          unit: item.unit,
          price: item.price,
          currency: 'BDT',
          change: change as unknown as string | null,
          source: SOURCE_URL,
          fetchedAt,
        },
      });
      inserted += 1;
    }

    return inserted;
  }

  async getLatest(): Promise<{
    metal: MetalType;
    category: string;
    unit: string;
    price: number;
    currency: string;
    change: PriceChangeDirection | null;
    fetchedAt: Date;
    source: string;
  }[]> {
    // Get latest row per (metal, category, unit) using groupBy + follow-up fetch
    const groups = await this.client.goldPrice.groupBy({
      by: ['metal', 'category', 'unit'],
      _max: { fetchedAt: true },
    });
    const results: {
      metal: MetalType;
      category: string;
      unit: string;
      price: number;
      currency: string;
      change: PriceChangeDirection | null;
      fetchedAt: Date;
      source: string;
    }[] = [];
    for (const g of groups) {
      const row = await this.client.goldPrice.findFirst({
        where: {
          metal: g.metal as any,
          category: g.category as any,
          unit: g.unit as any,
          fetchedAt: g._max.fetchedAt ?? undefined,
        },
        orderBy: { fetchedAt: 'desc' },
      });
      if (row) {
        results.push({
          metal: row.metal as any,
          category: row.category,
          unit: row.unit,
          price: Number(row.price),
          currency: row.currency,
          change: (row.change as any) ?? null,
          fetchedAt: row.fetchedAt,
          source: row.source,
        });
      }
    }
    return results;
  }

  async getHistory(params: { from?: Date; to?: Date; metal?: string; category?: string; unit?: string }) {
    const { from, to, metal, category, unit } = params;
    return this.client.goldPrice.findMany({
      where: {
        fetchedAt: {
          gte: from,
          lte: to,
        },
        metal: metal as any,
        category: category as any,
        unit: unit as any,
      },
      orderBy: { fetchedAt: 'asc' },
    });
  }
}


