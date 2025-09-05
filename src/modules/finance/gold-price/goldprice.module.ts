import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from '../../../database/database.module';
import { GoldPriceService } from './goldprice.service';
import { GoldPriceController } from './goldprice.controller';
import { GoldPriceScheduler } from './goldprice.scheduler';

@Module({
  imports: [DatabaseModule, ScheduleModule],
  providers: [GoldPriceService, GoldPriceScheduler],
  controllers: [GoldPriceController],
})
export class GoldPriceModule {}


