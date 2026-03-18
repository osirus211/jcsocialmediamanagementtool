module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    'nanoid': '<rootDir>/src/__tests__/mocks/nanoid.js'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { 
      tsconfig: 'tsconfig.json',
      isolatedModules: true 
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@scure|@noble|@otplib|otplib|@node-saml|openid-client|oauth4webapi|nanoid|uuid|chalk|@bull-board)/)'
  ],
  globalSetup: '<rootDir>/src/__tests__/globalSetup.ts',
  globalTeardown: '<rootDir>/src/__tests__/globalTeardown.ts',
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    '!src/server.ts',
  ],
  testTimeout: 30000,
  detectOpenHandles: true,
  forceExit: true,
  maxWorkers: 1,
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 65,
      lines: 65,
      statements: 65
    }
  }
};