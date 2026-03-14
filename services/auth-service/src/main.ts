import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false }),
  );

  app.enableCors({ origin: '*' });

  const port = process.env.PORT ?? 3009;
  await app.listen(port, '0.0.0.0');
  console.log(`auth-service running on port ${port}`);
}

bootstrap();