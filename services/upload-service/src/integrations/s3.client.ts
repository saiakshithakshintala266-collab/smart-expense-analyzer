// File: services/upload-service/src/integrations/s3.client.ts
import { S3Client } from "@aws-sdk/client-s3";

export function createS3Client(): S3Client {
  const region = process.env.AWS_REGION ?? "us-east-1";
  const forcePathStyle = (process.env.S3_FORCE_PATH_STYLE ?? "false").toLowerCase() === "true";
  // S3_ENDPOINT_URL is only set when explicitly needed (e.g. LocalStack testing)
  // If not set → real AWS S3
  const endpoint = process.env.S3_ENDPOINT_URL;

  return new S3Client({
    region,
    ...(endpoint ? { endpoint, forcePathStyle } : {}),
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED"
  });
}