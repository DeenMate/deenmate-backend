import { Controller, Get } from "@nestjs/common";
import {
  HealthCheckService,
  HttpHealthIndicator} from "@nestjs/terminus";
import {
  HealthCheck
} from "@nestjs/terminus";
import { RedisService } from "./redis/redis.service";

@Controller({ path: "", version: "4" })
export class AppController {
  constructor(
    private health: HealthCheckService,
    private http: HttpHealthIndicator,
    private redis: RedisService,
  ) {}

  @Get("health")
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.http.pingCheck("nestjs-docs", "https://docs.nestjs.com"),
    ]);
  }

  @Get("ready")
  @HealthCheck()
  ready() {
    return this.health.check([
      async () => {
        const result = await this.redis.ping();
        return {
          redis: {
            status: result === "PONG" ? "up" : "down",
          },
        };
      },
    ]);
  }
}
