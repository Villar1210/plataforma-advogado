import 'dotenv/config';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET não definido no .env');
  const app = await NestFactory.create(AppModule);
  app.getHttpAdapter().getInstance().set('trust proxy', 1);
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.enableCors({
    origin: (process.env.CORS_ORIGINS ?? process.env.APP_URL ?? 'http://localhost:3005').split(','),
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );
  const porta = Number(process.env.PORT ?? 3340);
  await app.listen(porta, '127.0.0.1');
  Logger.log(`API rodando em http://127.0.0.1:${porta}`, 'Bootstrap');
}
bootstrap();
