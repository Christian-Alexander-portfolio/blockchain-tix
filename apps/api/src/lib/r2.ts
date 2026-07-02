import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { config } from '../config';
import * as path from 'path';
import * as crypto from 'crypto';

export const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${config.r2.accountId}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: config.r2.accessKeyId,
    secretAccessKey: config.r2.secretAccessKey,
  },
});

export async function uploadToR2(
  fileBuffer: Buffer,
  originalName: string,
  contentType: string,
  folder: string = 'uploads',
): Promise<string> {
  const ext = path.extname(originalName);
  const key = `${folder}/${crypto.randomBytes(16).toString('hex')}${ext}`;

  await r2Client.send(
    new PutObjectCommand({
      Bucket: config.r2.bucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    }),
  );

  return `${config.r2.publicUrl}/${key}`;
}

export async function deleteFromR2(url: string): Promise<void> {
  const key = url.replace(`${config.r2.publicUrl}/`, '');
  await r2Client.send(
    new DeleteObjectCommand({
      Bucket: config.r2.bucketName,
      Key: key,
    }),
  );
}

export async function uploadJsonToR2(key: string, data: object): Promise<string> {
  await r2Client.send(
    new PutObjectCommand({
      Bucket: config.r2.bucketName,
      Key: key,
      Body: JSON.stringify(data),
      ContentType: 'application/json',
    }),
  );
  return `${config.r2.publicUrl}/${key}`;
}
