import { IsString, IsNumber, IsOptional, IsBoolean, Min, Max } from 'class-validator';

export class CreateRateLimitRuleDto {
  @IsString()
  endpoint: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsNumber()
  @Min(1)
  @Max(10000)
  limitCount: number;

  @IsNumber()
  @Min(1)
  @Max(86400) // Max 24 hours
  windowSeconds: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

export class UpdateRateLimitRuleDto {
  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10000)
  limitCount?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(86400) // Max 24 hours
  windowSeconds?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
