// File: services/categorization-service/src/routes/health.controller.ts
import { Controller, Get } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

@ApiTags("Health")
@Controller("/health")
export class HealthController {
  @Get()
  health() {
    return { status: "ok", service: "categorization-service", ts: new Date().toISOString() };
  }
}