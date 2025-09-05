import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../redis/redis.module';
import { UtilsModule } from '../utils/utils.module';
import { AudioController } from './audio.controller';
import { RecitationsController } from './recitations.controller';
import { AudioService } from './audio.service';
import { AudioSyncService } from './audio.sync.service';
import { AudioSeedService } from './audio.seed.service';
import { ReciterManagerService } from './reciter-manager.service';

@Module({
  imports: [HttpModule, DatabaseModule, RedisModule, UtilsModule],
  controllers: [AudioController, RecitationsController],
  providers: [AudioService, AudioSyncService, AudioSeedService, ReciterManagerService],
  exports: [AudioService, AudioSyncService, AudioSeedService, ReciterManagerService],
})
export class AudioModule {}
