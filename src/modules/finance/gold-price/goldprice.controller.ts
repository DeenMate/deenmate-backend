import { Controller, Get, Query, Post, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GoldPriceService } from './goldprice.service';
import { AdminApiKeyGuard } from '../../../common/guards/admin-api-key.guard';
import { convertPriceBetweenUnits } from './goldprice.utils';

@ApiTags('Finance v4')
@Controller({ path: 'finance/gold-prices', version: '4' })
export class GoldPriceController {
  constructor(private readonly service: GoldPriceService) {}

  @Get('finance/gold-prices/latest')
  @ApiOperation({ summary: 'Latest gold and silver prices (Bangladesh)' })
  @ApiQuery({ name: 'unit', required: false, description: 'Preferred unit: Gram or Vori' })
  @ApiResponse({ status: 200, description: 'Success' })
  async getLatest(@Query('unit') preferredUnit?: string) {
    const data = await this.service.getLatest();
    if (!preferredUnit) return data;
    return data.map((row) => ({
      ...row,
      unit: preferredUnit,
      price: convertPriceBetweenUnits(row.price, row.unit, preferredUnit),
    }));
  }

  @Get('finance/gold-prices/history')
  @ApiOperation({ summary: 'Historical gold and silver prices (Bangladesh)' })
  @ApiQuery({ name: 'from', required: false, description: 'ISO date (inclusive)' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO date (inclusive)' })
  @ApiQuery({ name: 'metal', required: false, description: 'Gold or Silver' })
  @ApiQuery({ name: 'category', required: false, description: '22K, 21K, 18K, Traditional, etc.' })
  @ApiQuery({ name: 'unit', required: false, description: 'Stored unit filter: Vori or Gram' })
  @ApiQuery({ name: 'preferredUnit', required: false, description: 'Convert results to this unit: Gram or Vori' })
  @ApiResponse({ status: 200, description: 'Success' })
  async getHistory(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('metal') metal?: string,
    @Query('category') category?: string,
    @Query('unit') unit?: string,
    @Query('preferredUnit') preferredUnit?: string,
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
      price: convertPriceBetweenUnits(Number(row.price), row.unit, preferredUnit),
    }));
  }

  @Post('admin/sync/gold-prices')
  @UseGuards(AdminApiKeyGuard)
  @ApiOperation({ summary: 'Manually trigger gold/silver price scraping (Admin)' })
  @ApiResponse({ status: 201, description: 'Triggered' })
  async triggerManual() {
    return this.service.fetchAndStore(new Date());
  }
}


