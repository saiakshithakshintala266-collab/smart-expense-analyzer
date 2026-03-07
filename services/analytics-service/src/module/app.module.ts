// File: services/analytics-service/src/module/app.module.ts
import { Module } from "@nestjs/common";
import { HealthController } from "../routes/health.controller";
import { AnalyticsController } from "../routes/analytics.controller";
import { AnalyticsService } from "../domain/analytics.service";
import { SqsConsumerService } from "../queue/sqs.consumer";

@Module({
  controllers: [HealthController, AnalyticsController],
  providers: [AnalyticsService, SqsConsumerService]
})
export class AppModule {}