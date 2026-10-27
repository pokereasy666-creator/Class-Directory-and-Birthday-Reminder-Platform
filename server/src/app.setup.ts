import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  const swagger = new DocumentBuilder()
    .setTitle('班级通讯录与生日提醒平台 API')
    .setDescription('统一响应格式 { code, message, data }，code 为 0 表示成功，否则为 HTTP 状态码')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swagger));
}
