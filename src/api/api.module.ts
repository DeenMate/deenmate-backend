import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { QuranController } from './quran.controller';
import { PrayerController } from './prayer.controller';
import { QuranService } from '../services/quran.service';
import { PrayerService } from '../services/prayer.service';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    HttpModule,
    ConfigModule,
    RedisModule,
  ],
  controllers: [
    QuranController,
    PrayerController,
  ],
  providers: [
    QuranService,
    PrayerService,
  ],
  exports: [
    QuranService,
    PrayerService,
  ],
})
export class ApiModule {}
