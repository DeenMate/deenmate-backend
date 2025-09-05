import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { DatabaseModule } from './database/database.module';
import { GoldPriceModule } from '@/modules/finance/gold-price/goldprice.module';
import { RedisModule } from './redis/redis.module';
import { CommonModule } from './common/common.module';
import { QuranModule } from './quran/quran.module';
import { PrayerModule } from './prayer/prayer.module';
import { HadithModule } from './hadith/hadith.module';
import { ZakatModule } from './zakat/zakat.module';
import { AudioModule } from './audio/audio.module';
import { WorkerModule } from './workers/worker.module';
import { SyncModule } from './sync/sync.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ScheduleModule.forRoot(),
    TerminusModule,
    DatabaseModule,
    GoldPriceModule,
    RedisModule,
    CommonModule,
    QuranModule,
    PrayerModule,
    HadithModule,
    ZakatModule,
    AudioModule,
    WorkerModule,
    SyncModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
