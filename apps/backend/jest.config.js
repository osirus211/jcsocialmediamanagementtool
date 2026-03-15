module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.test.json',
      isolatedModules: true,
    }],
  },
  testTimeout: 30000,
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  modulePathIgnorePatterns: [
    '<rootDir>/src/services/oauth/',
  ],
  // Handle ES modules
  transformIgnorePatterns: [
    'node_modules/(?!(nanoid|@bull-board|other-es-modules)/)'
  ],
  // Mock problematic modules
  moduleNameMapper: {
    '^yamljs$': '<rootDir>/src/__tests__/__mocks__/yamljs.js',
  },
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 65,
      lines: 65,
      statements: 65
    }
  },
  // Add debugging options
  detectOpenHandles: true,
  forceExit: true,
  // Ensure tests run in band to avoid port conflicts
  maxWorkers: 1
};
