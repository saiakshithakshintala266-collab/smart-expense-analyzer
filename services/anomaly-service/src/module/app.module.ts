// File: services/anomaly-service/src/module/app.module.ts
import { Module } from "@nestjs/common";
import { HealthController } from "../routes/health.controller";
import { AnomalyController } from "../routes/anomaly.controller";
import { AnomalyService } from "../domain/anomaly.service";
import { SqsConsumerService } from "../queue/sqs.consumer";

@Module({
  controllers: [HealthController, AnomalyController],
  providers: [AnomalyService, SqsConsumerService]
})
export class AppModule {}