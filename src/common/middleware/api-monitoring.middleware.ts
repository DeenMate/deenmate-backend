import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ApiMonitoringService } from '../../modules/admin/api-monitoring/api-monitoring.service';

@Injectable()
export class ApiMonitoringMiddleware implements NestMiddleware {
  private readonly logger = new Logger(ApiMonitoringMiddleware.name);

  constructor(private readonly apiMonitoringService: ApiMonitoringService) {}

  use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const originalSend = res.send;
    const apiMonitoringService = this.apiMonitoringService; // Capture the service reference

    // Override res.send to capture response data
    res.send = function (body: any) {
      const latency = Date.now() - startTime;
      
      // Log the request asynchronously to avoid blocking the response
      setImmediate(async () => {
        try {
          await apiMonitoringService.logRequest({
            endpoint: req.path,
            method: req.method,
            statusCode: res.statusCode,
            latencyMs: latency,
            requestIp: req.ip || req.connection.remoteAddress || 'unknown',
            userAgent: req.get('User-Agent'),
            userId: (req as any).user?.id,
            metadata: {
              query: req.query,
              body: req.method !== 'GET' ? req.body : undefined,
              headers: {
                'content-type': req.get('Content-Type'),
                'accept': req.get('Accept'),
                'authorization': req.get('Authorization') ? '[REDACTED]' : undefined,
              },
            },
          });
        } catch (error) {
          // Log error but don't throw to avoid breaking the request
          console.error('Error logging API request:', error);
        }
      });

      return originalSend.call(this, body);
    };

    next();
  }
}
