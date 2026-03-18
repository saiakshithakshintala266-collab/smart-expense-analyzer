import { Module } from "@nestjs/common";
//import { HealthController } from "../routes/health.controller";
import { UploadsController } from "../routes/uploads.controller";
import { UploadsService } from "../domain/uploads.service";
import { HealthController } from "../routes/health.controller";

@Module({
  controllers: [HealthController, UploadsController],
  providers: [UploadsService]
})
export class AppModule {}
