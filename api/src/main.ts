import { LogLevel, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json } from 'express';
import helmet from 'helmet';
import type { Express, Request, Response } from 'express';
import {
  getApiHost,
  getApiPort,
  getCorsOrigins,
  getPublicApiUrl,
} from './config/runtime';
import { AppModule } from './app.module';
import { loadProjectEnv } from './env';
import { validateEnvironment } from './config/env-validation';
import { StructuredLogger } from './common/logger/structured-logger';

function resolveLogLevels(): LogLevel[] {
  const raw = (process.env.LOG_LEVEL ?? 'log,error,warn,debug,verbose')
    .split(',')
    .map((s) => s.trim() as LogLevel);
  const valid: LogLevel[] = ['log', 'error', 'warn', 'debug', 'verbose'];
  return raw.filter((l) => valid.includes(l));
}

async function bootstrap() {
  loadProjectEnv();
  validateEnvironment();

  const app = await NestFactory.create(AppModule, {
    logger: new StructuredLogger(resolveLogLevels()),
  });

  app.enableCors({
    origin: getCorsOrigins(),
    credentials: true,
  });

  app.use(helmet());

  app.use(json({ limit: '10mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('LMS API')
    .setDescription(
      'Phase 1 baseline API for authentication, tenant-scoped user management, profile, and avatar flows.',
    )
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  const expressApp = app.getHttpAdapter().getInstance() as Express;

  expressApp.get('/docs-json', (_req: Request, res: Response) => {
    res.json(swaggerDocument);
  });

  SwaggerModule.setup('docs', app, swaggerDocument, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = getApiPort();
  const host = getApiHost();

  await app.listen(port, host);

  console.log(`API running on ${getPublicApiUrl()}`);
}

void bootstrap();
