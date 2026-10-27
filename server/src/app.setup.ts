import { Logger, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { NextFunction, Request, Response } from 'express';
import { existsSync } from 'fs';
import { join, resolve } from 'path';
import { UPLOAD_URL_PREFIX, uploadRoot } from './common/upload.util';

/** main.ts 与 e2e 测试共用的应用配置 */
export function setupApp(app: NestExpressApplication) {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      // 不做隐式类型转换：JSON 中 "123" 不会被当成数字，类型错误直接报错
      transformOptions: { enableImplicitConversion: false },
    }),
  );
  app.useStaticAssets(uploadRoot(), { prefix: UPLOAD_URL_PREFIX, maxAge: '7d' });
  app.enableCors();
  if (process.env.WEB_DIST) serveWeb(app, resolve(process.env.WEB_DIST));

  const swagger = new DocumentBuilder()
    .setTitle('班级通讯录与生日提醒平台 API')
    .setDescription('统一响应格式 { code, message, data }，code 为 0 表示成功，否则为 HTTP 状态码')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));
}

/**
 * 由后端直接托管前端构建产物（web/dist），一个进程、一个端口即可提供完整服务，
 * 适合没有 Nginx 的 Windows 单机部署。未设置 WEB_DIST 时不启用（开发环境由 Vite 提供页面）。
 */
function serveWeb(app: NestExpressApplication, dir: string) {
  const indexHtml = join(dir, 'index.html');
  if (!existsSync(indexHtml)) {
    new Logger('Web').warn(`WEB_DIST 目录中没有 index.html，未托管前端：${dir}`);
    return;
  }
  // 带哈希的静态资源可长期缓存；index.html 由下面的回退返回，不缓存，保证更新后立即生效
  app.useStaticAssets(dir, { index: false, maxAge: '30d' });
  // 前端使用 history 路由，刷新 /directory 等页面时也要返回 index.html
  app.use((req: Request, res: Response, next: NextFunction) => {
    const isPage =
      req.method === 'GET' &&
      !req.path.startsWith('/api') &&
      !req.path.startsWith(`${UPLOAD_URL_PREFIX}/`);
    if (!isPage) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });
}
