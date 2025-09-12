import { Module } from "@nestjs/common";
import { ScheduleModule } from "@nestjs/schedule";
import { DatabaseModule } from "../../database/database.module";
import { AdminAuthModule } from "../admin/auth/admin-auth.module";
import { GoldPriceService } from "./goldprice.service";
import { GoldPriceController } from "./goldprice.controller";
import { GoldPriceScheduler } from "./goldprice.scheduler";

@Module({
  imports: [DatabaseModule, ScheduleModule, AdminAuthModule],
  providers: [GoldPriceService, GoldPriceScheduler],
  controllers: [GoldPriceController],
  exports: [GoldPriceService, GoldPriceScheduler],
})
export class FinanceModule {}
