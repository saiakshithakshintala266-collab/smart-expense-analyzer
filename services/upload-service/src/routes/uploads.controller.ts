// File: services/upload-service/src/routes/uploads.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiTags } from "@nestjs/swagger";
import { CORRELATION_HEADER } from "@shared/observability";
import { IDEMPOTENCY_HEADER } from "@shared/idempotency";
import { UploadsService } from "../domain/uploads.service";
import { CreateUploadRequestDto, FinalizeUploadRequestDto } from "./uploads.dto";
import { DebugRoleGuard } from "../auth/debug-role.guard";

@ApiTags("Uploads")
@ApiBearerAuth()
@Controller("/workspaces/:workspaceId/uploads")
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  @Post()
  @UseGuards(DebugRoleGuard)
  @ApiHeader({ name: "X-Debug-Role", required: false, description: "dev-only: admin|member|viewer" })
  @ApiHeader({ name: "Idempotency-Key", required: false })
  @ApiHeader({ name: "X-Correlation-Id", required: false })
  createUpload(
    @Param("workspaceId") workspaceId: string,
    @Headers(CORRELATION_HEADER) correlationId: string | undefined,
    @Headers(IDEMPOTENCY_HEADER) idempotencyKey: string | undefined,
    @Body() body: CreateUploadRequestDto
  ) {
    return this.uploads.createUpload({
      workspaceId,
      actorUserId: "dev-user",
      correlationId: correlationId ?? "",
      idempotencyKey: idempotencyKey ?? undefined,
      request: body
    });
  }

  @Post("/:uploadFileId/finalize")
  @HttpCode(200) // FIX: POST defaults to 201; finalize returns existing resource state, not a new resource
  @UseGuards(DebugRoleGuard)
  @ApiHeader({ name: "X-Debug-Role", required: false, description: "dev-only: admin|member|viewer" })
  @ApiHeader({ name: "Idempotency-Key", required: false })
  @ApiHeader({ name: "X-Correlation-Id", required: false })
  finalize(
    @Param("workspaceId") workspaceId: string,
    @Param("uploadFileId") uploadFileId: string,
    @Headers(CORRELATION_HEADER) correlationId: string | undefined,
    @Headers(IDEMPOTENCY_HEADER) idempotencyKey: string | undefined,
    @Body() body: FinalizeUploadRequestDto
  ) {
    return this.uploads.finalizeUpload({
      workspaceId,
      uploadFileId,
      actorUserId: "dev-user",
      correlationId: correlationId ?? "",
      idempotencyKey: idempotencyKey ?? undefined,
      request: body
    });
  }

  @Get("/:uploadFileId")
  @ApiHeader({ name: "X-Correlation-Id", required: false })
  getOne(
    @Param("workspaceId") workspaceId: string,
    @Param("uploadFileId") uploadFileId: string
  ) {
    return this.uploads.getUpload({ workspaceId, uploadFileId });
  }

  @Get()
  @ApiHeader({ name: "X-Correlation-Id", required: false })
  list(
    @Param("workspaceId") workspaceId: string,
    @Query("status") status?: string,
    @Query("source") source?: string
  ) {
    return this.uploads.listUploads({ workspaceId, status, source });
  }

  @Delete("/:uploadFileId")
  @UseGuards(DebugRoleGuard)
  @ApiHeader({ name: "X-Debug-Role", required: false, description: "dev-only: admin|member|viewer" })
  @ApiHeader({ name: "X-Correlation-Id", required: false })
  remove(
    @Param("workspaceId") workspaceId: string,
    @Param("uploadFileId") uploadFileId: string
  ) {
    this.uploads.deleteUpload({ workspaceId, uploadFileId, actorUserId: "dev-user" });
  }
}