import { Controller, Get, Query, Post, UseGuards } from "@nestjs/common";
import { ApiOperation, ApiQuery, ApiResponse, ApiTags, ApiBearerAuth } from "@nestjs/swagger";
import { GoldPriceService } from "./goldprice.service";
import { JwtAuthGuard } from "../admin/guards/jwt-auth.guard";
import { convertPriceBetweenUnits } from "./goldprice.utils";

@ApiTags("Finance v4")
@Controller({ path: "finance/gold-prices", version: "4" })
export class GoldPriceController {
  constructor(private readonly service: GoldPriceService) {}

  @Get("latest")
  @ApiOperation({ summary: "Latest gold and silver prices (Bangladesh)" })
  @ApiQuery({
    name: "unit",
    required: false,
    description: "Preferred unit: Gram or Vori",
  })
  @ApiQuery({
    name: "karat",
    required: false,
    description: "Filter by karat (e.g., 22, 21, 18, TRADITIONAL)",
  })
  @ApiResponse({ status: 200, description: "Success" })
  async getLatest(
    @Query("unit") preferredUnit?: string,
    @Query("karat") karat?: string,
  ) {
    let data = await this.service.getLatest();
    if (karat) {
      const k = karat.toString().toUpperCase();
      data = data.filter((row) => row.category.toUpperCase().includes(k));
    }
    if (!preferredUnit) return data;
    return data.map((row) => ({
      ...row,
      unit: preferredUnit,
      price: convertPriceBetweenUnits(row.price, row.unit, preferredUnit),
    }));
  }

  @Get("history")
  @ApiOperation({ summary: "Historical gold and silver prices (Bangladesh)" })
  @ApiQuery({
    name: "from",
    required: false,
    description: "ISO date (inclusive)",
  })
  @ApiQuery({
    name: "to",
    required: false,
    description: "ISO date (inclusive)",
  })
  @ApiQuery({ name: "metal", required: false, description: "Gold or Silver" })
  @ApiQuery({
    name: "category",
    required: false,
    description: "22K, 21K, 18K, TRADITIONAL, etc.",
  })
  @ApiQuery({
    name: "unit",
    required: false,
    description: "Stored unit filter: Vori or Gram",
  })
  @ApiQuery({
    name: "preferredUnit",
    required: false,
    description: "Convert results to this unit: Gram or Vori",
  })
  @ApiResponse({ status: 200, description: "Success" })
  async getHistory(
    @Query("from") from?: string,
    @Query("to") to?: string,
    @Query("metal") metal?: string,
    @Query("category") category?: string,
    @Query("unit") unit?: string,
    @Query("preferredUnit") preferredUnit?: string,
  ) {
    const rows = await this.service.getHistory({
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      metal,
      category,
      unit,
    });
    if (!preferredUnit) return rows;
    return rows.map((row) => ({
      ...row,
      unit: preferredUnit,
      price: convertPriceBetweenUnits(
        Number(row.price),
        row.unit,
        preferredUnit,
      ),
    }));
  }

  @Post("admin/sync/gold-prices")
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: "Manually trigger gold/silver price scraping (Admin)",
  })
  @ApiResponse({ status: 201, description: "Triggered" })
  async triggerManual() {
    return this.service.fetchAndStore(new Date());
  }
}
