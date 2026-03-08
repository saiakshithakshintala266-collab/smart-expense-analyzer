// File: services/chat-service/src/module/app.module.ts
import { Module } from "@nestjs/common";
import { HealthController } from "../routes/health.controller";
import { ChatController } from "../routes/chat.controller";
import { ChatService } from "../domain/chat.service";

@Module({
  controllers: [HealthController, ChatController],
  providers: [ChatService]
})
export class AppModule {}