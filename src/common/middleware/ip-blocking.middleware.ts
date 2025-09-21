import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { IpBlockingService } from '../../modules/admin/api-monitoring/ip-blocking.service';

@Injectable()
export class IpBlockingMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IpBlockingMiddleware.name);

  constructor(private readonly ipBlockingService: IpBlockingService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    try {
      const ip = req.ip || req.connection.remoteAddress || 'unknown';
      
      const isBlocked = await this.ipBlockingService.isIpBlocked(ip);
      
      if (isBlocked) {
        this.logger.warn(`Blocked request from IP ${ip} to ${req.method} ${req.path}`);
        
        res.status(403).json({
          error: 'IP address blocked',
          ip: ip,
          message: 'Your IP address has been blocked from accessing this service',
          timestamp: new Date().toISOString(),
        });
        return;
      }
      
      next();
    } catch (error) {
      this.logger.error('IP blocking middleware error:', error);
      // On error, allow the request to continue
      next();
    }
  }
}