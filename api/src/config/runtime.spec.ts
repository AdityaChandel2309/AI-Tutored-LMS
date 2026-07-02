const originalEnv = { ...process.env };

function loadRuntime(): typeof import('./runtime') {
  return jest.requireActual('./runtime');
}

describe('runtime storage config', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.MINIO_ENDPOINT;
    delete process.env.MINIO_PUBLIC_BASE_URL;
    delete process.env.MINIO_ACCESS_KEY;
    delete process.env.MINIO_SECRET_KEY;
    delete process.env.MINIO_ROOT_USER;
    delete process.env.MINIO_ROOT_PASSWORD;
    delete process.env.NODE_ENV;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('uses local storage defaults in development', () => {
    const runtime = loadRuntime();

    expect(runtime.getStorageEndpoint()).toBe('http://localhost:9000');
    expect(runtime.getStoragePublicBaseUrl()).toBe('http://localhost:9000');
    expect(runtime.getStorageAccessKey()).toBe('minioadmin');
    expect(runtime.getStorageSecretKey()).toBe('minioadmin123');
  });

  it('prefers explicit MinIO credentials when provided', () => {
    process.env.MINIO_ACCESS_KEY = 'access-key';
    process.env.MINIO_SECRET_KEY = 'secret-key';

    const runtime = loadRuntime();

    expect(runtime.getStorageAccessKey()).toBe('access-key');
    expect(runtime.getStorageSecretKey()).toBe('secret-key');
  });

  it('requires explicit endpoint and credentials outside local environments', () => {
    process.env.NODE_ENV = 'production';

    const runtime = loadRuntime();

    expect(() => runtime.getStorageEndpoint()).toThrow(
      'Missing required environment variable: MINIO_ENDPOINT',
    );
    expect(() => runtime.getStorageAccessKey()).toThrow(
      'Missing required environment variable: MINIO_ACCESS_KEY',
    );
    expect(() => runtime.getStorageSecretKey()).toThrow(
      'Missing required environment variable: MINIO_SECRET_KEY',
    );
  });
});
