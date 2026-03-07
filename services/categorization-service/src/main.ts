// File: services/categorization-service/src/main.ts
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

  const config = new DocumentBuilder()
    .setTitle("Categorization Service")
    .setDescription("Categorizes transactions using rules engine + Bedrock LLM fallback")
    .setVersion("1.0.0")
    .build();

  SwaggerModule.setup("/docs", app, SwaggerModule.createDocument(app, config));

  const port = Number(process.env.PORT ?? 3004);
  await app.listen({ port, host: "0.0.0.0" });
}

void bootstrap();