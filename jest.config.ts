// File: jest.config.ts (monorepo root)
import type { Config } from "jest";

const config: Config = {
  projects: [
    "<rootDir>/services/upload-service/jest.config.ts",
    "<rootDir>/services/transactions-service/jest.config.ts",
    "<rootDir>/services/extraction-service/jest.config.ts",
    "<rootDir>/services/categorization-service/jest.config.ts",
    "<rootDir>/services/analytics-service/jest.config.ts",
    "<rootDir>/services/anomaly-service/jest.config.ts",
    "<rootDir>/services/notification-service/jest.config.ts",
    "<rootDir>/services/chat-service/jest.config.ts"
  ]
};

export default config;