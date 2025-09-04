import { Module } from '@nestjs/common';
import { QuranController } from './quran.controller';
import { QuranService } from './quran.service';
import { QuranSyncService } from './quran.sync.service';
import { QuranMapper } from './quran.mapper';
import { CommonModule } from '../common/common.module';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [CommonModule, DatabaseModule, RedisModule],
  controllers: [QuranController],
  providers: [QuranService, QuranSyncService, QuranMapper],
  exports: [QuranService, QuranSyncService, QuranMapper],
})
export class QuranModule {}
