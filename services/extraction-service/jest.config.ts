// File: services/extraction-service/jest.config.ts
import type { Config } from "jest";

const config: Config = {
  displayName: "extraction-service",
  preset: "ts-jest",
  testEnvironment: "node",
  rootDir: ".",
  testMatch: ["<rootDir>/src/__tests__/**/*.test.ts"],
  moduleNameMapper: {
    "^@shared/testing$":       "<rootDir>/../../shared/libs/testing/src/index.ts",
    "^@shared/logger$":        "<rootDir>/../../shared/libs/logger/src/index.ts",
    "^@shared/observability$": "<rootDir>/../../shared/libs/observability/src/index.ts",
    "^@shared/idempotency$":   "<rootDir>/../../shared/libs/idempotency/src/index.ts",
    "^nanoid$": "<rootDir>/../../node_modules/.pnpm/nanoid@3.3.11/node_modules/nanoid/index.cjs",
    "^uuid$":   "<rootDir>/../../node_modules/.pnpm/uuid@10.0.0/node_modules/uuid/dist/index.js"
  },
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: "<rootDir>/tsconfig.json" }]
  },
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/main.ts",
    "!src/**/*.dto.ts",
    "!src/**/*.module.ts"
  ],
  coverageThreshold: {
    global: { branches: 70, functions: 80, lines: 80, statements: 80 }
  }
};

export default config;