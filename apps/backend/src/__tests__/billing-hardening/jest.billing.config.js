module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '../..',
  testMatch: ['<rootDir>/__tests__/billing-hardening/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/../src/$1',
    'nanoid': '<rootDir>/__tests__/mocks/nanoid.js'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: '<rootDir>/../tsconfig.json',
      isolatedModules: true
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@scure|@noble|@otplib|otplib|@node-saml|openid-client|oauth4webapi|nanoid|uuid|chalk|@bull-board)/)'
  ],
  moduleFileExtensions: ['ts', 'js', 'json'],
  testTimeout: 30000,
};
