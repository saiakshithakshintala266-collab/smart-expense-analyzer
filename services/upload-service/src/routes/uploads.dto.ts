import { ApiProperty } from "@nestjs/swagger";

export class CreateUploadRequestDto {
  @ApiProperty()
  originalFileName!: string;

  @ApiProperty()
  contentType!: string;

  @ApiProperty()
  sizeBytes!: number;

  @ApiProperty({ enum: ["receipt", "bank_csv", "manual"] })
  source!: "receipt" | "bank_csv" | "manual";

  @ApiProperty({ required: false })
  checksumSha256?: string;
}

export class FinalizeUploadRequestDto {
  @ApiProperty({ required: false })
  checksumSha256?: string;
}
