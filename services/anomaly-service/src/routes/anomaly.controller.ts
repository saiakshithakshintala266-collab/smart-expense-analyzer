// File: services/anomaly-service/src/routes/anomaly.controller.ts
import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AnomalyService } from "../domain/anomaly.service";

@ApiTags("Anomalies")
@ApiBearerAuth()
@Controller("/workspaces/:workspaceId/anomalies")
export class AnomalyController {
  constructor(private readonly anomalyService: AnomalyService) {}

  @Get()
  @ApiQuery({ name: "status", required: false, enum: ["OPEN", "DISMISSED"] })
  list(
    @Param("workspaceId") workspaceId: string,
    @Query("status") status?: "OPEN" | "DISMISSED"
  ) {
    return this.anomalyService.listAnomalies(workspaceId, status);
  }
}