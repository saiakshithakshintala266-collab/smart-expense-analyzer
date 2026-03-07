// File: services/notification-service/src/module/app.module.ts
import { Module } from "@nestjs/common";
import { HealthController } from "../routes/health.controller";
import { NotificationController } from "../routes/notification.controller";
import { NotificationService } from "../domain/notification.service";
import { SqsConsumerService } from "../queue/sqs.consumer";

@Module({
  controllers: [HealthController, NotificationController],
  providers: [NotificationService, SqsConsumerService]
})
export class AppModule {}