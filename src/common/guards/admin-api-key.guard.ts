import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const provided = request.headers['x-admin-api-key'] as string | undefined;
    const expected = process.env.ADMIN_API_KEY;
    if (!expected) {
      // If not configured, deny by default
      throw new UnauthorizedException('Admin API key not configured');
    }
    if (!provided || provided !== expected) {
      throw new UnauthorizedException('Invalid admin API key');
    }
    return true;
  }
}


