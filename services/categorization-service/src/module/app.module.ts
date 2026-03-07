// File: services/categorization-service/src/module/app.module.ts
import { Module } from "@nestjs/common";
import { HealthController } from "../routes/health.controller";
import { CategorizationService } from "../domain/categorization.service";
import { SqsConsumerService } from "../queue/sqs.consumer";

@Module({
  controllers: [HealthController],
  providers: [CategorizationService, SqsConsumerService]
})
export class AppModule {}