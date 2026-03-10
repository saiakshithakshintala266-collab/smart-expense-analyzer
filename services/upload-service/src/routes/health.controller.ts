import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  @Get("/health")
  health(): { status: "ok"; service: "upload-service" } {
    return { status: "ok", service: "upload-service" };
  }
}
