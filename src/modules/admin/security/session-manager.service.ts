import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../../../redis/redis.service';
import { PrismaService } from '../../../database/prisma.service';

export interface SessionData {
  userId: number;
  email: string;
  role: string;
  permissions: string[];
  loginTime: number;
  lastActivity: number;
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class SessionManagerService {
  private readonly logger = new Logger(SessionManagerService.name);
  private readonly SESSION_PREFIX = 'admin_session:';
  private readonly USER_SESSIONS_PREFIX = 'user_sessions:';
  private readonly SESSION_TIMEOUT = 24 * 60 * 60; // 24 hours in seconds
  private readonly ACTIVITY_TIMEOUT = 2 * 60 * 60; // 2 hours of inactivity

  constructor(
    private readonly redisService: RedisService,
    private readonly prisma: PrismaService,
  ) {}

  async createSession(
    userId: number,
    ipAddress: string,
    userAgent: string,
  ): Promise<string> {
    try {
      // Get user data
      const user = await this.prisma.adminUser.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          role: true,
          permissions: true,
        },
      });

      if (!user) {
        throw new Error('User not found');
      }

      // Generate session ID
      const sessionId = this.generateSessionId();

      // Create session data
      const sessionData: SessionData = {
        userId: user.id,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        loginTime: Date.now(),
        lastActivity: Date.now(),
        ipAddress,
        userAgent,
      };

      // Store session in Redis
      await this.redisService.setex(
        `${this.SESSION_PREFIX}${sessionId}`,
        this.SESSION_TIMEOUT,
        JSON.stringify(sessionData),
      );

      // Track user sessions
      await this.redisService.sadd(
        `${this.USER_SESSIONS_PREFIX}${userId}`,
        sessionId,
      );

      // Update last login time in database
      await this.prisma.adminUser.update({
        where: { id: userId },
        data: { lastLoginAt: new Date() },
      });

      this.logger.log(`Session created for user ${user.email}: ${sessionId}`);

      return sessionId;
    } catch (error) {
      this.logger.error(`Failed to create session: ${error.message}`);
      throw error;
    }
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const sessionData = await this.redisService.get(`${this.SESSION_PREFIX}${sessionId}`);
      
      if (!sessionData) {
        return null;
      }

      const session = JSON.parse(sessionData) as SessionData;
      
      // Check if session has expired due to inactivity
      const now = Date.now();
      if (now - session.lastActivity > this.ACTIVITY_TIMEOUT * 1000) {
        await this.destroySession(sessionId);
        return null;
      }

      // Update last activity
      session.lastActivity = now;
      await this.redisService.setex(
        `${this.SESSION_PREFIX}${sessionId}`,
        this.SESSION_TIMEOUT,
        JSON.stringify(session),
      );

      return session;
    } catch (error) {
      this.logger.error(`Failed to get session: ${error.message}`);
      return null;
    }
  }

  async destroySession(sessionId: string): Promise<void> {
    try {
      // Get session data to find user ID
      const sessionData = await this.redisService.get(`${this.SESSION_PREFIX}${sessionId}`);
      
      if (sessionData) {
        const session = JSON.parse(sessionData) as SessionData;
        
        // Remove from user sessions set
        await this.redisService.srem(
          `${this.USER_SESSIONS_PREFIX}${session.userId}`,
          sessionId,
        );
      }

      // Remove session
      await this.redisService.del(`${this.SESSION_PREFIX}${sessionId}`);

      this.logger.log(`Session destroyed: ${sessionId}`);
    } catch (error) {
      this.logger.error(`Failed to destroy session: ${error.message}`);
    }
  }

  async destroyAllUserSessions(userId: number): Promise<void> {
    try {
      // Get all sessions for user
      const sessionIds = await this.redisService.smembers(`${this.USER_SESSIONS_PREFIX}${userId}`);
      
      // Destroy each session
      for (const sessionId of sessionIds) {
        await this.destroySession(sessionId);
      }

      // Remove user sessions set
      await this.redisService.del(`${this.USER_SESSIONS_PREFIX}${userId}`);

      this.logger.log(`All sessions destroyed for user ${userId}`);
    } catch (error) {
      this.logger.error(`Failed to destroy all user sessions: ${error.message}`);
    }
  }

  async getUserSessions(userId: number): Promise<SessionData[]> {
    try {
      const sessionIds = await this.redisService.smembers(`${this.USER_SESSIONS_PREFIX}${userId}`);
      const sessions: SessionData[] = [];

      for (const sessionId of sessionIds) {
        const session = await this.getSession(sessionId);
        if (session) {
          sessions.push(session);
        }
      }

      return sessions;
    } catch (error) {
      this.logger.error(`Failed to get user sessions: ${error.message}`);
      return [];
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    try {
      // Get all session keys
      const sessionKeys = await this.redisService.keys(`${this.SESSION_PREFIX}*`);
      let cleanedCount = 0;

      for (const key of sessionKeys) {
        const sessionData = await this.redisService.get(key);
        
        if (sessionData) {
          const session = JSON.parse(sessionData) as SessionData;
          const now = Date.now();
          
          // Check if session has expired
          if (now - session.lastActivity > this.ACTIVITY_TIMEOUT * 1000) {
            const sessionId = key.replace(this.SESSION_PREFIX, '');
            await this.destroySession(sessionId);
            cleanedCount++;
          }
        }
      }

      this.logger.log(`Cleaned up ${cleanedCount} expired sessions`);
      return cleanedCount;
    } catch (error) {
      this.logger.error(`Failed to cleanup expired sessions: ${error.message}`);
      return 0;
    }
  }

  async getActiveSessionsCount(): Promise<number> {
    try {
      const sessionKeys = await this.redisService.keys(`${this.SESSION_PREFIX}*`);
      return sessionKeys.length;
    } catch (error) {
      this.logger.error(`Failed to get active sessions count: ${error.message}`);
      return 0;
    }
  }

  async getSessionStats(): Promise<{
    totalSessions: number;
    uniqueUsers: number;
    averageSessionDuration: number;
  }> {
    try {
      const sessionKeys = await this.redisService.keys(`${this.SESSION_PREFIX}*`);
      const userSessions = await this.redisService.keys(`${this.USER_SESSIONS_PREFIX}*`);
      
      let totalDuration = 0;
      let validSessions = 0;
      const uniqueUsers = new Set<number>();

      for (const key of sessionKeys) {
        const sessionData = await this.redisService.get(key);
        
        if (sessionData) {
          const session = JSON.parse(sessionData) as SessionData;
          uniqueUsers.add(session.userId);
          
          const duration = Date.now() - session.loginTime;
          totalDuration += duration;
          validSessions++;
        }
      }

      return {
        totalSessions: validSessions,
        uniqueUsers: uniqueUsers.size,
        averageSessionDuration: validSessions > 0 ? totalDuration / validSessions : 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get session stats: ${error.message}`);
      return {
        totalSessions: 0,
        uniqueUsers: 0,
        averageSessionDuration: 0,
      };
    }
  }

  private generateSessionId(): string {
    // Generate a secure random session ID
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    
    return result;
  }
}
