import { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { createApp } from './helpers';

describe('登录限流', () => {
  let app: NestExpressApplication;
  const original = process.env.AUTH_RATE_LIMIT;

  beforeAll(async () => {
    process.env.AUTH_RATE_LIMIT = '3';
    ({ app } = await createApp());
  });

  afterAll(async () => {
    process.env.AUTH_RATE_LIMIT = original;
    await app.close();
  });

  it('同一 IP 每分钟超过上限后返回 429', async () => {
    const http = request(app.getHttpServer());
    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const res = await http
        .post('/api/auth/login')
        .send({ username: 'nobody', password: 'wrong123' });
      statuses.push(res.status);
    }
    expect(statuses).toEqual([401, 401, 401, 429]);
  });
});
