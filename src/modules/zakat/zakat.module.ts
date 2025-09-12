import { Module } from "@nestjs/common";
import { DatabaseModule } from "../../database/database.module";
import { RedisModule } from "../../redis/redis.module";
import { FinanceModule } from "../finance/finance.module";
import { ZakatController } from "./zakat.controller";
import { ZakatService } from "./zakat.service";

@Module({
  imports: [DatabaseModule, RedisModule, FinanceModule],
  controllers: [ZakatController],
  providers: [ZakatService],
  exports: [ZakatService],
})
export class ZakatModule {}
