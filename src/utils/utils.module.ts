import { Module } from '@nestjs/common';
import { AudioUrlSignerService } from './audio-url-signer.service';

@Module({
  providers: [AudioUrlSignerService],
  exports: [AudioUrlSignerService],
})
export class UtilsModule {}
