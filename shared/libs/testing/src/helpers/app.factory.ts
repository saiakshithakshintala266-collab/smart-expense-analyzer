// File: shared/libs/testing/src/helpers/app.factory.ts
import { Test, TestingModule } from "@nestjs/testing";
import { FastifyAdapter, NestFastifyApplication } from "@nestjs/platform-fastify";
import { INestApplication } from "@nestjs/common";

export async function createTestApp(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  AppModule: any,
  overrideProviders: Array<{ provide: any; useValue: any }> = []
): Promise<NestFastifyApplication> {
  let builder = Test.createTestingModule({ imports: [AppModule] });
  for (const o of overrideProviders) {
    builder = builder.overrideProvider(o.provide).useValue(o.useValue);
  }
  const module: TestingModule = await builder.compile();
  const app = module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

export async function closeTestApp(app: INestApplication): Promise<void> {
  await app.close();
}