// File: services/extraction-service/src/main.ts
import * as path from "path";
import * as dotenv from "dotenv";

import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { AppModule } from "./module/app.module";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false })
  );

  app.enableCors({
    origin: ["http://localhost:3000"],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Correlation-Id", "Idempotency-Key"],
    credentials: false
  });

  const config = new DocumentBuilder()
    .setTitle("Extraction Service")
    .setDescription("Processes uploaded files via OCR (Textract) or CSV parsing, emits extraction.completed.v1")
    .setVersion("1.0.0")
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup("/docs", app, document);

  const port = Number(process.env.PORT ?? 3002);
  await app.listen({ port, host: "0.0.0.0" });
}

void bootstrap();