import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class AuditLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuditLoggerMiddleware.name);

  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const originalSend = res.send;

    // Capture response data
    res.send = function (body) {
      const duration = Date.now() - startTime;
      
      // Log the request asynchronously (don't block the response)
      setImmediate(async () => {
        try {
          await AuditLoggerMiddleware.prototype.logRequest(req, res, body, duration);
        } catch (error) {
          // Don't let audit logging errors affect the main request
          console.error('Audit logging error:', error);
        }
      });

      return originalSend.call(this, body);
    };

    next();
  }

  private async logRequest(req: Request, res: Response, responseBody: any, duration: number) {
    // Only log admin API requests
    if (!req.path.startsWith('/api/v4/admin/')) {
      return;
    }

    // Skip certain endpoints that are too noisy
    const skipEndpoints = ['/api/v4/admin/health', '/api/v4/admin/summary'];
    if (skipEndpoints.some(endpoint => req.path.startsWith(endpoint))) {
      return;
    }

    try {
      // Extract user info from JWT token if available
      const user = (req as any).user;
      if (!user) {
        return; // Skip if no authenticated user
      }

      // Determine action and resource from the request
      const { action, resource } = this.parseRequest(req);

      // Extract resource ID from URL params or body
      const resourceId = this.extractResourceId(req);

      // Prepare details
      const details = {
        method: req.method,
        url: req.originalUrl,
        statusCode: res.statusCode,
        duration,
        userAgent: req.get('User-Agent'),
        ipAddress: req.ip || req.connection.remoteAddress,
        requestBody: this.sanitizeRequestBody(req.body),
        responseSize: responseBody ? JSON.stringify(responseBody).length : 0,
      };

      // Create audit log entry
      await this.prisma.adminAuditLog.create({
        data: {
          userId: user.id,
          action,
          resource,
          resourceId,
          details,
          ipAddress: details.ipAddress,
          userAgent: details.userAgent,
        },
      });

      this.logger.debug(`Audit logged: ${action} ${resource} by user ${user.email}`);
    } catch (error) {
      this.logger.error(`Failed to create audit log: ${error.message}`);
    }
  }

  private parseRequest(req: Request): { action: string; resource: string } {
    const method = req.method;
    const path = req.path;

    // Determine action
    let action: string;
    switch (method) {
      case 'GET':
        action = 'READ';
        break;
      case 'POST':
        if (path.includes('/login')) {
          action = 'LOGIN';
        } else if (path.includes('/logout')) {
          action = 'LOGOUT';
        } else if (path.includes('/sync')) {
          action = 'SYNC';
        } else if (path.includes('/change-password')) {
          action = 'CHANGE_PASSWORD';
        } else if (path.includes('/reset-password')) {
          action = 'RESET_PASSWORD';
        } else {
          action = 'CREATE';
        }
        break;
      case 'PUT':
      case 'PATCH':
        action = 'UPDATE';
        break;
      case 'DELETE':
        action = 'DELETE';
        break;
      default:
        action = 'UNKNOWN';
    }

    // Determine resource
    let resource: string;
    if (path.includes('/users')) {
      resource = 'user';
    } else if (path.includes('/quran')) {
      resource = 'quran';
    } else if (path.includes('/hadith')) {
      resource = 'hadith';
    } else if (path.includes('/prayer')) {
      resource = 'prayer';
    } else if (path.includes('/finance')) {
      resource = 'finance';
    } else if (path.includes('/audio')) {
      resource = 'audio';
    } else if (path.includes('/zakat')) {
      resource = 'zakat';
    } else if (path.includes('/cache')) {
      resource = 'cache';
    } else if (path.includes('/sync')) {
      resource = 'sync';
    } else {
      resource = 'system';
    }

    return { action, resource };
  }

  private extractResourceId(req: Request): string | undefined {
    // Try to extract ID from URL params
    const urlParams = req.params;
    if (urlParams.id) {
      return urlParams.id;
    }
    if (urlParams.userId) {
      return urlParams.userId;
    }

    // Try to extract ID from request body
    if (req.body && req.body.id) {
      return req.body.id.toString();
    }

    return undefined;
  }

  private sanitizeRequestBody(body: any): any {
    if (!body) return null;

    // Remove sensitive fields
    const sensitiveFields = ['password', 'passwordHash', 'token', 'secret', 'key'];
    const sanitized = { ...body };

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
