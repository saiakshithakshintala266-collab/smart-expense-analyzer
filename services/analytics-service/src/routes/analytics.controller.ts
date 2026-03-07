// File: services/analytics-service/src/routes/analytics.controller.ts
import { Controller, Get, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { AnalyticsService } from "../domain/analytics.service";

@ApiTags("Analytics")
@ApiBearerAuth()
@Controller("/workspaces/:workspaceId/analytics")
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /**
   * GET /workspaces/:workspaceId/analytics/summary?yearMonth=2026-03
   * Returns monthly total + category breakdown + source breakdown + top merchants
   */
  @Get("/summary")
  @ApiQuery({ name: "yearMonth", required: true, example: "2026-03" })
  getMonthlySummary(
    @Param("workspaceId") workspaceId: string,
    @Query("yearMonth") yearMonth: string
  ) {
    const ym = yearMonth ?? currentYearMonth();
    return this.analytics.getMonthlySummary(workspaceId, ym);
  }

  /**
   * GET /workspaces/:workspaceId/analytics/daily?yearMonth=2026-03
   * Returns daily totals for a given month
   */
  @Get("/daily")
  @ApiQuery({ name: "yearMonth", required: true, example: "2026-03" })
  getDailySummaries(
    @Param("workspaceId") workspaceId: string,
    @Query("yearMonth") yearMonth: string
  ) {
    const ym = yearMonth ?? currentYearMonth();
    return this.analytics.getDailySummaries(workspaceId, ym);
  }

  /**
   * GET /workspaces/:workspaceId/analytics/trends
   * Returns month-over-month trends for the last 12 months
   */
  @Get("/trends")
  getTrends(@Param("workspaceId") workspaceId: string) {
    return this.analytics.getMonthOverMonthTrends(workspaceId);
  }
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}