import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { mkdirSync } from 'fs';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors({ origin: true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Lưu trữ file nhẹ (CV, ảnh...) tạm thời trên ổ đĩa cục bộ trong môi trường phát triển —
  // sẽ chuyển sang Cloudflare R2 (SRS Mục 11) khi triển khai thật.
  mkdirSync(join(process.cwd(), 'uploads', 'cv'), { recursive: true });
  mkdirSync(join(process.cwd(), 'uploads', 'legal'), { recursive: true });
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });
  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`API đang chạy tại http://localhost:${port}`);
}
bootstrap();
