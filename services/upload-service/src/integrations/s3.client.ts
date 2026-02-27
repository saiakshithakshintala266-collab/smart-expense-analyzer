// File: services/upload-service/src/integrations/s3.client.ts
import { S3Client } from "@aws-sdk/client-s3";

export function createS3Client(): S3Client {
  const endpoint = process.env.AWS_ENDPOINT_URL;
  const region = process.env.AWS_REGION ?? "us-east-1";
  const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE ?? "false").toLowerCase() === "true";

  return new S3Client({
    region,
    endpoint,
    forcePathStyle,

    // IMPORTANT for LocalStack: disable checksum features that add x-amz-checksum-* to presigned URLs
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED"
  });
}