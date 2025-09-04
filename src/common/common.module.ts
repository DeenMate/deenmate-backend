import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AxiosCommonModule } from './http/axios.module';
import { CommonHttpService } from './http/http.service';

@Module({
  imports: [
    ConfigModule,
    AxiosCommonModule,
  ],
  providers: [CommonHttpService],
  exports: [
    AxiosCommonModule,
    CommonHttpService,
  ],
})
export class CommonModule {}

// Export utility functions
export * from './utils/hash.util';
export * from './utils/compat.util';
export * from './utils/pagination.util';
export * from './http/http.service';
