/**
 * Jest Configuration for Production Hardening Tests
 * 
 * Configures Jest for integration tests, load tests, and validation tests
 * with appropriate timeouts and test environment settings.
 */

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  
  // Timeouts
  testTimeout: 60000, // 60 seconds default
  
  // Coverage
  collectCoverageFrom: [
    '**/*.ts',
    '!**/*.test.ts',
    '!**/node_modules/**',
  ],
  
  // Module paths
  modulePaths: ['<rootDir>/../../..'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../../../$1',
  },
  
  // Setup files
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  
  // Globals
  globals: {
    'ts-jest': {
      tsconfig: {
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      },
    },
  },
};
