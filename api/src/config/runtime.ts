function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, '');
}

function getEnv(key: string, fallback?: string) {
  const value = process.env[key]?.trim();

  if (value) {
    return value;
  }

  return fallback;
}

export function getCorsOrigins() {
  const configuredOrigins = getEnv('CORS_ORIGINS');

  if (!configuredOrigins) {
    return ['http://localhost:3001', 'http://127.0.0.1:3001'];
  }

  return configuredOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export function getApiHost() {
  return getEnv('HOST', '0.0.0.0')!;
}

export function getApiPort() {
  return Number(getEnv('PORT', '3000'));
}

export function getPublicApiUrl() {
  const explicitUrl = getEnv('API_PUBLIC_URL');

  if (explicitUrl) {
    return trimTrailingSlash(explicitUrl);
  }

  return `http://localhost:${getApiPort()}`;
}

export function getKeycloakBaseUrl() {
  return trimTrailingSlash(
    getEnv('KEYCLOAK_BASE_URL', 'http://localhost:8080')!,
  );
}

export function getKeycloakInternalUrl() {
  return trimTrailingSlash(
    getEnv('KEYCLOAK_INTERNAL_URL', getKeycloakBaseUrl())!,
  );
}

export function getKeycloakRealm() {
  return getEnv('KEYCLOAK_REALM', 'LMS')!;
}

export function getKeycloakClientId() {
  return getEnv('KEYCLOAK_CLIENT_ID', 'lms-web')!;
}

export function getFrontendAppUrl() {
  return trimTrailingSlash(
    getEnv('FRONTEND_APP_URL', 'http://localhost:3001')!,
  );
}

export function getKeycloakRedirectUri() {
  return getEnv('KEYCLOAK_REDIRECT_URI', `${getFrontendAppUrl()}/callback`)!;
}

function isLocalNodeEnv() {
  const nodeEnv = getEnv('NODE_ENV', 'development');
  return nodeEnv === 'development' || nodeEnv === 'test';
}

function getRequiredEnv(key: string) {
  const value = getEnv(key);

  if (value) {
    return value;
  }

  throw new Error(`Missing required environment variable: ${key}`);
}

export function getStorageBucket() {
  return getEnv('MINIO_BUCKET', 'lms-avatars')!;
}

export function getStorageRegion() {
  return getEnv('MINIO_REGION', 'us-east-1')!;
}

export function getStorageEndpoint() {
  const explicitEndpoint = getEnv('MINIO_ENDPOINT');

  if (explicitEndpoint) {
    return trimTrailingSlash(explicitEndpoint);
  }

  if (isLocalNodeEnv()) {
    return 'http://localhost:9000';
  }

  throw new Error('Missing required environment variable: MINIO_ENDPOINT');
}

export function getStoragePublicBaseUrl() {
  const explicitPublicBaseUrl = getEnv('MINIO_PUBLIC_BASE_URL');

  if (explicitPublicBaseUrl) {
    return trimTrailingSlash(explicitPublicBaseUrl);
  }

  return getStorageEndpoint();
}

export function getStorageAccessKey() {
  const explicitAccessKey = getEnv('MINIO_ACCESS_KEY');

  if (explicitAccessKey) {
    return explicitAccessKey;
  }

  const legacyRootUser = getEnv('MINIO_ROOT_USER');

  if (legacyRootUser) {
    return legacyRootUser;
  }

  if (isLocalNodeEnv()) {
    return 'minioadmin';
  }

  return getRequiredEnv('MINIO_ACCESS_KEY');
}

export function getStorageSecretKey() {
  const explicitSecretKey = getEnv('MINIO_SECRET_KEY');

  if (explicitSecretKey) {
    return explicitSecretKey;
  }

  const legacyRootPassword = getEnv('MINIO_ROOT_PASSWORD');

  if (legacyRootPassword) {
    return legacyRootPassword;
  }

  if (isLocalNodeEnv()) {
    return 'minioadmin123';
  }

  return getRequiredEnv('MINIO_SECRET_KEY');
}

// ── Video pipeline config ──────────────────

export function getVideoBucket() {
  return getEnv('VIDEO_BUCKET', 'lms-videos')!;
}

export function getVideoUploadMaxBytes() {
  return Number(
    getEnv(
      'VIDEO_UPLOAD_MAX_BYTES',
      '1073741824', // 1 GB
    ),
  );
}

export function getVideoPresignUploadTtlSec() {
  return Number(getEnv('VIDEO_PRESIGN_UPLOAD_TTL_SEC', '900'));
}

export function getVideoPresignStreamTtlSec() {
  return Number(getEnv('VIDEO_PRESIGN_STREAM_TTL_SEC', '7200'));
}

export function getVideoStorageQuotaBytes() {
  return Number(
    getEnv(
      'VIDEO_STORAGE_QUOTA_BYTES',
      '10737418240', // 10 GB
    ),
  );
}

export function getVideoThumbnailBucket() {
  return getEnv('VIDEO_THUMBNAIL_BUCKET', 'lms-videos')!;
}

// ── SCORM pipeline config ──────────────────

export function getScormBucket() {
  return getEnv('SCORM_BUCKET', 'lms-scorm')!;
}

export function getScormUploadMaxBytes() {
  return Number(
    getEnv(
      'SCORM_UPLOAD_MAX_BYTES',
      '1073741824', // 1 GB
    ),
  );
}

export function getScormPresignUploadTtlSec() {
  return Number(getEnv('SCORM_PRESIGN_UPLOAD_TTL_SEC', '900'));
}

// ── Lesson resource pipeline config ────────

export function getResourceBucket() {
  return getEnv('RESOURCE_BUCKET', 'lms-resources')!;
}

export function getResourceUploadMaxBytes() {
  return Number(getEnv('RESOURCE_UPLOAD_MAX_BYTES', '104857600')); // 100 MB
}

export function getResourcePresignUploadTtlSec() {
  return Number(getEnv('RESOURCE_PRESIGN_UPLOAD_TTL_SEC', '900'));
}

export function getResourcePresignDownloadTtlSec() {
  return Number(getEnv('RESOURCE_PRESIGN_DOWNLOAD_TTL_SEC', '3600'));
}
