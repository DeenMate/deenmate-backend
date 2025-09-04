import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    HttpModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        timeout: parseInt(configService.get('HTTP_TIMEOUT_MS') || '15000', 10),
        maxRedirects: 5,
        headers: {
          'User-Agent': 'DeenMate-Sync/1.0.0',
        },
      }),
      inject: [ConfigService],
    }),
  ],
  exports: [HttpModule],
})
export class AxiosCommonModule {}
