import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { GoldPriceService } from "./goldprice.service";

// Run daily at 10:00 AM Asia/Dhaka (BDT). The underlying server timezone may differ;
// ensure server timezone or use a time library for TZ. Here we run at 04:00 UTC which is 10:00 BDT (UTC+6) without DST.
const CRON_EXPRESSION_UTC = "0 4 * * *";

@Injectable()
export class GoldPriceScheduler {
  private readonly logger = new Logger(GoldPriceScheduler.name);
  constructor(private readonly service: GoldPriceService) {}

  @Cron(CRON_EXPRESSION_UTC)
  async handleDailyScrape() {
    this.logger.log("Starting daily gold/silver price scraping job");
    await this.service.fetchAndStore(new Date());
  }
}
