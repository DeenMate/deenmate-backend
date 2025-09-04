import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { ZakatController } from './zakat.controller';
import { ZakatService } from './zakat.service';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [ZakatController],
  providers: [ZakatService],
  exports: [ZakatService],
})
export class ZakatModule {}
