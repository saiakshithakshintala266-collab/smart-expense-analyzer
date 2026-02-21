"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("reflect-metadata");
const core_1 = require("@nestjs/core");
const platform_fastify_1 = require("@nestjs/platform-fastify");
const swagger_1 = require("@nestjs/swagger");
const app_module_1 = require("./module/app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule, new platform_fastify_1.FastifyAdapter({ logger: false }));
    const config = new swagger_1.DocumentBuilder()
        .setTitle("Upload Service")
        .setDescription("Workspace-scoped upload initiation and lifecycle")
        .setVersion("1.0.0")
        .addBearerAuth()
        .build();
    const document = swagger_1.SwaggerModule.createDocument(app, config);
    swagger_1.SwaggerModule.setup("/docs", app, document);
    const port = Number(process.env.PORT ?? 3001);
    await app.listen({ port, host: "0.0.0.0" });
}
void bootstrap();
//# sourceMappingURL=main.js.map