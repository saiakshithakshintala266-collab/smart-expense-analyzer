// File: services/transactions-service/src/module/app.module.ts
import { Module } from "@nestjs/common";
import { HealthController } from "../routes/health.controller";
import { TransactionsController } from "../routes/transactions.controller";
import { TransactionsService } from "../domain/transactions.service";
import { SqsConsumerService } from "../queue/sqs.consumer";

@Module({
  controllers: [HealthController, TransactionsController],
  providers: [TransactionsService, SqsConsumerService]
})
export class AppModule {}