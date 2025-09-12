import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { ContentManagementService } from './content-management.service';
import { ContentManagementController } from './content-management.controller';

@Module({
  imports: [DatabaseModule, AdminAuthModule],
  providers: [ContentManagementService],
  controllers: [ContentManagementController],
  exports: [ContentManagementService],
})
export class ContentManagementModule {}
