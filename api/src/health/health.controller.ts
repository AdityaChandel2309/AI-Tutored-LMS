import { Controller, Get, HttpCode, HttpStatus, Res } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { S3Client, HeadBucketCommand } from '@aws-sdk/client-s3';
import axios from 'axios';
import {
  getStorageEndpoint,
  getStorageRegion,
  getStorageAccessKey,
  getStorageSecretKey,
  getStorageBucket,
  getKeycloakBaseUrl,
} from '../config/runtime';

@SkipThrottle()
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lightweight liveness probe – no auth, no external deps.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  liveness() {
    return { status: 'ok', uptime: process.uptime() };
  }

  /**
   * Readiness probe – verifies database and object-storage connectivity.
   * Returns HTTP 200 when all checks pass, HTTP 503 when any check fails.
   */
  @Get('ready')
  async readiness(@Res() res: Response) {
    const checks: Record<string, 'ok' | 'fail'> = {
      database: 'fail',
      storage: 'fail',
      keycloak: 'fail',
    };

    // ── Database check ──
    try {
      await this.prisma.$queryRaw(Prisma.sql`SELECT 1`);
      checks.database = 'ok';
    } catch {
      // leave as 'fail'
    }

    // ── Storage (MinIO / S3) check ──
    try {
      const s3 = new S3Client({
        endpoint: getStorageEndpoint(),
        region: getStorageRegion(),
        credentials: {
          accessKeyId: getStorageAccessKey(),
          secretAccessKey: getStorageSecretKey(),
        },
        forcePathStyle: true,
      });

      await s3.send(new HeadBucketCommand({ Bucket: getStorageBucket() }));
      s3.destroy();
      checks.storage = 'ok';
    } catch {
      // leave as 'fail'
    }

    // ── Keycloak check ──
    try {
      const keycloakUrl = getKeycloakBaseUrl();
      if (keycloakUrl) {
        const resp = await axios.get(`${keycloakUrl}/realms/master/.well-known/openid-configuration`, { timeout: 5000 });
        if (resp.status === 200) checks.keycloak = 'ok';
      }
    } catch {
      // leave as 'fail'
    }

    const allOk = Object.values(checks).every((v) => v === 'ok');
    const status = allOk ? 'ok' : 'degraded';
    const httpStatus = allOk ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;

    res.status(httpStatus).json({
      status,
      checks,
      uptime: process.uptime(),
    });
  }
}
