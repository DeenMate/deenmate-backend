import { IsString, IsOptional, IsDateString } from 'class-validator';

export class BlockIpDto {
  @IsString()
  ipAddress: string;

  @IsOptional()
  @IsString()
  reason?: string;

  @IsString()
  blockedBy: string;

  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
