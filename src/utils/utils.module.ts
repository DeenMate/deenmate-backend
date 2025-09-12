import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AudioUrlSignerService } from "./audio-url-signer.service";

@Module({
  imports: [ConfigModule],
  providers: [AudioUrlSignerService],
  exports: [AudioUrlSignerService],
})
export class UtilsModule {}
