// File: services/upload-service/src/routes/uploads.dto.ts
import { ApiProperty } from "@nestjs/swagger";
import { IsEnum, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class CreateUploadRequestDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  originalFileName!: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  contentType!: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  sizeBytes!: number;

  @ApiProperty({ enum: ["receipt", "bank_csv", "manual"] })
  @IsEnum(["receipt", "bank_csv", "manual"])
  source!: "receipt" | "bank_csv" | "manual";

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  checksumSha256?: string;
}

export class FinalizeUploadRequestDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  checksumSha256?: string;
}