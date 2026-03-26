// File: services/chat-service/src/main.ts
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
    origin: (process.env.CORS_ORIGIN ?? "http://localhost:3000").split(","),
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Correlation-Id"],
    credentials: false
  });

  const config = new DocumentBuilder()
    .setTitle("Chat Service")
    .setDescription("Natural language expense queries powered by Bedrock tool-use")
    .setVersion("1.0.0")
    .addBearerAuth()
    .build();

  SwaggerModule.setup("/docs", app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.PORT ?? 3008);
  await app.listen({ port, host: "0.0.0.0" });
}

void bootstrap();