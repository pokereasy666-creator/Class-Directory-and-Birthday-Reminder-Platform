import { NestExpressApplication } from '@nestjs/platform-express';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import request from 'supertest';
import { createApp } from './helpers';

describe('后端托管前端页面（WEB_DIST）', () => {
  let app: NestExpressApplication;
  const original = process.env.WEB_DIST;

  beforeAll(async () => {
    const dist = mkdtempSync(join(tmpdir(), 'web-dist-'));
    mkdirSync(join(dist, 'assets'));
    writeFileSync(join(dist, 'index.html'), '<!doctype html><title>班级通讯录</title>');
    writeFileSync(join(dist, 'assets', 'app-abc123.js'), 'console.log(1)');
    process.env.WEB_DIST = dist;
    ({ app } = await createApp());
  });

  afterAll(async () => {
    process.env.WEB_DIST = original;
    await app.close();
  });

  it('首页与前端路由返回 index.html，且不缓存', async () => {
    const http = request(app.getHttpServer());
    for (const path of ['/', '/directory', '/admin/users?status=PENDING']) {
      const res = await http.get(path).expect(200);
      expect(res.text).toContain('<title>班级通讯录</title>');
      expect(res.headers['cache-control']).toBe('no-cache');
    }
  });

  it('静态资源可长期缓存', async () => {
    const res = await request(app.getHttpServer()).get('/assets/app-abc123.js').expect(200);
    expect(res.text).toBe('console.log(1)');
    expect(res.headers['cache-control']).toContain('max-age=2592000');
  });

  it('接口不受影响：未知接口仍返回 JSON 404，受保护接口仍需登录', async () => {
    const http = request(app.getHttpServer());
    const missing = await http.get('/api/not-exist').expect(404);
    expect(missing.body.code).toBe(404);
    const protectedRes = await http.get('/api/users').expect(401);
    expect(protectedRes.body.message).toBe('请先登录');
  });
});
