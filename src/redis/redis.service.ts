import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private redis: Redis;

  async onModuleInit() {
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    
    // Test connection
    try {
      await this.redis.ping();
      console.log('Redis connected successfully');
    } catch (error) {
      console.error('Redis connection failed:', error);
    }
  }

  async onModuleDestroy() {
    if (this.redis) {
      await this.redis.quit();
    }
  }

  async get(key: string): Promise<string | null> {
    return await this.redis.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<'OK'> {
    if (ttl) {
      return await this.redis.setex(key, ttl, value);
    }
    return await this.redis.set(key, value);
  }

  async del(key: string): Promise<number> {
    return await this.redis.del(key);
  }

  async exists(key: string): Promise<number> {
    return await this.redis.exists(key);
  }

  async ping(): Promise<string> {
    return await this.redis.ping();
  }

  // Invalidate all keys by prefix (use carefully)
  async invalidateByPrefix(prefix: string): Promise<number> {
    let cursor = '0';
    let total = 0;
    do {
      const res = await this.redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 500);
      cursor = res[0];
      const keys: string[] = res[1] as any;
      if (keys.length) { total += await this.redis.del(...keys); }
    } while (cursor !== '0');
    return total;
  }
}
