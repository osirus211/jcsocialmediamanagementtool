import { MongoMemoryServer } from 'mongodb-memory-server';

export default async function globalSetup() {
  // Start MongoDB Memory Server with latest available version
  const mongo = await MongoMemoryServer.create({
    instance: {
      dbName: 'test',
    },
  });

  const uri = mongo.getUri();
  
  // Store the URI and instance globally
  (global as any).__MONGOD__ = mongo;
  process.env.MONGODB_URI = uri;
  process.env.MONGODB_TEST_URI = uri;
  
  console.log(`MongoDB Memory Server started at: ${uri}`);
}