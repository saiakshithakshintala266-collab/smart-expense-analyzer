// File: services/upload-service/src/integrations/s3.presign.ts
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export async function presignPutObject(input: {
  s3: S3Client;
  bucket: string;
  key: string;
  contentType: string;
  expiresInSeconds: number;
}): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: input.bucket,
    Key: input.key,
    ContentType: input.contentType
    // IMPORTANT: do NOT set checksum-related fields here for LocalStack
  });

  return getSignedUrl(input.s3, cmd, { expiresIn: input.expiresInSeconds });
}