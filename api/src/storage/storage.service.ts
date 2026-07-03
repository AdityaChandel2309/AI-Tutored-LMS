import {
  CreateBucketCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import {
  getStorageAccessKey,
  getStorageBucket,
  getStorageEndpoint,
  getStoragePublicBaseUrl,
  getStorageRegion,
  getStorageSecretKey,
  getScormBucket,
  getVideoBucket,
} from '../config/runtime';
import { Readable } from 'stream';
import { buffer } from 'stream/consumers';

@Injectable()
export class StorageService {
  private readonly avatarBucket = getStorageBucket();
  private readonly videoBucket = getVideoBucket();
  private readonly scormBucket = getScormBucket();
  private readonly endpoint = getStorageEndpoint();
  private readonly publicBaseUrl = getStoragePublicBaseUrl();
  private readonly client = new S3Client({
    region: getStorageRegion(),
    endpoint: this.endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: getStorageAccessKey(),
      secretAccessKey: getStorageSecretKey(),
    },
  });
  // Separate client used ONLY for presigning. It's configured with the
  // browser-facing endpoint so the SigV4 signature is computed against the
  // public Host header (SigV4 signs Host — rewriting it after signing
  // breaks the signature with SignatureDoesNotMatch).
  private readonly presignClient = new S3Client({
    region: getStorageRegion(),
    endpoint: this.publicBaseUrl,
    forcePathStyle: true,
    credentials: {
      accessKeyId: getStorageAccessKey(),
      secretAccessKey: getStorageSecretKey(),
    },
  });
  private bucketReadyMap = new Map<string, Promise<void>>();

  // ── Avatar uploads (existing) ─────────────

  async uploadAvatar(input: {
    userId: string;
    fileName?: string;
    contentType?: string;
    body: Buffer;
  }) {
    await this.ensureBucket(this.avatarBucket);

    const extension = this.getExtension(input.fileName, input.contentType);
    const objectKey = `avatars/${input.userId}-${Date.now()}${extension}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.avatarBucket,
        Key: objectKey,
        Body: input.body,
        ContentType: input.contentType ?? 'application/octet-stream',
      }),
    );

    return `${this.publicBaseUrl}/${this.avatarBucket}/${objectKey}`;
  }

  // ── Presigned upload URL ──────────────────

  async getPresignedPutUrl(input: {
    objectKey: string;
    contentType: string;
    bucket?: string;
    expiresInSeconds: number;
  }): Promise<string> {
    const bucket = input.bucket ?? this.videoBucket;
    await this.ensureBucket(bucket);

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: input.objectKey,
      ContentType: input.contentType,
    });

    return getSignedUrl(this.presignClient, command, {
      expiresIn: input.expiresInSeconds,
    });
  }

  // ── Presigned download URL ────────────────

  async getPresignedGetUrl(input: {
    objectKey: string;
    bucket?: string;
    expiresInSeconds: number;
  }): Promise<string> {
    const bucket = input.bucket ?? this.videoBucket;

    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: input.objectKey,
    });

    return getSignedUrl(this.presignClient, command, {
      expiresIn: input.expiresInSeconds,
    });
  }

  // ── Object verification ───────────────────

  async headObject(input: { objectKey: string; bucket?: string }): Promise<{
    contentLength: number | undefined;
    contentType: string | undefined;
    exists: boolean;
  }> {
    const bucket = input.bucket ?? this.videoBucket;

    try {
      const result = await this.client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: input.objectKey,
        }),
      );
      return {
        exists: true,
        contentLength: result.ContentLength,
        contentType: result.ContentType,
      };
    } catch {
      return {
        exists: false,
        contentLength: undefined,
        contentType: undefined,
      };
    }
  }

  // ── Object deletion ───────────────────────

  async deleteObject(input: {
    objectKey: string;
    bucket?: string;
  }): Promise<void> {
    const bucket = input.bucket ?? this.videoBucket;

    await this.client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: input.objectKey,
      }),
    );
  }

  // ── Buffer upload (e.g. generated PDFs) ───

  async uploadBuffer(input: {
    bucket: string;
    objectKey: string;
    body: Buffer;
    contentType: string;
  }): Promise<void> {
    await this.ensureBucket(input.bucket);

    await this.client.send(
      new PutObjectCommand({
        Bucket: input.bucket,
        Key: input.objectKey,
        Body: input.body,
        ContentType: input.contentType,
      }),
    );
  }

  // ── Internal helpers ──────────────────────

  private async ensureBucket(bucketName: string) {
    // no-op guard handled below
    if (!this.bucketReadyMap.has(bucketName)) {
      this.bucketReadyMap.set(
        bucketName,
        (async () => {
          try {
            await this.client.send(
              new HeadBucketCommand({
                Bucket: bucketName,
              }),
            );
          } catch {
            await this.client.send(
              new CreateBucketCommand({
                Bucket: bucketName,
              }),
            );
          }
        })(),
      );
    }

    await this.bucketReadyMap.get(bucketName);
  }

  async getObjectBuffer(input: {
    objectKey: string;
    bucket?: string;
  }): Promise<Buffer> {
    const bucket = input.bucket ?? this.scormBucket;
    const result = await this.client.send(
      new GetObjectCommand({
        Bucket: bucket,
        Key: input.objectKey,
      }),
    );

    if (!result.Body) {
      return Buffer.from([]);
    }

    if (Buffer.isBuffer(result.Body)) {
      return result.Body;
    }

    if (result.Body instanceof Readable) {
      return buffer(result.Body);
    }

    return Buffer.from(await result.Body.transformToByteArray());
  }

  private getExtension(fileName?: string, contentType?: string) {
    const fileNameExtension = fileName?.trim().match(/\.[a-zA-Z0-9]+$/)?.[0];

    if (fileNameExtension) {
      return fileNameExtension.toLowerCase();
    }

    switch (contentType) {
      case 'image/png':
        return '.png';
      case 'image/webp':
        return '.webp';
      case 'image/gif':
        return '.gif';
      case 'image/jpeg':
      default:
        return '.jpg';
    }
  }

}
