import mongoose from 'mongoose';

export const connectTestDB = async () => {
  // Use the MongoDB URI set by globalSetup
  const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_TEST_URI;
  if (!mongoUri) {
    throw new Error('MongoDB URI not set by globalSetup');
  }
  
  // Only connect if not already connected
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(mongoUri);
  }
};

export const disconnectTestDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  // Don't stop the global MongoDB server - that's handled by globalTeardown
};

export const clearTestDB = async () => {
  if (mongoose.connection.readyState !== 0) {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  }
};