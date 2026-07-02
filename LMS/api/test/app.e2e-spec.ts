import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

type ResponseEnvelope<T> = {
  data: T;
  meta: { path: string; timestamp: string };
};

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  it('/ (GET)', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect(({ body }) => {
        const payload = body as ResponseEnvelope<string>;
        expect(payload.data).toBe('Hello World!');
        expect(payload.meta.path).toBe('/');
        expect(typeof payload.meta.timestamp).toBe('string');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
