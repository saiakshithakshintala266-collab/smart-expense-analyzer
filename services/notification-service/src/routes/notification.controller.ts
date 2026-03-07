// File: services/notification-service/src/routes/notification.controller.ts
import { Controller, Get, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { NotificationService } from "../domain/notification.service";

@ApiTags("Notifications")
@ApiBearerAuth()
@Controller("/workspaces/:workspaceId/notifications")
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  /**
   * GET /workspaces/:workspaceId/notifications
   * Returns all notifications with unread count
   */
  @Get()
  @ApiQuery({ name: "status", required: false, enum: ["UNREAD", "READ"] })
  list(
    @Param("workspaceId") workspaceId: string,
    @Query("status") status?: "UNREAD" | "READ"
  ) {
    return this.notificationService.listNotifications(workspaceId, status);
  }

  /**
   * PATCH /workspaces/:workspaceId/notifications/:notificationId/read
   * Marks a single notification as read
   */
  @Patch("/:notificationId/read")
  async markRead(
    @Param("workspaceId") workspaceId: string,
    @Param("notificationId") notificationId: string,
    @Query("createdAt") createdAt: string
  ) {
    await this.notificationService.markRead(workspaceId, notificationId, createdAt);
    return { success: true };
  }

  /**
   * POST /workspaces/:workspaceId/notifications/read-all
   * Marks all notifications as read
   */
  @Post("/read-all")
  async markAllRead(@Param("workspaceId") workspaceId: string) {
    await this.notificationService.markAllRead(workspaceId);
    return { success: true };
  }

  /**
   * POST /workspaces/:workspaceId/notifications/send-digest
   * Manually trigger weekly digest email (for testing)
   */
  @Post("/send-digest")
  async sendDigest(@Param("workspaceId") workspaceId: string) {
    await this.notificationService.sendWeeklyDigest(workspaceId);
    return { success: true };
  }
}