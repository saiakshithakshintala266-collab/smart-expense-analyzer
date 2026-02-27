// File: services/upload-service/src/integrations/s3.verify.ts
import { HeadObjectCommand, S3Client } from "@aws-sdk/client-s3";

export async function verifyObjectExists(input: {
  s3: S3Client;
  bucket: string;
  key: string;
}): Promise<void> {
  await input.s3.send(
    new HeadObjectCommand({
      Bucket: input.bucket,
      Key: input.key
    })
  );
}