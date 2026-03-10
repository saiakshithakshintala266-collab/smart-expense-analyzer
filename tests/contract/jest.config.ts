// File: tests/contract/jest.config.ts
import type { Config } from "jest";

const config: Config = {
  displayName: "contract",
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/**/*.contract.test.ts"],
  moduleNameMapper: {
    // @shared/* aliases only — NO @nestjs remapping (breaks swagger/mapped-types)
    "^@shared/testing$":       "<rootDir>/../../shared/libs/testing/src/index.ts",
    "^@shared/logger$":        "<rootDir>/../../shared/libs/logger/src/index.ts",
    "^@shared/observability$": "<rootDir>/../../shared/libs/observability/src/index.ts",
    "^@shared/idempotency$":   "<rootDir>/../../shared/libs/idempotency/src/index.ts",
    // nanoid@5 and uuid@10 are ESM-only
    "^nanoid$": "<rootDir>/../../node_modules/.pnpm/nanoid@3.3.11/node_modules/nanoid/index.cjs",
    "^uuid$":   "<rootDir>/../../node_modules/.pnpm/uuid@10.0.0/node_modules/uuid/dist/index.js"
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }]
  }
};

export default config;