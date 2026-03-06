// File: services/extraction-service/src/module/app.module.ts
import { Module } from "@nestjs/common";
import { HealthController } from "../routes/health.controller";
import { ExtractionController } from "../routes/extraction.controller";
import { ExtractionService } from "../domain/extraction.service";
import { SqsConsumerService } from "../queue/sqs.consumer";

@Module({
  controllers: [HealthController, ExtractionController],
  providers: [ExtractionService, SqsConsumerService]
})
export class AppModule {}