"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createTestApp = createTestApp;
exports.closeTestApp = closeTestApp;
// File: shared/libs/testing/src/helpers/app.factory.ts
const testing_1 = require("@nestjs/testing");
const platform_fastify_1 = require("@nestjs/platform-fastify");
async function createTestApp(
// eslint-disable-next-line @typescript-eslint/no-explicit-any
AppModule, overrideProviders = []) {
    let builder = testing_1.Test.createTestingModule({ imports: [AppModule] });
    for (const o of overrideProviders) {
        builder = builder.overrideProvider(o.provide).useValue(o.useValue);
    }
    const module = await builder.compile();
    const app = module.createNestApplication(new platform_fastify_1.FastifyAdapter());
    await app.init();
    await app.getHttpAdapter().getInstance().ready();
    return app;
}
async function closeTestApp(app) {
    await app.close();
}
//# sourceMappingURL=app.factory.js.map