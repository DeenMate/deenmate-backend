import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../../database/database.module';
import { AdminAuthModule } from '../auth/admin-auth.module';
import { UserManagementService } from './user-management.service';
import { UserManagementController } from './user-management.controller';

@Module({
  imports: [DatabaseModule, AdminAuthModule],
  providers: [UserManagementService],
  controllers: [UserManagementController],
  exports: [UserManagementService],
})
export class UserManagementModule {}
