import { Controller, Get, Post, Body, Query } from "@nestjs/common";
import { ZakatService } from "./zakat.service";
import { ApiTags, ApiOperation, ApiQuery, ApiResponse } from "@nestjs/swagger";

export class CalculateZakatDto {
  gold: number = 0;
  silver: number = 0;
  cash: number = 0;
  investments: number = 0;
  other: number = 0;
  currency: string = "USD";
}

@ApiTags("Zakat v4")
@Controller({ path: "zakat", version: "4" })
export class ZakatController {
  constructor(private readonly zakatService: ZakatService) {}

  @Get("nisab")
  @ApiOperation({
    summary: "Get Nisab values",
    description: "Returns Nisab thresholds based on gold/silver prices",
  })
  @ApiQuery({
    name: "currency",
    required: false,
    schema: { type: "string", default: "USD" },
  })
  @ApiResponse({ status: 200, description: "Success" })
  async getNisabValues(@Query("currency") currency: string = "USD") {
    const nisabValues = await this.zakatService.getNisabValues(currency);

    return {
      success: true,
      data: { nisabValues },
      meta: {
        currency,
        cacheTtl: "1 hour",
        source: "Islamic calculation based on current gold prices",
      },
    };
  }

  @Post("calculate")
  @ApiOperation({ summary: "Calculate Zakat" })
  @ApiResponse({ status: 200, description: "Success" })
  async calculateZakat(@Body() dto: CalculateZakatDto) {
    try {
      const calculation = await this.zakatService.calculateZakat(
        dto.gold,
        dto.silver,
        dto.cash,
        dto.investments,
        dto.other,
        dto.currency,
      );

      // Save calculation for history
      await this.zakatService.saveZakatCalculation(calculation);

      return {
        success: true,
        data: {
          calculation: {
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
          }
        },
        meta: {
          calculationDate: calculation.calculationDate,
          nisabThreshold: calculation.nisabThreshold,
          zakatRate: "2.5%",
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        message: "Failed to calculate zakat",
      };
    }
  }

  @Get("gold-price")
  @ApiOperation({ summary: "Get current gold price" })
  @ApiQuery({
    name: "currency",
    required: false,
    schema: { type: "string", default: "USD" },
  })
  @ApiResponse({ status: 200, description: "Success" })
  async getGoldPrice(@Query("currency") currency: string = "USD") {
    const goldPrice = await this.zakatService.getGoldPrice(currency);

    return {
      success: true,
      data: { goldPrice },
      meta: {
        currency,
        cacheTtl: "30 minutes",
        source: goldPrice.source,
        note: "Prices are updated every 30 minutes",
      },
    };
  }

  @Get("currencies")
  @ApiOperation({ summary: "List supported currencies" })
  @ApiResponse({ status: 200, description: "Success" })
  async getSupportedCurrencies() {
    const currencies = await this.zakatService.getSupportedCurrencies();

    return {
      success: true,
      data: { currencies },
      meta: {
        totalCurrencies: currencies.length,
        cacheTtl: "24 hours",
        note: "Supported currencies for zakat calculations",
      },
    };
  }

  @Get("history")
  @ApiOperation({ summary: "Get zakat calculation history" })
  @ApiQuery({
    name: "userId",
    required: false,
    description: "Filter by user ID",
  })
  @ApiResponse({ status: 200, description: "Success" })
  async getZakatHistory(@Query("userId") userId?: string) {
    const history = await this.zakatService.getZakatHistory(userId);

    return {
      success: true,
      data: { history },
      meta: {
        totalCalculations: history.length,
        note: "Zakat calculation history (feature in development)",
      },
    };
  }
}
