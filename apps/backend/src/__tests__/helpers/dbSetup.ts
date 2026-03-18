import mongoose from 'mongoose';

export const setupTestDatabase = async () => {
  // Set test environment variables before any imports
  process.env.NODE_ENV = 'test';
  process.env.JWT_SECRET = 'test-secret';
  process.env.REDIS_URL = 'redis://localhost:6379';
  process.env.EMAIL_FROM = 'test@example.com';
  process.env.FRONTEND_URL = 'http://localhost:3000';
  
  // Use the global MongoDB instance set by globalSetup
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/test');
  }
};

export const teardownTestDatabase = async () => {
  // Only clear the database, don't disconnect (global teardown handles that)
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
  }
};

export const clearTestDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      const collection = collections[key];
      await collection.deleteMany({});
    }
  }
};