// File: services/transactions-service/src/routes/transactions.dto.ts
import { ApiProperty } from "@nestjs/swagger";

export class CreateTransactionDto {
  @ApiProperty({ example: "Whole Foods Market" })
  merchant!: string;

  @ApiProperty({ example: 54.32, description: "Positive = expense, negative = refund/credit" })
  amount!: number;

  @ApiProperty({ example: "USD" })
  currency!: string;

  @ApiProperty({ example: "2024-03-15", description: "ISO 8601 date YYYY-MM-DD" })
  date!: string;

  @ApiProperty({ required: false })
  notes?: string;
}

export class CorrectTransactionDto {
  @ApiProperty({ required: false, example: "Whole Foods" })
  merchantOverride?: string;

  @ApiProperty({ required: false })
  notes?: string;
}