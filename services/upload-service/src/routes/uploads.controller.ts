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
  Req
} from "@nestjs/common";
import { ApiHeader, ApiTags } from "@nestjs/swagger";
import { CORRELATION_HEADER } from "@shared/observability";
import { IDEMPOTENCY_HEADER } from "@shared/idempotency";
import { UploadsService } from "../domain/uploads.service";
import { CreateUploadRequestDto, FinalizeUploadRequestDto } from "./uploads.dto";

// NOTE: This controller is intentionally unauthenticated and intended for dev-only usage.
// Do not expose these endpoints in production without adding proper auth guards.
@ApiTags("Uploads (dev-only, no auth)")
@Controller("/workspaces/:workspaceId/uploads")
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  private getActorUserId(req: any): string {
    return req?.user?.id ?? "dev-user";
  }

  @Post()
  @ApiHeader({ name: "Idempotency-Key", required: false })
  @ApiHeader({ name: "X-Correlation-Id", required: false })
  createUpload(
    @Param("workspaceId") workspaceId: string,
    @Headers(CORRELATION_HEADER) correlationId: string | undefined,
    @Headers(IDEMPOTENCY_HEADER) idempotencyKey: string | undefined,
    @Body() body: CreateUploadRequestDto,
    @Req() req: any
  ) {
    return this.uploads.createUpload({
      workspaceId,
      actorUserId: this.getActorUserId(req),
      correlationId: correlationId ?? "",
      idempotencyKey: idempotencyKey ?? undefined,
      request: body
    });
  }

  @Post("/:uploadFileId/finalize")
  @HttpCode(200) // FIX: POST defaults to 201; finalize returns existing resource state, not a new resource
  @ApiHeader({ name: "Idempotency-Key", required: false })
  @ApiHeader({ name: "X-Correlation-Id", required: false })
  finalize(
    @Param("workspaceId") workspaceId: string,
    @Param("uploadFileId") uploadFileId: string,
    @Headers(CORRELATION_HEADER) correlationId: string | undefined,
    @Headers(IDEMPOTENCY_HEADER) idempotencyKey: string | undefined,
    @Body() body: FinalizeUploadRequestDto,
    @Req() req: any
  ) {
    return this.uploads.finalizeUpload({
      workspaceId,
      uploadFileId,
      actorUserId: this.getActorUserId(req),
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
  @ApiHeader({ name: "X-Correlation-Id", required: false })
  remove(
    @Param("workspaceId") workspaceId: string,
    @Param("uploadFileId") uploadFileId: string,
    @Req() req: any
  ) {
    this.uploads.deleteUpload({
      workspaceId,
      uploadFileId,
      actorUserId: this.getActorUserId(req)
    });
  }
}