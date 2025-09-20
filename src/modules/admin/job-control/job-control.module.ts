import { Module } from '@nestjs/common';
import { JobControlController } from './job-control.controller';
import { JobControlService } from './job-control.service';
import { JobControlGateway } from './job-control.gateway';
import { DatabaseModule } from '../../../database/database.module';
import { WorkerModule } from '../../../workers/worker.module';

@Module({
  imports: [DatabaseModule, WorkerModule],
  controllers: [JobControlController],
  providers: [JobControlService, JobControlGateway],
  exports: [JobControlService, JobControlGateway],
})
export class JobControlModule {}
