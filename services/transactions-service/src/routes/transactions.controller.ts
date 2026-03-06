// File: services/transactions-service/src/routes/transactions.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiQuery, ApiTags } from "@nestjs/swagger";
import { CORRELATION_HEADER } from "@shared/observability";
import { TransactionsService } from "../domain/transactions.service";
import { CorrectTransactionDto, CreateTransactionDto } from "./transactions.dto";

@ApiTags("Transactions")
@ApiBearerAuth()
@Controller("/workspaces/:workspaceId/transactions")
export class TransactionsController {
  constructor(private readonly transactions: TransactionsService) {}

  @Get()
  @ApiQuery({ name: "dateFrom", required: false, example: "2024-01-01" })
  @ApiQuery({ name: "dateTo", required: false, example: "2024-12-31" })
  @ApiQuery({ name: "category", required: false })
  @ApiQuery({ name: "source", required: false, enum: ["receipt", "bank_csv", "manual"] })
  @ApiQuery({ name: "limit", required: false })
  @ApiQuery({ name: "nextPageToken", required: false })
  @ApiHeader({ name: "X-Correlation-Id", required: false })
  list(
    @Param("workspaceId") workspaceId: string,
    @Query("dateFrom") dateFrom?: string,
    @Query("dateTo") dateTo?: string,
    @Query("category") category?: string,
    @Query("source") source?: string,
    @Query("limit") limit?: string,
    @Query("nextPageToken") nextPageToken?: string
  ) {
    return this.transactions.listTransactions(workspaceId, {
      dateFrom,
      dateTo,
      category,
      source: source as any,
      limit: limit ? parseInt(limit, 10) : undefined,
      nextPageToken
    });
  }

  @Get("/:transactionId")
  @ApiHeader({ name: "X-Correlation-Id", required: false })
  getOne(
    @Param("workspaceId") workspaceId: string,
    @Param("transactionId") transactionId: string
  ) {
    return this.transactions.getTransaction(workspaceId, transactionId);
  }

  @Post()
  @ApiHeader({ name: "X-Correlation-Id", required: false })
  create(
    @Param("workspaceId") workspaceId: string,
    @Headers(CORRELATION_HEADER) correlationId: string | undefined,
    @Body() body: CreateTransactionDto
  ) {
    return this.transactions.createManual(workspaceId, "dev-user", correlationId ?? "", body);
  }

  @Patch("/:transactionId")
  @ApiHeader({ name: "X-Correlation-Id", required: false })
  correct(
    @Param("workspaceId") workspaceId: string,
    @Param("transactionId") transactionId: string,
    @Headers(CORRELATION_HEADER) correlationId: string | undefined,
    @Body() body: CorrectTransactionDto
  ) {
    return this.transactions.correctTransaction(
      workspaceId, transactionId, "dev-user", correlationId ?? "", body
    );
  }

  @Delete("/:transactionId")
  @HttpCode(204)
  @ApiHeader({ name: "X-Correlation-Id", required: false })
  async remove(
    @Param("workspaceId") workspaceId: string,
    @Param("transactionId") transactionId: string,
    @Headers(CORRELATION_HEADER) correlationId: string | undefined
  ) {
    await this.transactions.deleteTransaction(
      workspaceId, transactionId, "dev-user", correlationId ?? ""
    );
  }
}