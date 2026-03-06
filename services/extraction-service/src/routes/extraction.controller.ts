// File: services/extraction-service/src/routes/extraction.controller.ts
import { Controller, Get, NotFoundException, Param, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiQuery, ApiTags } from "@nestjs/swagger";
import { ExtractionService } from "../domain/extraction.service";

@ApiTags("Extractions")
@ApiBearerAuth()
@Controller("/workspaces/:workspaceId/extractions")
export class ExtractionController {
  constructor(private readonly extraction: ExtractionService) {}

  /**
   * List all extracted documents for a workspace.
   */
  @Get()
  async list(@Param("workspaceId") workspaceId: string) {
    return this.extraction.list(workspaceId);
  }

  /**
   * Get a single extracted document by its ID.
   */
  @Get("/:extractedDocumentId")
  async getOne(
    @Param("workspaceId") workspaceId: string,
    @Param("extractedDocumentId") extractedDocumentId: string
  ) {
    const doc = await this.extraction.getById(workspaceId, extractedDocumentId);
    if (!doc) throw new NotFoundException("ExtractedDocument not found");
    return doc;
  }

  /**
   * Get the extracted document for a given uploadFileId.
   * Useful for polling after upload finalize.
   */
  @Get("/by-upload/:uploadFileId")
  @ApiQuery({ name: "uploadFileId", required: true })
  async getByUpload(
    @Param("workspaceId") workspaceId: string,
    @Param("uploadFileId") uploadFileId: string
  ) {
    const doc = await this.extraction.getByUploadFileId(workspaceId, uploadFileId);
    if (!doc) throw new NotFoundException("No extraction found for this uploadFileId");
    return doc;
  }
}