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
  async list(
    @Param("workspaceId") workspaceId: string,
    @Query("status") status?: "OPEN" | "DISMISSED"
  ) {
    const records = await this.anomalyService.listAnomalies(workspaceId, status);
    return records.map((r) => ({
      id:            r.anomalyId,
      workspaceId:   r.workspaceId,
      transactionId: r.transactionId,
      type:          r.anomalyType,
      severity:      r.severity.toLowerCase(),
      description:   r.description,
      acknowledged:  r.status === "DISMISSED",
      createdAt:     r.createdAt,
    }));
  }
}