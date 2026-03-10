// File: tests/integration/jest.config.ts
import type { Config } from "jest";

const config: Config = {
  displayName: "integration",
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/**/*.test.ts"],
  moduleNameMapper: {
    "^dotenv$":                "<rootDir>/../../services/upload-service/node_modules/dotenv",
    "^@aws-sdk/(.+)$":         "<rootDir>/../../services/upload-service/node_modules/@aws-sdk/$1",
    "^@shared/testing$":       "<rootDir>/../../shared/libs/testing/src/index.ts",
    "^@shared/logger$":        "<rootDir>/../../shared/libs/logger/src/index.ts",
    "^@shared/observability$": "<rootDir>/../../shared/libs/observability/src/index.ts",
    "^@shared/idempotency$":   "<rootDir>/../../shared/libs/idempotency/src/index.ts"
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }]
  },
  testTimeout: 30000  // 30s for LocalStack + service calls
};

export default config;