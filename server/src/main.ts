import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { setupApp } from './app.setup';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  setupApp(app);
  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(
    `服务已启动：http://localhost:${port}/api ，接口文档：http://localhost:${port}/api/docs`,
  );
}

void bootstrap();
